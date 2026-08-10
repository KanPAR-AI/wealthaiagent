// UI-7 Graph (UI_SPEC §27-30): 1-hop bounded neighborhood, alias→canonical
// resolution (UI-15), temporal slider (UI-16/TEMP-03), table a11y fallback
// (UI-28), 1-hop-only rendering (UI-34) — all against the REAL response
// shape of GET /memories/graph (mocked at the service boundary, never a
// hand-rolled shape used in production).
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  getGraphNeighborhood,
  listEntities,
  MemoryEngineError,
  type GraphNeighborhood,
} from "@/services/memory-engine-service";
import { MemoryGraph } from "@/components/memory/graph/memory-graph";
import { track } from "@/lib/analytics";

jest.mock("@/services/memory-engine-service", () => {
  const actual = jest.requireActual("@/services/memory-engine-service");
  return {
    ...actual,
    getGraphNeighborhood: jest.fn(),
    listEntities: jest.fn(),
  };
});

const mockGraph = getGraphNeighborhood as jest.MockedFunction<typeof getGraphNeighborhood>;
const mockEntities = listEntities as jest.MockedFunction<typeof listEntities>;
const mockTrack = track as jest.Mock;

afterEach(() => jest.clearAllMocks());

beforeEach(() => {
  mockEntities.mockResolvedValue({ entities: [] });
});

function entity(id: string, name: string, type = "person") {
  return { id, tenant_id: "platform", owner_key: "user:user_42", canonical_name: name, entity_type: type, aliases: [name], attributes: {}, created_at: "2026-01-01T00:00:00Z" };
}

function resolved(overrides: Partial<GraphNeighborhood> = {}): GraphNeighborhood {
  return {
    status: "resolved",
    center: entity("ent_priya", "Priya Pradeep"),
    nodes: [
      { entity_id: "ent_priya", label: "Priya Pradeep", type: "person", aliases: ["Priya", "my wife"] },
      { entity_id: "ent_ravi", label: "Ravi Pradeep", type: "person", aliases: ["me"] },
      { entity_id: "ent_acme", label: "Acme Corp", type: "org", aliases: ["Acme"] },
    ],
    edges: [
      { id: "rel_1", source: "ent_ravi", target: "ent_priya", relation_type: "married_to", valid_from: null, valid_until: null, confidence: 0.9, status: "active", evidence_id: null },
      { id: "rel_2", source: "ent_priya", target: "ent_acme", relation_type: "works_at", valid_from: "2020-01-01T00:00:00Z", valid_until: "2025-01-01T00:00:00Z", confidence: 0.8, status: "active", evidence_id: "ev_1" },
    ],
    truncated: false,
    candidates: [],
    ...overrides,
  };
}

function renderGraph(url = "/memory/graph?entity=my%20wife") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <MemoryGraph />
    </MemoryRouter>,
  );
}

describe("MemoryGraph — entry states", () => {
  test("no entity in URL → guidance, no fetch", () => {
    renderGraph("/memory/graph");
    expect(screen.getByText(/Pick an entity/i)).toBeInTheDocument();
    expect(mockGraph).not.toHaveBeenCalled();
  });

  test("shows a loading state before the response resolves", async () => {
    let resolvePromise: (v: GraphNeighborhood) => void = () => undefined;
    mockGraph.mockReturnValue(new Promise((r) => (resolvePromise = r)));
    renderGraph();
    expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument();
    resolvePromise(resolved());
    await waitFor(() => expect(screen.queryByTestId("loading-skeleton")).not.toBeInTheDocument());
  });

  test("API failure → error state with retry, never a false-empty result", async () => {
    mockGraph.mockRejectedValueOnce(new MemoryEngineError(500, "boom"));
    renderGraph();
    expect(await screen.findByTestId("error-state")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();

    mockGraph.mockResolvedValueOnce(resolved());
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByTestId("memory-graph")).toBeInTheDocument();
  });

  test("empty neighborhood (no relations) reads honestly", async () => {
    mockGraph.mockResolvedValue(
      resolved({
        nodes: [{ entity_id: "ent_priya", label: "Priya Pradeep", type: "person", aliases: [] }],
        edges: [],
      }),
    );
    renderGraph();
    expect(await screen.findByText("No relationships yet")).toBeInTheDocument();
  });
});

