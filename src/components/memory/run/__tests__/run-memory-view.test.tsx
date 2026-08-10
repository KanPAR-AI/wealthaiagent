// UI-6 Run Memory (UI_SPEC §19): two honest columns — used vs retrieved — for
// one run, each row showing the CURRENT memory label/value and deep-linking to
// the inspector. Values render inert. Empty run reads honestly.
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import {
  getRunMemory,
  MemoryEngineError,
  type RunMemory,
  type RunMemoryRow,
} from "@/services/memory-engine-service";
import { RunMemoryView } from "@/components/memory/run/run-memory-view";

jest.mock("@/services/memory-engine-service", () => {
  const actual = jest.requireActual("@/services/memory-engine-service");
  return { ...actual, getRunMemory: jest.fn() };
});
const mockGet = getRunMemory as jest.MockedFunction<typeof getRunMemory>;
afterEach(() => jest.clearAllMocks());

function row(overrides: Partial<RunMemoryRow> = {}): RunMemoryRow {
  return {
    memory_id: "mem_1", run_id: "run_1", outcome: "used",
    stage: "context_resolver", slot: "seat", value: "aisle",
    ts: "2026-08-10T00:00:00Z", predicate: "seat_preference",
    current_value: "aisle", status: "active", ...overrides,
  };
}

function renderRun(data: RunMemory) {
  mockGet.mockResolvedValue(data);
  return render(
    <MemoryRouter initialEntries={["/chataiagent/memory/run/run_1"]}>
      <Routes>
        <Route path="/chataiagent/memory/run/:runId" element={<RunMemoryView />} />
      </Routes>
    </MemoryRouter>,
  );
}

test("splits used and retrieved into distinct columns from real trace", async () => {
  renderRun({
    run_id: "run_1",
    used: [row()],
    retrieved: [row({ memory_id: "mem_2", outcome: "retrieved", slot: null, value: null, predicate: "editor", current_value: "vim" })],
  });
  await screen.findByTestId("run-memory");
  expect(screen.getByTestId("run-used")).toHaveTextContent(/seat preference/i);
  expect(screen.getByTestId("run-retrieved")).toHaveTextContent(/editor/i);
  expect(screen.getByText(/Used \(1\)/)).toBeInTheDocument();
  expect(screen.getByText(/Retrieved, not used \(1\)/)).toBeInTheDocument();
});

test("used row shows the slot it drove; current value renders inert", async () => {
  renderRun({ run_id: "run_1", used: [row({ current_value: "window <b>x</b>" })], retrieved: [] });
  await screen.findByTestId("run-used");
  const inert = screen.getAllByTestId("untrusted-text-inline");
  expect(inert.some((n) => n.textContent?.includes("window <b>x</b>"))).toBe(true);
  expect(screen.getByText(/drove/i)).toBeInTheDocument();
});

test("empty run → honest empty state, not fabricated arrows", async () => {
  renderRun({ run_id: "run_1", used: [], retrieved: [] });
  expect(await screen.findByText("No memory in this run")).toBeInTheDocument();
});

test("error → honest error", async () => {
  mockGet.mockRejectedValue(new MemoryEngineError(500, "down"));
  render(
    <MemoryRouter initialEntries={["/chataiagent/memory/run/run_1"]}>
      <Routes>
        <Route path="/chataiagent/memory/run/:runId" element={<RunMemoryView />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByRole("alert")).toBeInTheDocument();
});
