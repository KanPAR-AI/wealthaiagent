// hooks/memory/__tests__/use-full-graph.test.tsx — the Full Knowledge Graph
// fetch orchestration: real records (all non-deleted statuses) + real
// entities + the relation set assembled from one GET /memories/graph call
// PER ENTITY (there is no list-all-relations endpoint). Errors must say
// which of the three calls failed, and a partial per-entity relation
// failure must not blank out the rest of an otherwise-successful graph.
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  getGraphNeighborhood,
  listEntities,
  listMemories,
  MemoryEngineError,
  type Entity,
  type GraphNeighborhood,
  type MemoryRecord,
} from "@/services/memory-engine-service";
import { useFullGraph } from "@/hooks/memory/use-full-graph";

jest.mock("@/services/memory-engine-service", () => {
  const actual = jest.requireActual("@/services/memory-engine-service");
  return {
    ...actual,
    listMemories: jest.fn(),
    listEntities: jest.fn(),
    getGraphNeighborhood: jest.fn(),
  };
});

const mockListMemories = listMemories as jest.MockedFunction<typeof listMemories>;
const mockListEntities = listEntities as jest.MockedFunction<typeof listEntities>;
const mockNeighborhood = getGraphNeighborhood as jest.MockedFunction<typeof getGraphNeighborhood>;

afterEach(() => jest.clearAllMocks());

function record(id: string): MemoryRecord {
  return {
    id, tenant_id: "platform", owner_type: "user", owner_id: "u1", owner_key: "user:u1",
    namespace: "travel", type: "preference",
    subject: { kind: "literal", entity_id: null, text: "user" },
    predicate: "seat_preference", value: "aisle", text: "Prefers aisle seats",
    normalized_text: "prefers aisle seats", status: "active", authority: 0.9, confidence: 0.95,
    importance: 0.5, source_type: "user_explicit", valid_from: null, valid_until: null,
    observed_at: null, created_at: null, updated_at: null, last_accessed_at: null, access_count: 0,
    version: 1, supersedes: [], superseded_by: null, entity_ids: [], tags: [], evidence_ids: [],
    qualifiers: {}, pinned: false, exact_tokens: [], idempotency_keys: [], projections_pending: [],
    dedup_key: `dk-${id}`, policy: {}, metadata: {},
  };
}

function entity(id: string): Entity {
  return {
    id, tenant_id: "platform", owner_key: "user:u1", canonical_name: id, entity_type: "person",
    aliases: [], attributes: {}, created_at: "2026-01-01T00:00:00Z",
  };
}

function resolvedNeighborhood(center: Entity, edges: GraphNeighborhood["edges"] = []): GraphNeighborhood {
  return { status: "resolved", center, nodes: [], edges, truncated: false, candidates: [] };
}

describe("useFullGraph", () => {
  test("fetches records + entities, then one relation call PER entity, deduped", async () => {
    mockListMemories.mockResolvedValue({ memories: [record("mem_1")] });
    mockListEntities.mockResolvedValue({ entities: [entity("ent_a"), entity("ent_b")] });
    const sharedEdge = {
      id: "rel_1", source: "ent_a", target: "ent_b", relation_type: "spouse_of",
      valid_from: null, valid_until: null, confidence: 0.9, status: "active", evidence_id: null,
    };
    mockNeighborhood.mockImplementation(async ({ entity: id }) =>
      resolvedNeighborhood(entity(id), [sharedEdge]),
    );

    const { result } = renderHook(() => useFullGraph());
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(mockListMemories).toHaveBeenCalledWith({ status: ["active", "superseded", "expired", "disputed"] });
    expect(mockNeighborhood).toHaveBeenCalledTimes(2); // once per entity
    expect(mockNeighborhood).toHaveBeenCalledWith({ entity: "ent_a" });
    expect(mockNeighborhood).toHaveBeenCalledWith({ entity: "ent_b" });
    expect(result.current.data!.relations).toEqual([sharedEdge]); // deduped from both calls
    expect(result.current.data!.records.map((r) => r.id)).toEqual(["mem_1"]);
    expect(result.current.data!.failedEntityIds).toEqual([]);
  });

  test("no entities -> relations is [] and no neighborhood call is made", async () => {
    mockListMemories.mockResolvedValue({ memories: [record("mem_1")] });
    mockListEntities.mockResolvedValue({ entities: [] });

    const { result } = renderHook(() => useFullGraph());
    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(mockNeighborhood).not.toHaveBeenCalled();
    expect(result.current.data!.relations).toEqual([]);
    expect(result.current.data!.entities).toEqual([]);
  });

  test("a failing records call surfaces call: 'records' and the engine's own message", async () => {
    mockListMemories.mockRejectedValue(new MemoryEngineError(500, "records blew up"));

    const { result } = renderHook(() => useFullGraph());
    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.error).toEqual({ call: "records", message: "records blew up" });
    expect(mockListEntities).not.toHaveBeenCalled(); // never reached
  });

  test("a failing entities call surfaces call: 'entities'", async () => {
    mockListMemories.mockResolvedValue({ memories: [] });
    mockListEntities.mockRejectedValue(new MemoryEngineError(500, "entities blew up"));

    const { result } = renderHook(() => useFullGraph());
    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.error).toEqual({ call: "entities", message: "entities blew up" });
  });

  test("one entity's neighborhood call failing is PARTIAL — the rest of the graph still succeeds", async () => {
    mockListMemories.mockResolvedValue({ memories: [] });
    mockListEntities.mockResolvedValue({ entities: [entity("ent_a"), entity("ent_b")] });
    mockNeighborhood.mockImplementation(async ({ entity: id }) => {
      if (id === "ent_b") throw new MemoryEngineError(500, "boom");
      return resolvedNeighborhood(entity(id), []);
    });

    const { result } = renderHook(() => useFullGraph());
    await waitFor(() => expect(result.current.status).toBe("success"));

    expect(result.current.data!.failedEntityIds).toEqual(["ent_b"]);
  });

  test("EVERY entity's neighborhood call failing surfaces call: 'relations'", async () => {
    mockListMemories.mockResolvedValue({ memories: [] });
    mockListEntities.mockResolvedValue({ entities: [entity("ent_a"), entity("ent_b")] });
    mockNeighborhood.mockRejectedValue(new MemoryEngineError(500, "all down"));

    const { result } = renderHook(() => useFullGraph());
    await waitFor(() => expect(result.current.status).toBe("error"));

    expect(result.current.error!.call).toBe("relations");
  });

  test("refetch re-runs all three calls", async () => {
    mockListMemories.mockResolvedValue({ memories: [record("mem_1")] });
    mockListEntities.mockResolvedValue({ entities: [] });

    const { result } = renderHook(() => useFullGraph());
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(mockListMemories).toHaveBeenCalledTimes(1);

    act(() => result.current.refetch());
    await waitFor(() => expect(mockListMemories).toHaveBeenCalledTimes(2));
  });
});
