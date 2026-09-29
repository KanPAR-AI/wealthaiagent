// Bug a0d78f0f round 2: the one-reload latch must never become a reload loop.
import {
  RELOAD_LATCH_KEY,
  clearStaleChunkLatch,
  isBoundaryErrorShowing,
  isStaleChunkError,
  reloadOnceForStaleChunk,
  setBoundaryErrorShowing,
} from "@/lib/stale-chunk";

const originalLocation = window.location;
let reloadMock: jest.Mock;

beforeEach(() => {
  reloadMock = jest.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, reload: reloadMock },
  });
  sessionStorage.clear();
});

afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  jest.restoreAllMocks();
});

describe("reloadOnceForStaleChunk", () => {
  it("reloads once and latches", () => {
    expect(reloadOnceForStaleChunk()).toBe(true);
    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(reloadOnceForStaleChunk()).toBe(false);
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT reload when sessionStorage throws (no latch means a possible loop)", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(reloadOnceForStaleChunk()).toBe(false);
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it("does NOT reload when the latch cannot be written", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(reloadOnceForStaleChunk()).toBe(false);
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it("clearStaleChunkLatch re-arms the one reload after a healthy mount", () => {
    reloadOnceForStaleChunk();
    expect(sessionStorage.getItem(RELOAD_LATCH_KEY)).toBeTruthy();
    clearStaleChunkLatch();
    expect(sessionStorage.getItem(RELOAD_LATCH_KEY)).toBeNull();
    expect(reloadOnceForStaleChunk()).toBe(true);
    expect(reloadMock).toHaveBeenCalledTimes(2);
  });

  it("does not release the latch while a boundary is showing an error", () => {
    reloadOnceForStaleChunk();
    setBoundaryErrorShowing(true);
    expect(clearStaleChunkLatch()).toBe(false);
    expect(sessionStorage.getItem(RELOAD_LATCH_KEY)).toBeTruthy();
    setBoundaryErrorShowing(false);
    expect(clearStaleChunkLatch()).toBe(true);
    expect(sessionStorage.getItem(RELOAD_LATCH_KEY)).toBeNull();
    expect(isBoundaryErrorShowing()).toBe(false);
  });

  it("clearStaleChunkLatch is safe when storage throws", () => {
    jest.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => clearStaleChunkLatch()).not.toThrow();
  });
});

describe("isStaleChunkError", () => {
  it("matches the three chunk-load shapes and nothing else", () => {
    expect(isStaleChunkError(new Error("Failed to fetch dynamically imported module: /a/b-1a2b.js"))).toBe(true);
    expect(isStaleChunkError(new Error("Loading chunk vendor-9f failed."))).toBe(true);
    expect(isStaleChunkError(new Error("Loading CSS chunk 3 failed."))).toBe(true);
    expect(isStaleChunkError(new Error("Importing a module script failed."))).toBe(true);
    expect(isStaleChunkError(new TypeError("x is not a function"))).toBe(false);
    expect(isStaleChunkError("plain string")).toBe(false);
    expect(isStaleChunkError(null)).toBe(false);
  });
});
