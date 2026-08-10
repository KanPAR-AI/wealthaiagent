/**
 * @jest-environment node
 */
// services/__tests__/memory-engine-service.test.ts — UI-0: "the service
// builds correct requests (msw)". Asserts the client hits the real routes
// from API_MAPPING.md with the right method/path/body/auth header, and
// that responses are passed through untouched (no client-side ranking or
// semantics computation — memory-spec/STATE_MODEL).
//
// Runs under the `node` test environment (not the suite default jsdom):
// msw/node's request interceptors need Response/Request/TransformStream,
// which jsdom's environment doesn't provide — this file has no DOM
// dependency, so node is both correct and sufficient.
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

jest.mock("@/config/firebase", () => ({
  auth: {
    currentUser: {
      getIdToken: jest.fn().mockResolvedValue("test-id-token"),
    },
  },
}));

import {
  MemoryEngineError,
  addMemory,
  correctMemory,
  forgetMemory,
  getMemory,
  getMemoryHistory,
  searchMemories,
  toMemoryCardView,
  type MemoryRecord,
} from "@/services/memory-engine-service";

const BASE = "http://localhost:8080/api/v1";

function record(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: "mem_1",
    tenant_id: "platform",
    owner_type: "user",
    owner_id: "u1",
    namespace: "travel",
    type: "preference",
    subject: { kind: "literal", entity_id: null, text: "user" },
    predicate: "seatPreference",
    value: "aisle",
    text: "prefers an aisle seat",
    normalized_text: "prefers an aisle seat",
    status: "active",
    authority: 0.98,
    confidence: 0.95,
    importance: 0.5,
    source_type: "user_explicit",
    valid_from: null,
    valid_until: null,
    observed_at: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    last_accessed_at: null,
    access_count: 2,
    version: 1,
    supersedes: [],
    superseded_by: null,
    entity_ids: [],
    tags: [],
    evidence_ids: [],
    qualifiers: {},
    pinned: false,
    exact_tokens: [],
    idempotency_keys: [],
    projections_pending: [],
    dedup_key: "travel:seatPreference",
    policy: {},
    metadata: {},
    ...overrides,
  };
}

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("memory-engine-service", () => {
  test("searchMemories POSTs to /memories/search with the query body and auth header", async () => {
    let capturedAuth: string | null = null;
    let capturedBody: unknown = null;

    server.use(
      http.post(`${BASE}/memories/search`, async ({ request }) => {
        capturedAuth = request.headers.get("Authorization");
        capturedBody = await request.json();
        return HttpResponse.json({
          results: [{ memory: record(), score: 0.9, score_breakdown: {}, retrieval_reason: "semantic", channels: ["semantic"] }],
          pinned: [],
          plan_reason: "default",
          cached: false,
          ambiguous_entities: [],
        });
      }),
    );

    const result = await searchMemories({ text: "aisle seat", limit: 5 });

    expect(capturedAuth).toBe("Bearer test-id-token");
    expect(capturedBody).toEqual({ text: "aisle seat", limit: 5 });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].memory.id).toBe("mem_1");
    // Response passed through verbatim — no client recomputation of score.
    expect(result.results[0].score).toBe(0.9);
  });

  test("getMemory GETs /memories/:id", async () => {
    let capturedUrl = "";
    server.use(
      http.get(`${BASE}/memories/:id`, ({ params, request }) => {
        capturedUrl = request.url;
        expect(params.id).toBe("mem_42");
        return HttpResponse.json(record({ id: "mem_42" }));
      }),
    );

    const result = await getMemory("mem_42");
    expect(result.id).toBe("mem_42");
    expect(capturedUrl).toContain("/memories/mem_42");
  });

  test("getMemory 404 (foreign/unknown id) surfaces as MemoryEngineError", async () => {
    server.use(
      http.get(`${BASE}/memories/:id`, () =>
        HttpResponse.json({ detail: "Memory not found" }, { status: 404 }),
      ),
    );

    await expect(getMemory("mem_ghost")).rejects.toBeInstanceOf(MemoryEngineError);
    await expect(getMemory("mem_ghost")).rejects.toMatchObject({ status: 404 });
  });

  test("addMemory POSTs the write body to /memories (authority/confidence never client-set)", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post(`${BASE}/memories`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          results: [
            {
              operation: "created",
              memory: record(),
              decision_reason: "explicit write",
              policy: { allowed: true, reason: "ok" },
              events: ["evt_1"],
            },
          ],
        });
      }),
    );

    const { results } = await addMemory({ content: "I prefer aisle seats" });
    expect(capturedBody).toEqual({ content: "I prefer aisle seats" });
    expect(results[0].operation).toBe("created");
    // The body type has no authority/confidence field to send — compile-time
    // guarantee, exercised here by construction (no @ts-expect-error needed).
  });

  test("correctMemory POSTs to /memories/:id/correct", async () => {
    let capturedPath = "";
    server.use(
      http.post(`${BASE}/memories/:id/correct`, async ({ request, params }) => {
        capturedPath = `${params.id}`;
        const body = (await request.json()) as Record<string, unknown>;
        expect(body).toEqual({ value: "window" });
        return HttpResponse.json({
          operation: "superseded",
          memory: record({ value: "window" }),
          decision_reason: "user correction",
          policy: null,
          events: ["evt_2"],
        });
      }),
    );

    const result = await correctMemory("mem_1", { value: "window" });
    expect(capturedPath).toBe("mem_1");
    expect(result.operation).toBe("superseded");
  });

  test("forgetMemory DELETEs /memories/:id and returns projection_purges verbatim", async () => {
    server.use(
      http.delete(`${BASE}/memories/:id`, () =>
        HttpResponse.json({
          forgotten_count: 1,
          tombstone_keys: ["tomb_1"],
          projection_purges: { done: ["vector"], pending: ["lexical"] },
          not_found: false,
          truncated: false,
        }),
      ),
    );

    const result = await forgetMemory("mem_1");
    // MUI-0023: the caller must see pending as non-empty, never fabricate
    // completion — this asserts the raw shape survives the client intact.
    expect(result.projection_purges.pending).toEqual(["lexical"]);
  });

  test("getMemoryHistory GETs /memories/:id/history", async () => {
    server.use(
      http.get(`${BASE}/memories/:id/history`, () =>
        HttpResponse.json({
          events: [
            {
              id: "evt_1",
              memory_id: "mem_1",
              seq: 1,
              event: "created",
              actor_type: "user",
              actor_id: "u1",
              reason: "explicit",
              previous_state: null,
              new_state: { value: "aisle" },
              created_at: "2026-08-01T00:00:00Z",
            },
          ],
        }),
      ),
    );

    const { events } = await getMemoryHistory("mem_1");
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("created");
  });

  test("a non-2xx response throws MemoryEngineError with the backend detail", async () => {
    server.use(
      http.post(`${BASE}/memories/search`, () =>
        HttpResponse.json({ detail: "scope not permitted" }, { status: 403 }),
      ),
    );

    await expect(searchMemories({ text: "x" })).rejects.toThrow("scope not permitted");
  });

  test("toMemoryCardView is a pure shape transform (no ranking/authority computed)", () => {
    const card = toMemoryCardView(record());
    expect(card).toEqual({
      id: "mem_1",
      label: "prefers an aisle seat",
      value: "aisle",
      status: "active",
      type: "preference",
      namespace: "travel",
      source: "user_explicit",
      confidence: 0.95,
      authority: 0.98,
      validFrom: null,
      validUntil: null,
      usageCount: 2,
      lastUsedAt: null,
      qualifiers: {},
    });
  });
});