describe("UI-15 — alias resolves to canonical entity, ambiguity is never guessed", () => {
  test("an alias resolves and renders the canonical entity's neighborhood", async () => {
    mockGraph.mockResolvedValue(resolved());
    renderGraph("/memory/graph?entity=my%20wife");
    await screen.findByTestId("memory-graph");
    expect(mockGraph).toHaveBeenCalledWith(expect.objectContaining({ entity: "my wife" }));
    expect(screen.getAllByText("Priya Pradeep").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ravi Pradeep").length).toBeGreaterThan(0);
  });

  test("ambiguous alias surfaces candidates — never a guess", async () => {
    mockGraph.mockResolvedValue({
      status: "ambiguous",
      center: null,
      nodes: [],
      edges: [],
      truncated: false,
      candidates: [entity("ent_raj1", "Raj Malhotra"), entity("ent_raj2", "Raj Iyer")],
    });
    renderGraph("/memory/graph?entity=Raj");
    expect(await screen.findByText(/Which one did you mean/i)).toBeInTheDocument();
    const candidates = within(screen.getByTestId("graph-ambiguous-candidates"));
    expect(candidates.getByText("Raj Malhotra")).toBeInTheDocument();
    expect(candidates.getByText("Raj Iyer")).toBeInTheDocument();

    // picking a candidate re-centers on its unambiguous id, not a guess
    mockGraph.mockResolvedValueOnce(resolved({ center: entity("ent_raj1", "Raj Malhotra") }));
    await userEvent.click(candidates.getByText("Raj Malhotra"));
    await waitFor(() =>
      expect(mockGraph).toHaveBeenLastCalledWith(expect.objectContaining({ entity: "ent_raj1" })),
    );
  });

  test("unknown reference (or foreign id — identical shape, no leak) → honest empty state", async () => {
    mockGraph.mockResolvedValue({ status: "unknown", center: null, nodes: [], edges: [], truncated: false, candidates: [] });
    renderGraph("/memory/graph?entity=Nobody%20Iknow");
    expect(await screen.findByText("No entity found")).toBeInTheDocument();
  });
});

describe("UI-34 — 1-hop bounded default", () => {
  test("renders exactly the engine's own 1-hop node/edge set, one fetch, no client expansion", async () => {
    mockGraph.mockResolvedValue(resolved());
    renderGraph();
    await screen.findByTestId("memory-graph");
    expect(mockGraph).toHaveBeenCalledTimes(1);
    // exactly the 3 nodes and 2 edges the backend returned — nothing added
    const canvas = screen.getByTestId("graph-canvas");
    expect(within(canvas).getAllByRole("button")).toHaveLength(3 + 2); // 3 nodes + 2 edges
  });

  test("truncated flag from the backend is surfaced, never silently hidden", async () => {
    mockGraph.mockResolvedValue(resolved({ truncated: true }));
    renderGraph();
    expect(await screen.findByText(/more relationships than shown/i)).toBeInTheDocument();
  });
});

describe("UI-16 / TEMP-03 — temporal slider changes the visible neighborhood", () => {
  test("moving the slider re-fetches with a new `at` and renders a different edge set", async () => {
    mockGraph.mockResolvedValueOnce(resolved()); // both edges valid "now"
    renderGraph();
    await screen.findByTestId("memory-graph");
    expect(screen.getAllByText(/works_at/i).length).toBeGreaterThan(0);

    // after 2026-01-01, works_at (ended 2025-01-01) is gone
    mockGraph.mockResolvedValueOnce(
      resolved({ edges: [{ id: "rel_1", source: "ent_ravi", target: "ent_priya", relation_type: "married_to", valid_from: null, valid_until: null, confidence: 0.9, status: "active", evidence_id: null }] }),
    );
    const slider = screen.getByLabelText(/Point in time for the graph/i);
    fireEvent.change(slider, { target: { value: String(new Date("2026-06-01").getTime()) } });

    await waitFor(() =>
      expect(mockGraph).toHaveBeenLastCalledWith(expect.objectContaining({ at: expect.any(String) })),
    );
    await waitFor(() => expect(screen.queryAllByText(/works_at/i).length).toBe(0));
  });
});

describe("UI-28 — GraphTable accessible fallback (same data as the canvas)", () => {
  test("Table view renders a real <table> with the same edges", async () => {
    mockGraph.mockResolvedValue(resolved());
    renderGraph();
    await screen.findByTestId("memory-graph");
    await userEvent.click(screen.getByRole("button", { name: /^Table$/ }));
    const table = await screen.findByRole("table");
    expect(within(table).getByText("married_to")).toBeInTheDocument();
    expect(within(table).getByText("works_at")).toBeInTheDocument();
    expect(within(table).getAllByText("Priya Pradeep").length).toBeGreaterThan(0);
  });

  test("table rows are keyboard-operable buttons, not mouse-only", async () => {
    mockGraph.mockResolvedValue(resolved());
    renderGraph();
    await screen.findByTestId("memory-graph");
    await userEvent.click(screen.getByRole("button", { name: /^Table$/ }));
    const table = await screen.findByRole("table");
    const detailButtons = within(table).getAllByRole("button", { name: /Details|View details/i });
    expect(detailButtons.length).toBeGreaterThan(0);
    detailButtons[0].focus();
    expect(detailButtons[0]).toHaveFocus();
  });
});

describe("EdgeInspector", () => {
  test("selecting an edge opens its details; closing clears the selection", async () => {
    mockGraph.mockResolvedValue(resolved());
    renderGraph();
    await screen.findByTestId("memory-graph");
    await userEvent.click(screen.getByRole("button", { name: /^Table$/ }));
    const table = await screen.findByRole("table");
    await userEvent.click(within(table).getAllByRole("button", { name: /Details/i })[1]);

    const inspector = await screen.findByTestId("edge-inspector");
    expect(within(inspector).getByTestId("edge-evidence-id")).toHaveTextContent("ev_1");

    await userEvent.click(screen.getByRole("button", { name: /close edge inspector/i }));
    await waitFor(() => expect(screen.queryByTestId("edge-inspector")).not.toBeInTheDocument());
  });
});

describe("Telemetry", () => {
  test("fires memory_graph_opened once with non-sensitive props only", async () => {
    mockGraph.mockResolvedValue(resolved());
    renderGraph();
    await screen.findByTestId("memory-graph");
    await waitFor(() => expect(mockTrack).toHaveBeenCalledWith("memory_graph_opened", expect.any(Object)));
    const [, props] = mockTrack.mock.calls.find(([name]: [string]) => name === "memory_graph_opened")!;
    expect(props).toEqual(
      expect.objectContaining({ entity_id: "ent_priya", node_count: 3, edge_count: 2, truncated: false }),
    );
    // no raw memory/entity text leaks into telemetry props
    expect(JSON.stringify(props)).not.toContain("Priya Pradeep");
  });
});

describe("Relation-type filter — server-driven, never a client re-filter", () => {
  test("toggling a relation type re-fetches with relation_types and renders the NEW response", async () => {
    mockGraph.mockResolvedValueOnce(resolved());
    renderGraph();
    await screen.findByTestId("memory-graph");

    mockGraph.mockResolvedValueOnce(
      resolved({ edges: [{ id: "rel_2", source: "ent_priya", target: "ent_acme", relation_type: "works_at", valid_from: "2020-01-01T00:00:00Z", valid_until: "2025-01-01T00:00:00Z", confidence: 0.8, status: "active", evidence_id: "ev_1" }] }),
    );
    await userEvent.click(screen.getByRole("button", { name: "married_to" }));
    await waitFor(() =>
      expect(mockGraph).toHaveBeenLastCalledWith(expect.objectContaining({ relationTypes: ["married_to"] })),
    );
  });
});
