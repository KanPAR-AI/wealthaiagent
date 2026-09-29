// Bug e4fb9b32: the second Jarvis turn died with "(Jarvis API error: 422)".
// The panel keeps {role, content, actions} per message and handed the list
// straight to the API, whose history type was Dict[str, str]; and a
// validation failure was rendered as a bare status code.
import { askJarvis, formatJarvisError, toWireHistory } from "../jarvis-service";

const mockFetch = jest.fn();
(globalThis as any).fetch = mockFetch;

beforeEach(() => mockFetch.mockReset());

describe("toWireHistory", () => {
  it("sends role + content only — the panel's `actions` never reach the wire", () => {
    const wire = toWireHistory([
      { role: "user", content: "how to see this corpus" },
      { role: "assistant", content: "On the current Corpus tab…", actions: [] } as any,
      { role: "assistant", content: "File it?", actions: [{ type: "report_bug", draft: "x" }] } as any,
    ]);
    expect(wire).toEqual([
      { role: "user", content: "how to see this corpus" },
      { role: "assistant", content: "On the current Corpus tab…" },
      { role: "assistant", content: "File it?" },
    ]);
    for (const m of wire) expect(Object.keys(m).sort()).toEqual(["content", "role"]);
  });

  it("drops empty messages", () => {
    expect(toWireHistory([{ role: "assistant", content: "" }])).toEqual([]);
  });
});

describe("askJarvis", () => {
  it("posts the sanitised history on a follow-up turn", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ answer: "Use the dropdown.", actions: [] }) });
    const out = await askJarvis(
      "there is no corpus tab on this screen",
      { page: "agent_detail", section: "agents", tab: "rag_corpus", agent_id: "a1" },
      [
        { role: "user", content: "how to see this corpus" },
        { role: "assistant", content: "On the current Corpus tab…", actions: [] } as any,
      ],
    );
    expect(out.answer).toBe("Use the dropdown.");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.history).toEqual([
      { role: "user", content: "how to see this corpus" },
      { role: "assistant", content: "On the current Corpus tab…" },
    ]);
    expect(body.context.tab).toBe("rag_corpus");
  });

  it("surfaces the server's validation detail, never a bare 422", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: "Unprocessable Entity",
      json: async () => ({
        detail: [{ loc: ["body", "history", 1, "actions"], msg: "Input should be a valid string", type: "string_type" }],
      }),
    });
    await expect(askJarvis("q", {}, [])).rejects.toThrow(
      "Jarvis rejected the request (422): history.1.actions: Input should be a valid string",
    );
  });

  it("reads chatservice's own validation envelope (the body behind the report's bare 422)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: "Unprocessable Entity",
      json: async () => ({
        error: {
          code: "VALIDATION_ERROR",
          message: "Input validation failed",
          details: [{ loc: ["body", "history", 1, "actions"], msg: "Input should be a valid string", type: "string_type" }],
        },
      }),
    });
    await expect(askJarvis("there is no corpus tab on this screen", {}, [])).rejects.toThrow(
      "Jarvis rejected the request (422): history.1.actions: Input should be a valid string",
    );
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 500, statusText: "",
      json: async () => ({ error: { code: "INTERNAL", message: "Jarvis is unavailable" } }),
    });
    await expect(askJarvis("q", {}, [])).rejects.toThrow("Jarvis is unavailable");
  });

  it("passes a string detail through and falls back to the status only when the server said nothing", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 422, statusText: "", json: async () => ({ detail: "Question is empty" }) });
    await expect(askJarvis("q", {}, [])).rejects.toThrow("Question is empty");

    mockFetch.mockResolvedValueOnce({ ok: false, status: 502, statusText: "Bad Gateway", json: async () => { throw new Error("not json"); } });
    await expect(askJarvis("q", {}, [])).rejects.toThrow("Jarvis API error: 502 Bad Gateway");
  });
});

describe("formatJarvisError", () => {
  it("handles every detail shape", () => {
    expect(formatJarvisError({ detail: "nope" }, 400)).toBe("nope");
    expect(formatJarvisError({ detail: [{ loc: ["body", "question"], msg: "too short" }] }, 422)).toBe(
      "Jarvis rejected the request (422): question: too short",
    );
    expect(formatJarvisError({ detail: { code: "x" } }, 500)).toBe('Jarvis API error 500: {"code":"x"}');
    expect(formatJarvisError(null, 503, "Service Unavailable")).toBe("Jarvis API error: 503 Service Unavailable");
    expect(formatJarvisError({}, 404)).toBe("Jarvis API error: 404");
  });
});
