// lib/__tests__/langfuse.test.ts — docs/40 VIEW-3.
//
// The whole feature is one URL, so the URL is the thing worth testing: a
// deep-link that silently points at the wrong place is indistinguishable
// from a working one until an admin is already lost.
import {
  LANGFUSE_FALLBACK_BASE_URL,
  LANGFUSE_FALLBACK_PROJECT,
  langfuseSessionUrl,
  langfuseTraceUrl,
} from "@/lib/langfuse";

describe("langfuse deep links", () => {
  test("a chat maps to its Langfuse session (docs/40 §1: session = chat_id)", () => {
    expect(langfuseSessionUrl("chat-123")).toBe(
      `${LANGFUSE_FALLBACK_BASE_URL}/project/${LANGFUSE_FALLBACK_PROJECT}/sessions/chat-123`,
    );
  });

  test("a turn maps to its Langfuse trace (trace = request_id)", () => {
    expect(langfuseTraceUrl("req-abc")).toBe(
      `${LANGFUSE_FALLBACK_BASE_URL}/project/${LANGFUSE_FALLBACK_PROJECT}/traces/req-abc`,
    );
  });

  test("the base URL is configurable — the instance is not publicly reachable", () => {
    expect(
      langfuseSessionUrl("c1", { baseUrl: "https://langfuse.internal:3000" }),
    ).toBe("https://langfuse.internal:3000/project/chatservice/sessions/c1");
  });

  test("a trailing slash on the base does not produce a doubled slash", () => {
    expect(langfuseSessionUrl("c1", { baseUrl: "http://localhost:3001/" })).toBe(
      "http://localhost:3001/project/chatservice/sessions/c1",
    );
  });

  test("the project segment is configurable — self-hosted mints its own id", () => {
    expect(langfuseSessionUrl("c1", { project: "cm4xyz" })).toBe(
      `${LANGFUSE_FALLBACK_BASE_URL}/project/cm4xyz/sessions/c1`,
    );
  });

  test("ids are encoded, so an odd chat id cannot break out of the path", () => {
    expect(langfuseSessionUrl("a/b?c=d")).toContain("/sessions/a%2Fb%3Fc%3Dd");
  });

  test.each([null, undefined, "", "   "])(
    "no chat id yields no link, never a half-built one (%p)",
    (id) => {
      expect(langfuseSessionUrl(id as string | null)).toBeNull();
      expect(langfuseTraceUrl(id as string | null)).toBeNull();
    },
  );

  test("an empty configured base falls back to the tunnel convention", () => {
    expect(langfuseSessionUrl("c1", { baseUrl: "" })).toBe(
      `${LANGFUSE_FALLBACK_BASE_URL}/project/${LANGFUSE_FALLBACK_PROJECT}/sessions/c1`,
    );
  });
});
