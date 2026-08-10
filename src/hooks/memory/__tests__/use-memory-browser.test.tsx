import { useEffect } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useMemoryBrowser } from "@/hooks/memory/use-memory-browser";
import {
  MemoryEngineError,
  listMemories,
  searchMemories,
  type MemoryRecord,
  type SearchResult,
} from "@/services/memory-engine-service";

jest.mock("@/services/memory-engine-service", () => {
  const actual = jest.requireActual("@/services/memory-engine-service");
  return { ...actual, searchMemories: jest.fn(), listMemories: jest.fn() };
});

const mockSearchMemories = searchMemories as jest.MockedFunction<typeof searchMemories>;
const mockListMemories = listMemories as jest.MockedFunction<typeof listMemories>;

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
    authority: 0.9,
    confidence: 0.95,
    importance: 0.5,
    source_type: "user_explicit",
    valid_from: null,
    valid_until: null,
    observed_at: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    last_accessed_at: null,
    access_count: 1,
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

/** Test-only: drives a route change from OUTSIDE the Router the way a real
 *  URL edit/link click would, so `useMemoryBrowser`'s `useSearchParams`
 *  actually sees a new location on the next render. `renderHook`'s
 *  callback runs as real component render inside the wrapper's Router
 *  context, so calling useNavigate/useLocation alongside the hook under
 *  test is valid here (not inside the hook itself). */
function useBrowserAtPath(path: string) {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const have = `${location.pathname}${location.search}`;
    if (have !== path) navigate(path, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  return useMemoryBrowser();
}

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={["/memories"]}>{children}</MemoryRouter>;
}

describe("useMemoryBrowser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchMemories.mockResolvedValue({
      results: [], pinned: [], plan_reason: "default", cached: false, ambiguous_entities: [],
    });
    mockListMemories.mockResolvedValue({ memories: [] });
  });

  test("debounces: rapid successive query changes settle into exactly ONE request, for the LAST query", async () => {
    jest.useFakeTimers({ legacyFakeTimers: false });
    const { rerender } = renderHook(({ path }) => useBrowserAtPath(path), {
      wrapper,
      initialProps: { path: "/memories?q=a" },
    });

    // Three rapid "keystrokes", each well inside the debounce window of
    // the next — only the LAST should ever reach the network.
    act(() => { jest.advanceTimersByTime(50); });
    rerender({ path: "/memories?q=ab" });
    act(() => { jest.advanceTimersByTime(50); });
    rerender({ path: "/memories?q=abc" });
    act(() => { jest.advanceTimersByTime(50); });
    expect(mockSearchMemories).not.toHaveBeenCalled();

    act(() => { jest.advanceTimersByTime(300); }); // clears the debounce from the LAST change
    await act(async () => { await Promise.resolve(); });
    expect(mockSearchMemories).toHaveBeenCalledTimes(1);
    expect(mockSearchMemories).toHaveBeenCalledWith(
      expect.objectContaining({ text: "abc" }),
    );
    jest.useRealTimers();
  });

  test("relevance mode (default) calls searchMemories with the text/filters from the URL", async () => {
    const { result } = renderHook(({ path }) => useBrowserAtPath(path), {
      wrapper,
      initialProps: { path: "/memories?q=aisle&type=preference" },
    });
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(mockSearchMemories).toHaveBeenCalledWith(
      expect.objectContaining({ text: "aisle", types: ["preference"], limit: 50 }),
    );
    expect(mockListMemories).not.toHaveBeenCalled();
  });

  test("sort=browse calls listMemories (structured/unranked), never searchMemories", async () => {
    const { result } = renderHook(({ path }) => useBrowserAtPath(path), {
      wrapper,
      initialProps: { path: "/memories?sort=browse&status=active" },
    });
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(mockListMemories).toHaveBeenCalledWith(
      expect.objectContaining({ status: ["active"] }),
    );
    expect(mockSearchMemories).not.toHaveBeenCalled();
  });

  test("sort changes the REQUEST (different endpoint/params) — rows render exactly as returned, never client re-sorted", async () => {
    mockSearchMemories.mockResolvedValue({
      results: [{
        memory: record({ id: "mem_search" }), score: 0.5, score_breakdown: {},
        retrieval_reason: "matched via semantic", channels: ["semantic"],
      }],
      pinned: [], plan_reason: "default", cached: false, ambiguous_entities: [],
    });
    mockListMemories.mockResolvedValue({ memories: [record({ id: "mem_browse" })] });

    const { result, rerender } = renderHook(({ path }) => useBrowserAtPath(path), {
      wrapper,
      initialProps: { path: "/memories" },
    });
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.rows.map((r) => r.memory.id)).toEqual(["mem_search"]);
    expect(result.current.rows[0].score).toBe(0.5);

    rerender({ path: "/memories?sort=browse" });
    await waitFor(() =>
      expect(result.current.rows.map((r) => r.memory.id)).toEqual(["mem_browse"]),
    );
    expect(result.current.rows[0].score).toBeNull(); // no fabricated ranking
    expect(mockListMemories).toHaveBeenCalledTimes(1);
    expect(mockSearchMemories).toHaveBeenCalledTimes(1);
  });

  test("a superseded (stale) response never clobbers a newer one", async () => {
    let resolveFirst!: (v: SearchResult) => void;
    mockSearchMemories
      .mockImplementationOnce(
        () => new Promise((resolve) => { resolveFirst = resolve; }),
      )
      .mockResolvedValueOnce({
        results: [{
          memory: record({ id: "mem_second" }), score: 1, score_breakdown: {},
          retrieval_reason: "x", channels: [],
        }],
        pinned: [], plan_reason: "default", cached: false, ambiguous_entities: [],
      });

    const { result, rerender } = renderHook(({ path }) => useBrowserAtPath(path), {
      wrapper,
      initialProps: { path: "/memories?q=first" },
    });
    await waitFor(() => expect(mockSearchMemories).toHaveBeenCalledTimes(1));

    rerender({ path: "/memories?q=second" });
    await waitFor(() => expect(mockSearchMemories).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.rows.map((r) => r.memory.id)).toEqual(["mem_second"]);

    act(() => {
      resolveFirst({
        results: [{
          memory: record({ id: "mem_first" }), score: 1, score_breakdown: {},
          retrieval_reason: "x", channels: [],
        }],
        pinned: [], plan_reason: "default", cached: false, ambiguous_entities: [],
      });
    });
    await act(async () => { await Promise.resolve(); });
    expect(result.current.rows.map((r) => r.memory.id)).toEqual(["mem_second"]);
  });

  test("surfaces a MemoryEngineError message on failure without pretending 0 results", async () => {
    mockSearchMemories.mockRejectedValue(new MemoryEngineError(403, "scope not permitted"));
    const { result } = renderHook(({ path }) => useBrowserAtPath(path), {
      wrapper,
      initialProps: { path: "/memories" },
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("scope not permitted");
  });
});
