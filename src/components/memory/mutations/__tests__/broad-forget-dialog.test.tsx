// Broad forget (UI_SPEC §21): the affected COUNT is the engine's dry-run,
// fetched BEFORE confirm; the real forget only runs on explicit confirm;
// completion is honest (engine's ForgetResult).
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  forgetDryRun,
  forgetByFilter,
  type ForgetResult,
} from "@/services/memory-engine-service";
import { BroadForgetDialog } from "@/components/memory/mutations/broad-forget-dialog";

jest.mock("@/services/memory-engine-service", () => {
  const actual = jest.requireActual("@/services/memory-engine-service");
  return { ...actual, forgetDryRun: jest.fn(), forgetByFilter: jest.fn() };
});
const mockDry = forgetDryRun as jest.MockedFunction<typeof forgetDryRun>;
const mockForget = forgetByFilter as jest.MockedFunction<typeof forgetByFilter>;
afterEach(() => jest.clearAllMocks());

function fr(pending: string[], count = 3): ForgetResult {
  return { forgotten_count: count, tombstone_keys: [], projection_purges: { done: [], pending }, not_found: false, truncated: false };
}

function renderDialog() {
  return render(
    <BroadForgetDialog open onOpenChange={() => {}} filter={{ namespace: "travel" }} scopeLabel="travel" />,
  );
}

test("shows the ENGINE dry-run count before confirm, and does not forget yet", async () => {
  mockDry.mockResolvedValue({ affected_count: 3, tombstone_keys_preview: [] });
  renderDialog();
  // the engine dry-run count reaches the UI (button reflects it); the
  // description splits the number into its own span, so assert the button.
  expect(await screen.findByRole("button", { name: /Forget 3 memories/i })).toBeInTheDocument();
  expect(mockDry).toHaveBeenCalledWith({ namespace: "travel" });
  // nothing forgotten until the user confirms
  expect(mockForget).not.toHaveBeenCalled();
  expect(screen.getByTestId("confirm-broad-forget")).toHaveTextContent("Forget 3 memories");
});

test("confirm forgets via the filter and shows honest complete state", async () => {
  mockDry.mockResolvedValue({ affected_count: 3, tombstone_keys_preview: [] });
  mockForget.mockResolvedValue(fr([]));
  renderDialog();
  await screen.findByTestId("confirm-broad-forget");
  await userEvent.click(screen.getByTestId("confirm-broad-forget"));
  expect(await screen.findByText(/3 memories forgotten/i)).toBeInTheDocument();
  expect(mockForget).toHaveBeenCalledWith({ namespace: "travel" });
});

test("pending cleanup after broad forget → honest incomplete, not success", async () => {
  mockDry.mockResolvedValue({ affected_count: 3, tombstone_keys_preview: [] });
  mockForget.mockResolvedValue(fr(["x/purge_lexical"]));
  renderDialog();
  await userEvent.click(await screen.findByTestId("confirm-broad-forget"));
  expect(await screen.findByText(/forgetting is incomplete/i)).toBeInTheDocument();
  expect(screen.queryByText(/memories forgotten/i)).not.toBeInTheDocument();
});

test("zero matches disables confirm", async () => {
  mockDry.mockResolvedValue({ affected_count: 0, tombstone_keys_preview: [] });
  renderDialog();
  expect(await screen.findByText(/No matching memories/i)).toBeInTheDocument();
  expect(screen.getByTestId("confirm-broad-forget")).toBeDisabled();
});
