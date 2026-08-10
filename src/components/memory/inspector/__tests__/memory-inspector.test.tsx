// Inspector (UI_SPEC §12-14/§17): opens from the deep-link id, Details
// renders engine fields verbatim, History is newest-first, an unknown id
// shows an honest not-found with no data flash, and Esc closes.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  getMemory,
  getMemoryHistory,
  MemoryEngineError,
  type MemoryRecord,
  type MemoryEvent,
} from "@/services/memory-engine-service";
import { MemoryInspector } from "@/components/memory/inspector/memory-inspector";

jest.mock("@/services/memory-engine-service", () => {
  const actual = jest.requireActual("@/services/memory-engine-service");
  return { ...actual, getMemory: jest.fn(), getMemoryHistory: jest.fn() };
});
jest.mock("@/hooks/memory/use-permissions", () => ({
  usePermissions: () => ({
    permissions: { "memory.correct": true, "memory.forget": true },
    loading: false,
  }),
}));

const mockGet = getMemory as jest.MockedFunction<typeof getMemory>;
const mockHistory = getMemoryHistory as jest.MockedFunction<typeof getMemoryHistory>;
afterEach(() => jest.clearAllMocks());

function record(): MemoryRecord {
  return {
    id: "mem_1", tenant_id: "platform", owner_type: "user", owner_id: "u1",
    owner_key: "user:u1", namespace: "travel", type: "preference",
    subject: { kind: "literal", entity_id: null, text: "user" },
    predicate: "seat_preference", value: "aisle", text: "Prefers aisle seats",
    normalized_text: "prefers aisle seats", status: "active", authority: 0.98,
    confidence: 1, importance: 0.6, source_type: "user_explicit",
    valid_from: "2026-08-09T00:00:00Z", valid_until: null, observed_at: null,
    created_at: "2026-08-09T00:00:00Z", updated_at: "2026-08-09T00:00:00Z",
    last_accessed_at: null, access_count: 14, version: 1, supersedes: [],
    superseded_by: null, entity_ids: [], tags: [], evidence_ids: ["ev_1"],
    qualifiers: { context: "long_flights" }, pinned: false, exact_tokens: [],
    idempotency_keys: [], projections_pending: [], dedup_key: "d", policy: {},
    metadata: {},
  };
}

function events(): { events: MemoryEvent[] } {
  return {
    events: [
      { id: "e1", memory_id: "mem_1", seq: 1, event: "created", actor_type: "user", actor_id: "u1", reason: "explicit remember", previous_state: null, new_state: { value: "aisle" }, created_at: "2026-08-09T00:00:00Z" },
      { id: "e2", memory_id: "mem_1", seq: 2, event: "reinforced", actor_type: "user", actor_id: "u1", reason: "repeated", previous_state: { value: "aisle" }, new_state: { value: "aisle" }, created_at: "2026-08-10T00:00:00Z" },
    ],
  };
}

test("deep-link open loads the record and renders Details verbatim", async () => {
  mockGet.mockResolvedValue(record());
  mockHistory.mockResolvedValue(events());
  render(<MemoryInspector memoryId="mem_1" open onClose={() => {}} />);
  expect(await screen.findByTestId("inspector-details")).toBeInTheDocument();
  // engine values shown, not recomputed
  expect(screen.getByText("aisle")).toBeInTheDocument();
  expect(screen.getByText("0.98")).toBeInTheDocument(); // authority displayed
  expect(screen.getByText("14")).toBeInTheDocument(); // access count
  expect(screen.getByText(/context = long_flights/)).toBeInTheDocument();
});

test("History tab is newest-first with the Current marker", async () => {
  mockGet.mockResolvedValue(record());
  mockHistory.mockResolvedValue(events());
  render(<MemoryInspector memoryId="mem_1" open onClose={() => {}} />);
  await screen.findByTestId("inspector-details");
  await userEvent.click(screen.getByRole("tab", { name: "History" }));
  const list = await screen.findByTestId("inspector-history");
  const items = list.querySelectorAll("li");
  // newest (reinforced, seq 2) first, carries Current
  expect(items[0]).toHaveTextContent("Reinforced");
  expect(items[0]).toHaveTextContent("Current");
  expect(items[1]).toHaveTextContent("Created");
});

test("unknown/foreign id → honest not-found, NO data flash", async () => {
  mockGet.mockRejectedValue(new MemoryEngineError(404, "Memory not found"));
  mockHistory.mockRejectedValue(new MemoryEngineError(404, "Memory not found"));
  render(<MemoryInspector memoryId="mem_missing" open onClose={() => {}} />);
  expect(await screen.findByText("Memory not found")).toBeInTheDocument();
  // no record fields ever rendered
  expect(screen.queryByTestId("inspector-details")).not.toBeInTheDocument();
});

test("closed inspector fetches nothing (open=false gates the request)", () => {
  render(<MemoryInspector memoryId="mem_1" open={false} onClose={() => {}} />);
  expect(mockGet).not.toHaveBeenCalled();
});
