// Forget dialog honesty (UI_SPEC §22/§47): "forgotten" ONLY when the engine
// reports cleanup complete; an honest "incomplete" state when pending is
// non-empty; never optimistic.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forgetMemory, type ForgetResult } from "@/services/memory-engine-service";
import { ForgetMemoryDialog } from "@/components/memory/mutations/forget-memory-dialog";

jest.mock("@/services/memory-engine-service", () => {
  const actual = jest.requireActual("@/services/memory-engine-service");
  return { ...actual, forgetMemory: jest.fn() };
});
const mockForget = forgetMemory as jest.MockedFunction<typeof forgetMemory>;
afterEach(() => jest.clearAllMocks());

function fr(pending: string[]): ForgetResult {
  return { forgotten_count: 1, tombstone_keys: [], projection_purges: { done: [], pending }, not_found: false, truncated: false };
}

function renderDialog() {
  return render(
    <ForgetMemoryDialog open onOpenChange={() => {}} memoryId="mem_1" label="Seat preference" value="aisle" />,
  );
}

test("complete cleanup → shows 'Memory forgotten'", async () => {
  mockForget.mockResolvedValue(fr([]));
  renderDialog();
  await userEvent.click(screen.getByTestId("confirm-forget"));
  expect(await screen.findByText("Memory forgotten")).toBeInTheDocument();
});

test("pending cleanup → honest 'incomplete', NOT success", async () => {
  mockForget.mockResolvedValue(fr(["mem_1/purge_lexical"]));
  renderDialog();
  await userEvent.click(screen.getByTestId("confirm-forget"));
  expect(await screen.findByText(/forgetting is incomplete/i)).toBeInTheDocument();
  expect(screen.queryByText("Memory forgotten")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /retry cleanup/i })).toBeInTheDocument();
});

test("before confirm nothing is forgotten (no optimistic update)", () => {
  mockForget.mockResolvedValue(fr([]));
  renderDialog();
  expect(mockForget).not.toHaveBeenCalled();
  expect(screen.queryByText("Memory forgotten")).not.toBeInTheDocument();
  // the destructive action is a distinct focused button, not the default
  expect(screen.getByTestId("confirm-forget")).toHaveTextContent("Forget memory");
});
