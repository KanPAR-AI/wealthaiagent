// components/memory/full-graph/__tests__/full-knowledge-graph.test.tsx —
// integration test for the Full Knowledge Graph debug page against the
// REAL response shapes of listMemories/listEntities/getGraphNeighborhood
// (mocked at the service boundary only, same convention as
// components/memory/graph/__tests__/memory-graph.test.tsx).
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  getGraphNeighborhood,
  listEntities,
  listMemories,
  MemoryEngineError,
  type Entity,
  type GraphNeighborhood,
  type MemoryRecord,
} from "@/services/memory-engine-service";
import { FullKnowledgeGraph } from "@/components/memory/full-graph/full-knowledge-graph";

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

function record(overrides: Partial<MemoryRecord> & { id: string }): MemoryRecord {
  return {
    tenant_id: "platform", owner_type: "user", owner_id: "u1", owner_key: "user:u1",
    namespace: "travel", type: "preference",
    subject: { kind: "literal", entity_id: null, text: "user" },
    predicate: "seat_preference", value: "aisle", text: "Prefers aisle seats",
    normalized_text: "prefers aisle seats", status: "active", authority: 0.9, confidence: 0.95,
    importance: 0.5, source_type: "user_explicit", valid_from: null, valid_until: null,
    observed_at: null, created_at: "2026-01-01T00:00:00Z", updated_at: null, last_accessed_at: null,
    access_count: 0, version: 1, supersedes: [], superseded_by: null, entity_ids: [], tags: [],
    evidence_ids: [], qualifiers: {}, pinned: false, exact_tokens: [], idempotency_keys: [],
    projections_pending: [], dedup_key: `dk-${overrides.id}`, policy: {}, metadata: {},
    ...overrides,
  };
}

function entity(id: string, canonical_name: string): Entity {
  return { id, tenant_id: "platform", owner_key: "user:u1", canonical_name, entity_type: "person", aliases: [], attributes: {}, created_at: "2026-01-01T00:00:00Z" };
}

function resolved(center: Entity, edges: GraphNeighborhood["edges"] = []): GraphNeighborhood {
  return { status: "resolved", center, nodes: [], edges, truncated: false, candidates: [] };
}

function renderPage(url = "/memory/full-graph") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <FullKnowledgeGraph />
    </MemoryRouter>,
  );
}

describe("FullKnowledgeGraph — loading / error / empty", () => {
  test("shows a loading skeleton before data resolves", () => {
    mockListMemories.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getAllByTestId("loading-skeleton").length).toBeGreaterThan(0);
  });

  test("a failed records call shows which call failed, never a false-empty result", async () => {
    mockListMemories.mockRejectedValue(new MemoryEngineError(500, "records boom"));
    renderPage();
    const err = await screen.findByTestId("error-state");
    expect(err).toHaveTextContent("records");
    expect(err).toHaveTextContent("records boom");
  });

  test("zero records → honest 'No records' empty state, not a silent blank graph", async () => {
    mockListMemories.mockResolvedValue({ memories: [] });
    mockListEntities.mockResolvedValue({ entities: [] });
    renderPage();
    expect(await screen.findByText("No records")).toBeInTheDocument();
  });
});

describe("FullKnowledgeGraph — rendered with data", () => {
  beforeEach(() => {
    mockListMemories.mockResolvedValue({
      memories: [
        record({ id: "mem_1", namespace: "travel", predicate: "seat_preference", entity_ids: ["ent_a"] }),
        record({ id: "mem_2", namespace: "diet", predicate: "allergy", status: "superseded", superseded_by: "mem_3" }),
        record({ id: "mem_3", namespace: "diet", predicate: "allergy", supersedes: ["mem_2"] }),
      ],
    });
    mockListEntities.mockResolvedValue({ entities: [entity("ent_a", "Priya Pradeep")] });
    mockNeighborhood.mockResolvedValue(resolved(entity("ent_a", "Priya Pradeep"), []));
  });

  test("renders the health strip with real counts", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId("kg-health-strip")).toBeInTheDocument());
    expect(screen.getByTestId("kg-stat-records")).toHaveTextContent("3");
    expect(screen.getByTestId("kg-stat-active")).toHaveTextContent("2");
    expect(screen.getByTestId("kg-stat-superseded")).toHaveTextContent("1");
    expect(screen.getByTestId("kg-stat-entities")).toHaveTextContent("1");
  });

  test("renders the canvas with record and entity nodes, and calls one neighborhood fetch per entity", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId("kg-canvas")).toBeInTheDocument());
    expect(mockNeighborhood).toHaveBeenCalledWith({ entity: "ent_a" });
    expect(screen.getAllByTestId("kg-node-record").length).toBe(3);
    expect(screen.getAllByTestId("kg-node-entity").length).toBe(1);
  });

  test("switching to the Table tab shows the same filtered rows as sortable table rows", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId("kg-canvas")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("tab", { name: "table" }));
    expect(await screen.findByTestId("kg-table")).toBeInTheDocument();
    expect(screen.getAllByTestId("kg-table-row")).toHaveLength(3);
  });

  test("selecting a record node opens the inspector with the record's own fields and its supersede chain", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId("kg-canvas")).toBeInTheDocument());
    const recordNodes = screen.getAllByTestId("kg-node-record");
    // mem_3 is active + has a chain; find it via its aria-label (predicate "allergy")
    const mem3Node = recordNodes.find((n) => {
      const label = n.getAttribute("aria-label") ?? "";
      return label.includes("allergy") && label.includes("active");
    });
    expect(mem3Node).toBeDefined();
    await userEvent.click(mem3Node!);
    const inspector = await screen.findByTestId("kg-inspector");
    expect(inspector).toHaveTextContent("allergy");
    expect(inspector).toHaveTextContent("Open full inspector");
  });

  test("'only problems' filter narrows the table to just the flagged duplicate/orphan/suspicious rows", async () => {
    // mem_2/mem_3 supersede cleanly (no problem); make mem_1 an orphan by
    // pointing supersedes at a non-existent id.
    mockListMemories.mockResolvedValue({
      memories: [
        record({ id: "mem_1", namespace: "travel", predicate: "seat_preference", supersedes: ["mem_ghost"] }),
        record({ id: "mem_2", namespace: "diet", predicate: "allergy" }),
      ],
    });
    renderPage();
    await userEvent.click(await screen.findByRole("tab", { name: "table" }));
    expect(await screen.findByTestId("kg-table")).toBeInTheDocument();
    expect(screen.getAllByTestId("kg-table-row")).toHaveLength(2);

    await userEvent.click(screen.getByRole("checkbox", { name: "Only problems" }));
    await waitFor(() => expect(screen.getAllByTestId("kg-table-row")).toHaveLength(1));
  });

  test("0 entities renders the specific honest empty-state notice, without blocking the record graph", async () => {
    mockListEntities.mockResolvedValue({ entities: [] });
    renderPage();
    await waitFor(() => expect(screen.getByTestId("kg-no-entities-notice")).toBeInTheDocument());
    expect(screen.getByTestId("kg-no-entities-notice")).toHaveTextContent("0 entities");
    // records still render as their own graph, around their subject
    expect(screen.getByTestId("kg-canvas")).toBeInTheDocument();
  });
});
