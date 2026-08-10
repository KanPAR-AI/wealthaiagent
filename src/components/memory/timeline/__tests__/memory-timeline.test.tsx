// UI-5 Timeline (§25-26, TEMP): renders the engine's validity spans, offers
// a chart AND an accessible list view of the SAME data (a11y fallback), and
// shows honest empty/forgotten states.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { getTimeline, type TimelineSpan } from "@/services/memory-engine-service";
import { MemoryTimeline } from "@/components/memory/timeline/memory-timeline";

jest.mock("@/services/memory-engine-service", () => {
  const actual = jest.requireActual("@/services/memory-engine-service");
  return { ...actual, getTimeline: jest.fn() };
});
const mockGet = getTimeline as jest.MockedFunction<typeof getTimeline>;
afterEach(() => jest.clearAllMocks());

function spans(): TimelineSpan[] {
  return [
    { id: "m1", value: "Mumbai", text: "", status: "superseded", source_type: "user_explicit", valid_from: "2024-01-01T00:00:00Z", valid_until: "2025-05-01T00:00:00Z" },
    { id: "m2", value: "Bangalore", text: "", status: "superseded", source_type: "user_explicit", valid_from: "2025-05-01T00:00:00Z", valid_until: "2026-08-09T00:00:00Z" },
    { id: "m3", value: "Delhi", text: "", status: "active", source_type: "user_explicit", valid_from: "2026-08-09T00:00:00Z", valid_until: null },
  ];
}

function renderTimeline(url = "/memory/timeline?namespace=travel&predicate=home_airport") {
  return render(<MemoryRouter initialEntries={[url]}><MemoryTimeline /></MemoryRouter>);
}

test("renders the value validity spans (chart) from the backend", async () => {
  mockGet.mockResolvedValue({ spans: spans() });
  renderTimeline();
  expect(await screen.findByTestId("memory-timeline")).toBeInTheDocument();
  expect(screen.getByText("Delhi")).toBeInTheDocument();
  expect(screen.getByText("Mumbai")).toBeInTheDocument();
});

test("the accessible LIST view shows the same values + windows (a11y fallback)", async () => {
  mockGet.mockResolvedValue({ spans: spans() });
  renderTimeline();
  await screen.findByTestId("memory-timeline");
  await userEvent.click(screen.getByRole("button", { name: /List/i }));
  const list = await screen.findByTestId("timeline-list");
  expect(list).toHaveTextContent("Mumbai");
  expect(list).toHaveTextContent("Bangalore");
  expect(list).toHaveTextContent("Delhi");
  expect(list).toHaveTextContent("current");
});

test("no fact selected → guidance, no fetch", () => {
  renderTimeline("/memory/timeline");
  expect(screen.getByText(/Pick a fact/i)).toBeInTheDocument();
  expect(mockGet).not.toHaveBeenCalled();
});

test("forgotten/empty slot → honest empty state", async () => {
  mockGet.mockResolvedValue({ spans: [] });
  renderTimeline();
  expect(await screen.findByText("No history for this fact")).toBeInTheDocument();
});
