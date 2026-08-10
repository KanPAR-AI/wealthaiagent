// Memory Assistant panel (docs/39): grounded answers with a visible tool
// trace, and propose-not-perform — a forget/correct is only ever a PROPOSAL
// until the user explicitly confirms, at which point the real endpoint runs.
// Nothing the assistant returns mutates memory on its own.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  askMemoryAssistant,
  correctMemory,
  forgetMemory,
  type ForgetResult,
  type MemoryAssistantReply,
  type WriteResult,
} from "@/services/memory-engine-service";
import { MemoryAssistantPanel } from "@/components/memory/memory-assistant-panel";

jest.mock("@/services/memory-engine-service", () => {
  const actual = jest.requireActual("@/services/memory-engine-service");
  return {
    ...actual,
    askMemoryAssistant: jest.fn(),
    forgetMemory: jest.fn(),
    correctMemory: jest.fn(),
  };
});

const mockAsk = askMemoryAssistant as jest.MockedFunction<typeof askMemoryAssistant>;
const mockForget = forgetMemory as jest.MockedFunction<typeof forgetMemory>;
const mockCorrect = correctMemory as jest.MockedFunction<typeof correctMemory>;

afterEach(() => jest.clearAllMocks());

function reply(over: Partial<MemoryAssistantReply>): MemoryAssistantReply {
  return { answer: "", tool_calls: [], actions: [], ...over };
}
function fr(pending: string[]): ForgetResult {
  return {
    forgotten_count: 1,
    tombstone_keys: [],
    projection_purges: { done: [], pending },
    not_found: false,
    truncated: false,
  };
}

async function open() {
  render(<MemoryAssistantPanel />);
  await userEvent.click(screen.getByTestId("memory-assistant-open"));
}

async function ask(text: string) {
  await userEvent.type(screen.getByLabelText("Ask about your memory"), text);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
}

test("grounded answer renders with a checkable tool trace", async () => {
  mockAsk.mockResolvedValue(
    reply({
      answer: "You prefer an aisle seat.",
      tool_calls: [
        { name: "memory_search", arguments: { text: "seat" }, result: { results: [{ id: "mem_1", value: "aisle" }] } },
      ],
    }),
  );
  await open();
  await ask("what's my seat preference?");

  expect(await screen.findByText("You prefer an aisle seat.")).toBeInTheDocument();
  // the trace is shown, not hidden — expandable to the real gateway result
  const trace = screen.getByRole("button", { name: /ran memory_search/i });
  await userEvent.click(trace);
  expect(screen.getByText(/"value": "aisle"/)).toBeInTheDocument();
});

test("a forget proposal does NOT mutate until the user confirms", async () => {
  mockAsk.mockResolvedValue(
    reply({ answer: "I can forget that.", actions: [{ type: "forget", memory_id: "mem_1" }] }),
  );
  mockForget.mockResolvedValue(fr([]));
  await open();
  await ask("forget my seat preference");

  // proposal rendered, but the real endpoint has NOT been called
  expect(await screen.findByText(/Confirm to permanently/i)).toBeInTheDocument();
  expect(screen.getByText("mem_1")).toBeInTheDocument();
  expect(mockForget).not.toHaveBeenCalled();

  // only an explicit confirm click performs it
  await userEvent.click(screen.getByRole("button", { name: /Forget it/i }));
  await waitFor(() => expect(mockForget).toHaveBeenCalledWith("mem_1"));
  expect(await screen.findByText(/Forgotten\./i)).toBeInTheDocument();
});

test("cancelling a proposal never calls the endpoint", async () => {
  mockAsk.mockResolvedValue(
    reply({ answer: "I can forget that.", actions: [{ type: "forget", memory_id: "mem_9" }] }),
  );
  await open();
  await ask("forget it");
  await screen.findByText(/Confirm to permanently/i);
  await userEvent.click(screen.getByRole("button", { name: /Cancel/i }));
  expect(mockForget).not.toHaveBeenCalled();
});

test("forget with pending purges is reported as incomplete, not success", async () => {
  mockAsk.mockResolvedValue(
    reply({ answer: "ok", actions: [{ type: "forget", memory_id: "mem_1" }] }),
  );
  mockForget.mockResolvedValue(fr(["mem_1/purge_lexical"]));
  await open();
  await ask("forget it");
  await userEvent.click(await screen.findByRole("button", { name: /Forget it/i }));
  expect(await screen.findByText(/cleanup is still in progress/i)).toBeInTheDocument();
  expect(screen.queryByText(/^Forgotten\./)).not.toBeInTheDocument();
});

test("a correct proposal shows the exact new value and applies on confirm", async () => {
  mockAsk.mockResolvedValue(
    reply({
      answer: "I can correct that.",
      actions: [{ type: "correct", memory_id: "mem_1", value: "window" }],
    }),
  );
  mockCorrect.mockResolvedValue({ operation: "superseded" } as WriteResult);
  await open();
  await ask("actually I prefer window");

  expect(await screen.findByText(/Confirm to/i)).toBeInTheDocument();
  expect(screen.getByText("window")).toBeInTheDocument();
  expect(mockCorrect).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole("button", { name: /Correct it/i }));
  await waitFor(() => expect(mockCorrect).toHaveBeenCalledWith("mem_1", { value: "window" }));
  expect(await screen.findByText(/Corrected\./i)).toBeInTheDocument();
});

test("a failed action is surfaced honestly, no silent success", async () => {
  mockAsk.mockResolvedValue(
    reply({ answer: "ok", actions: [{ type: "forget", memory_id: "mem_1" }] }),
  );
  mockForget.mockRejectedValue(new Error("network down"));
  await open();
  await ask("forget it");
  await userEvent.click(await screen.findByRole("button", { name: /Forget it/i }));
  expect(await screen.findByText(/network down/i)).toBeInTheDocument();
});
