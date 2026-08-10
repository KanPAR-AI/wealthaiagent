// The strict mutation rules (UI_SPEC §47-48, memory-spec): forget shows
// success ONLY when the engine says cleanup is complete, an honest
// "incomplete" state when pending is non-empty, never optimistic; correct
// surfaces a 409 as refetch+retry; broad-forget preview never mutates.
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  forgetMemory,
  forgetByFilter,
  forgetDryRun,
  correctMemory,
  addMemory,
  MemoryEngineError,
  type ForgetResult,
} from "@/services/memory-engine-service";
import {
  useForgetMemory,
  useForgetPreview,
  useCorrectMemory,
  useAddMemory,
} from "@/hooks/memory/use-memory-mutations";

jest.mock("@/services/memory-engine-service", () => {
  const actual = jest.requireActual("@/services/memory-engine-service");
  return {
    ...actual,
    forgetMemory: jest.fn(),
    forgetByFilter: jest.fn(),
    forgetDryRun: jest.fn(),
    correctMemory: jest.fn(),
    addMemory: jest.fn(),
  };
});

const mockForget = forgetMemory as jest.MockedFunction<typeof forgetMemory>;
const mockForgetFilter = forgetByFilter as jest.MockedFunction<typeof forgetByFilter>;
const mockDryRun = forgetDryRun as jest.MockedFunction<typeof forgetDryRun>;
const mockCorrect = correctMemory as jest.MockedFunction<typeof correctMemory>;
const mockAdd = addMemory as jest.MockedFunction<typeof addMemory>;

afterEach(() => jest.clearAllMocks());

function forgetResult(pending: string[]): ForgetResult {
  return {
    forgotten_count: 1,
    tombstone_keys: ["memory:mem_1"],
    projection_purges: { done: ["mem_1/purge_embedding"], pending },
    not_found: false,
    truncated: false,
  };
}

describe("useForgetMemory — completeness is the engine's call, never optimistic", () => {
  test("pending EMPTY → outcome complete", async () => {
    mockForget.mockResolvedValue(forgetResult([]));
    const { result } = renderHook(() => useForgetMemory());
    expect(result.current.phase).toBe("idle"); // never optimistic before the call
    await act(async () => { await result.current.forgetById("mem_1"); });
    await waitFor(() => expect(result.current.phase).toBe("success"));
    expect(result.current.outcome).toBe("complete");
  });

  test("pending NON-EMPTY → outcome incomplete (NOT complete)", async () => {
    mockForget.mockResolvedValue(forgetResult(["mem_1/purge_lexical"]));
    const { result } = renderHook(() => useForgetMemory());
    await act(async () => { await result.current.forgetById("mem_1"); });
    await waitFor(() => expect(result.current.phase).toBe("success"));
    expect(result.current.outcome).toBe("incomplete"); // NOT "fully forgotten"
  });

  test("not_found → honest not_found outcome", async () => {
    mockForget.mockResolvedValue({ forgotten_count: 0, tombstone_keys: [], projection_purges: { done: [], pending: [] }, not_found: true, truncated: false });
    const { result } = renderHook(() => useForgetMemory());
    await act(async () => { await result.current.forgetById("mem_x"); });
    await waitFor(() => expect(result.current.outcome).toBe("not_found"));
  });

  test("error → error phase, outcome null (never success)", async () => {
    mockForget.mockRejectedValue(new MemoryEngineError(500, "boom"));
    const { result } = renderHook(() => useForgetMemory());
    await act(async () => { await result.current.forgetById("mem_1"); });
    await waitFor(() => expect(result.current.phase).toBe("error"));
    expect(result.current.outcome).toBeNull();
  });

  test("broad forget uses the same completeness classification", async () => {
    mockForgetFilter.mockResolvedValue(forgetResult(["p"]));
    const { result } = renderHook(() => useForgetMemory());
    await act(async () => { await result.current.forgetBroad({ namespace: "travel" }); });
    await waitFor(() => expect(result.current.outcome).toBe("incomplete"));
    expect(mockForgetFilter).toHaveBeenCalledWith({ namespace: "travel" });
  });
});

describe("useForgetPreview — engine dry-count before confirm, mutates nothing", () => {
  test("returns the engine affected count via forgetDryRun (never forgetByFilter)", async () => {
    mockDryRun.mockResolvedValue({ affected_count: 7, tombstone_keys_preview: ["namespace:user:u|travel"] });
    const { result } = renderHook(() => useForgetPreview());
    await act(async () => { await result.current.load({ namespace: "travel" }); });
    await waitFor(() => expect(result.current.preview?.affected_count).toBe(7));
    expect(mockDryRun).toHaveBeenCalledWith({ namespace: "travel" });
    expect(mockForgetFilter).not.toHaveBeenCalled(); // preview never mutates
  });
});

describe("useCorrectMemory — 409 stale surfaces refetch+retry", () => {
  test("409 → conflict flag, error phase, no false success", async () => {
    mockCorrect.mockRejectedValue(new MemoryEngineError(409, "stale"));
    const { result } = renderHook(() => useCorrectMemory());
    await act(async () => { await result.current.submit("mem_1", { value: "window" }); });
    await waitFor(() => expect(result.current.phase).toBe("error"));
    expect(result.current.conflict).toBe(true);
  });

  test("success returns the superseded WriteResult verbatim", async () => {
    mockCorrect.mockResolvedValue({ operation: "superseded", memory: null, decision_reason: "", policy: null, events: ["superseded", "created"] });
    const { result } = renderHook(() => useCorrectMemory());
    await act(async () => { await result.current.submit("mem_1", { value: "window" }); });
    await waitFor(() => expect(result.current.result?.operation).toBe("superseded"));
  });
});

describe("useAddMemory — an all-rejected write is not a success", () => {
  test("policy rejection → error phase with the reason", async () => {
    mockAdd.mockResolvedValue({ results: [{ operation: "rejected", memory: null, decision_reason: "credential material is never stored", policy: null, events: [] }] });
    const { result } = renderHook(() => useAddMemory());
    await act(async () => { await result.current.submit({ content: "my api key is sk-xxx" }); });
    await waitFor(() => expect(result.current.phase).toBe("error"));
    expect(result.current.error).toMatch(/never stored/);
  });

  test("created → success", async () => {
    mockAdd.mockResolvedValue({ results: [{ operation: "created", memory: null, decision_reason: "", policy: null, events: ["created"] }] });
    const { result } = renderHook(() => useAddMemory());
    await act(async () => { await result.current.submit({ content: "I prefer aisle seats" }); });
    await waitFor(() => expect(result.current.phase).toBe("success"));
  });
});
