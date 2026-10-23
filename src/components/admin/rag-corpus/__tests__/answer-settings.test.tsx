// Source citations can be turned off per agent (owner, 2026-10-23). The
// switch must show the stored state, and saving must send the WHOLE rag
// block back — the PUT replaces it, so a partial body would drop top_k.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AnswerSettings } from "../answer-settings";

const fetchAgentConfig = jest.fn();
const updateAgentConfig = jest.fn();
jest.mock("@/services/agent-builder-service", () => ({
  fetchAgentConfig: (...a: unknown[]) => fetchAgentConfig(...a),
  updateAgentConfig: (...a: unknown[]) => updateAgentConfig(...a),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

beforeEach(() => {
  fetchAgentConfig.mockReset();
  updateAgentConfig.mockReset();
  updateAgentConfig.mockResolvedValue({ agent_id: "g", updated_at: "now" });
});

test("an agent with no rag block reads as corpus_only with sources shown", async () => {
  fetchAgentConfig.mockResolvedValue({ agent_id: "g" });
  render(<AnswerSettings agentId="g" />);
  await waitFor(() => expect(screen.getByTestId("citations-on")).toHaveAttribute("aria-pressed", "true"));
  expect(screen.getByTestId("grounding-corpus_only")).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByTestId("answer-settings-save")).toBeDisabled();
});

test("turning sources off sends the whole rag block back with citations=off", async () => {
  fetchAgentConfig.mockResolvedValue({ agent_id: "g", rag: { grounding: "corpus_first", top_k: 8, citations: "" } });
  render(<AnswerSettings agentId="g" />);
  await waitFor(() => expect(screen.getByTestId("grounding-corpus_first")).toHaveAttribute("aria-pressed", "true"));
  fireEvent.click(screen.getByTestId("citations-off"));
  expect(screen.getByTestId("citations-off")).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByTestId("answer-settings-save"));
  await waitFor(() => expect(updateAgentConfig).toHaveBeenCalledWith("g", {
    rag: { grounding: "corpus_first", top_k: 8, citations: "off" },
  }));
  await waitFor(() => expect(screen.getByTestId("answer-settings-save")).toBeDisabled());
});

test("a stored off state shows as off", async () => {
  fetchAgentConfig.mockResolvedValue({ agent_id: "g", rag: { citations: "off" } });
  render(<AnswerSettings agentId="g" />);
  await waitFor(() => expect(screen.getByTestId("citations-off")).toHaveAttribute("aria-pressed", "true"));
});
