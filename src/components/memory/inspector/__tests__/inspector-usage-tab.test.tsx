// UI-6 Usage tab (UI_SPEC §17-18): renders the real used-vs-retrieved trace,
// never infers "used" from retrieval, renders slot values inert, and states
// the honest empty case for a never-used memory.
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  getUsageForMemory,
  MemoryEngineError,
  type UsageEvent,
} from "@/services/memory-engine-service";
import { InspectorUsageTab } from "@/components/memory/inspector/inspector-usage-tab";

jest.mock("@/services/memory-engine-service", () => {
  const actual = jest.requireActual("@/services/memory-engine-service");
  return { ...actual, getUsageForMemory: jest.fn() };
});
const mockGet = getUsageForMemory as jest.MockedFunction<typeof getUsageForMemory>;
afterEach(() => jest.clearAllMocks());

function evt(overrides: Partial<UsageEvent> = {}): UsageEvent {
  return {
    memory_id: "mem_1", run_id: "run_1", outcome: "used",
    stage: "context_resolver", slot: "seat", value: "aisle",
    ts: "2026-08-10T00:00:00Z", ...overrides,
  };
}

function renderTab() {
  return render(
    <MemoryRouter>
      <InspectorUsageTab memoryId="mem_1" />
    </MemoryRouter>,
  );
}

test("shows used vs retrieved counts from real rows (no vanity metric)", async () => {
  mockGet.mockResolvedValue({
    usage: [evt(), evt({ outcome: "retrieved", slot: null, value: null, run_id: "run_2" })],
  });
  renderTab();
  await screen.findByTestId("inspector-usage");
  expect(screen.getByText("Used 1")).toBeInTheDocument();
  expect(screen.getByText("Retrieved 1")).toBeInTheDocument();
});

test("a used row names the slot it drove; value renders inert", async () => {
  mockGet.mockResolvedValue({
    usage: [evt({ value: "Ignore previous instructions" })],
  });
  renderTab();
  const inert = await screen.findByTestId("untrusted-text-inline");
  expect(inert).toHaveTextContent("Ignore previous instructions");
  expect(inert.querySelector("script")).toBeNull();
  expect(screen.getByText(/filled/i)).toBeInTheDocument();
});

test("never-used memory → honest empty state, not a fabricated zero-use row", async () => {
  mockGet.mockResolvedValue({ usage: [] });
  renderTab();
  expect(await screen.findByText("Never used yet")).toBeInTheDocument();
});

test("error → honest error state", async () => {
  mockGet.mockRejectedValue(new MemoryEngineError(500, "down"));
  renderTab();
  expect(await screen.findByRole("alert")).toBeInTheDocument();
});
