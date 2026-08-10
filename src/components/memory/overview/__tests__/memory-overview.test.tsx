// UI-4 Overview: real aggregates rendered, honest empty/error states, no
// vanity "used" metric (retrieval ≠ use).
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  getOverview,
  MemoryEngineError,
  type MemoryOverview as MemoryOverviewData,
} from "@/services/memory-engine-service";
import { MemoryOverview } from "@/components/memory/overview/memory-overview";

jest.mock("@/services/memory-engine-service", () => {
  const actual = jest.requireActual("@/services/memory-engine-service");
  return { ...actual, getOverview: jest.fn() };
});
const mockGet = getOverview as jest.MockedFunction<typeof getOverview>;
afterEach(() => jest.clearAllMocks());

function data(overrides: Partial<MemoryOverviewData> = {}): MemoryOverviewData {
  return {
    active_count: 12, inferred_count: 3, shadow_count: 1, superseded_count: 2,
    disputed_count: 0, new_this_week: 4,
    by_status: { active: 12, superseded: 2 },
    by_namespace: { travel: 5, work: 7 },
    recent_changes: [
      { id: "mem_1", predicate: "home_airport", value: "DEL", namespace: "travel", status: "active", source_type: "user_explicit", updated_at: "2026-08-10T00:00:00Z" },
    ],
    ...overrides,
  };
}

function renderOverview() {
  return render(<MemoryRouter><MemoryOverview /></MemoryRouter>);
}

test("renders real aggregates from the backend", async () => {
  mockGet.mockResolvedValue(data());
  renderOverview();
  expect(await screen.findByTestId("memory-overview")).toBeInTheDocument();
  expect(screen.getByText("12")).toBeInTheDocument(); // active
  expect(screen.getByText("work")).toBeInTheDocument(); // domain
  expect(screen.getByText(/home airport/i)).toBeInTheDocument(); // recent change
});

test("distinguishes 'used' honestly — no vanity used metric on this screen", async () => {
  mockGet.mockResolvedValue(data());
  renderOverview();
  await screen.findByTestId("memory-overview");
  // there is no numeric "Used" stat card; only the honest note about it
  expect(screen.queryByText(/^Used$/)).not.toBeInTheDocument();
  expect(screen.getByText(/retrieval alone is not use/i)).toBeInTheDocument();
});

test("empty universe → honest empty state, not a wall of zeros", async () => {
  mockGet.mockResolvedValue(data({ active_count: 0, superseded_count: 0, inferred_count: 0, new_this_week: 0, by_namespace: {}, recent_changes: [] }));
  renderOverview();
  expect(await screen.findByText("No memories yet")).toBeInTheDocument();
});

test("error → honest error with retry, never fabricated numbers", async () => {
  mockGet.mockRejectedValue(new MemoryEngineError(500, "down"));
  renderOverview();
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(screen.queryByTestId("memory-overview")).not.toBeInTheDocument();
});
