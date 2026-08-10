import { act, renderHook, waitFor } from "@testing-library/react";
import { useMemorySearch } from "@/hooks/memory/use-memory-search";
import { MemoryEngineError, searchMemories } from "@/services/memory-engine-service";

jest.mock("@/services/memory-engine-service", () => {
  const actual = jest.requireActual("@/services/memory-engine-service");
  return { ...actual, searchMemories: jest.fn() };
});

const mockSearchMemories = searchMemories as jest.MockedFunction<typeof searchMemories>;

const EMPTY_RESULT = { results: [], pinned: [], plan_reason: "default", cached: false, ambiguous_entities: [] };

describe("useMemorySearch", () => {
  beforeEach(() => jest.clearAllMocks());

  test("starts loading, then resolves to success with the backend's response verbatim", async () => {
    mockSearchMemories.mockResolvedValue(EMPTY_RESULT);
    const { result } = renderHook(() => useMemorySearch({ text: "aisle" }));

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.data).toEqual(EMPTY_RESULT);
  });

  test("never renders success with a 0-length list as if it were the loading state — status distinguishes them", async () => {
    mockSearchMemories.mockResolvedValue(EMPTY_RESULT);
    const { result } = renderHook(() => useMemorySearch({ text: "" }));
    // Caller-side contract: components must branch on `status`, not on
    // `data === null`, precisely so "0 memories" is never shown while
    // status is still "loading" (frontend-quality skill).
    expect(result.current.status).not.toBe("success");
    await waitFor(() => expect(result.current.status).toBe("success"));
  });

  test("surfaces a MemoryEngineError message on failure", async () => {
    mockSearchMemories.mockRejectedValue(new MemoryEngineError(403, "scope not permitted"));
    const { result } = renderHook(() => useMemorySearch({ text: "x" }));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("scope not permitted");
  });

  test("refetch re-runs the query", async () => {
    mockSearchMemories.mockResolvedValue(EMPTY_RESULT);
    const { result } = renderHook(() => useMemorySearch({ text: "aisle" }));
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(mockSearchMemories).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.refetch();
    });
    await waitFor(() => expect(mockSearchMemories).toHaveBeenCalledTimes(2));
  });
});
