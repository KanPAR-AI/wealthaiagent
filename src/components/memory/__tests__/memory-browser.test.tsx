import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MemoryBrowser } from "@/components/memory/memory-browser";
import {
  searchMemories,
  listMemories,
  type MemoryRecord,
} from "@/services/memory-engine-service";

jest.mock("@/services/memory-engine-service", () => {
  const actual = jest.requireActual("@/services/memory-engine-service");
  return { ...actual, searchMemories: jest.fn(), listMemories: jest.fn() };
});

const mockSearchMemories = searchMemories as jest.MockedFunction<typeof searchMemories>;
const mockListMemories = listMemories as jest.MockedFunction<typeof listMemories>;

function record(id: string): MemoryRecord {
  return {
    id,
    tenant_id: "platform",
    owner_type: "user",
    owner_id: "u1",
    namespace: "travel",
    type: "preference",
    subject: { kind: "literal", entity_id: null, text: "user" },
    predicate: "seatPreference",
    value: "aisle",
    text: `Memory ${id}`,
    normalized_text: `memory ${id}`,
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
    access_count: 0,
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
    dedup_key: `travel:${id}`,
    policy: {},
    metadata: {},
  };
}

function renderBrowser(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/memories" element={<MemoryBrowser />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("MemoryBrowser (UI-1 integration)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("loading state never renders '0 memories' — shows a skeleton until the request settles", async () => {
    mockSearchMemories.mockImplementation(
      () => new Promise(() => {}), // never resolves within this test
    );
    renderBrowser("/memories");
    expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
    expect(screen.queryByText(/0 memories/)).not.toBeInTheDocument();
  });

  test("empty state renders only once the request has settled with zero results", async () => {
    mockSearchMemories.mockResolvedValue({
      results: [], pinned: [], plan_reason: "default", cached: false, ambiguous_entities: [],
    });
    renderBrowser("/memories?q=nonexistent");
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
    expect(screen.getByText(/no results for "nonexistent"/i)).toBeInTheDocument();
  });

  test("error state shows Retry, never a false empty/success render", async () => {
    const { MemoryEngineError } = jest.requireActual("@/services/memory-engine-service");
    mockSearchMemories.mockRejectedValue(new MemoryEngineError(403, "scope not permitted"));
    renderBrowser("/memories");
    await waitFor(() => expect(screen.getByTestId("error-state")).toBeInTheDocument());
    expect(screen.getByText("scope not permitted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
  });

  test("success renders MemoryCards in exactly the server's order (no client re-sort)", async () => {
    mockSearchMemories.mockResolvedValue({
      results: [
        { memory: record("mem_b"), score: 0.4, score_breakdown: {}, retrieval_reason: "x", channels: ["semantic"] },
        { memory: record("mem_a"), score: 0.9, score_breakdown: {}, retrieval_reason: "x", channels: ["semantic"] },
      ],
      pinned: [], plan_reason: "default", cached: false, ambiguous_entities: [],
    });
    renderBrowser("/memories?q=aisle");
    await waitFor(() => expect(screen.getAllByTestId("memory-card")).toHaveLength(2));
    const ids = screen.getAllByTestId("memory-card").map((el) => el.getAttribute("data-memory-id"));
    // mem_b has the LOWER score but the backend put it first — the client
    // must render that order verbatim, not re-sort by score.
    expect(ids).toEqual(["mem_b", "mem_a"]);
  });

  test("reload with a filter already in the URL restores the filtered state exactly (UI-25): the request AND the rail checkbox", async () => {
    mockSearchMemories.mockResolvedValue({
      results: [{ memory: record("mem_pref"), score: 1, score_breakdown: {}, retrieval_reason: "x", channels: [] }],
      pinned: [], plan_reason: "default", cached: false, ambiguous_entities: [],
    });
    renderBrowser("/memories?type=preference&status=active");

    await waitFor(() =>
      expect(mockSearchMemories).toHaveBeenCalledWith(
        expect.objectContaining({ types: ["preference"], statuses: ["active"] }),
      ),
    );
    expect(screen.getByRole("checkbox", { name: "Preference" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Active" })).toBeChecked();
  });

  test("browse (unranked) mode via the URL fetches through listMemories, not searchMemories", async () => {
    mockListMemories.mockResolvedValue({ memories: [record("mem_browse")] });
    renderBrowser("/memories?sort=browse");
    await waitFor(() => expect(mockListMemories).toHaveBeenCalled());
    expect(mockSearchMemories).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getAllByTestId("memory-card")).toHaveLength(1));
  });
});
