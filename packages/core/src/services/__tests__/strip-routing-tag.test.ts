// The router's "[Using X agent]" tag must never reach a person.
//
// From a real bug report, 2026-08-04: an anonymous user on Android asked
// "Today" and the reply opened with "[Using generic agent]". It had been
// stripped in the web app's renderer only, so every reply on the mobile app
// had shown it for as long as that app has existed.
//
// The tag stays in the STORED message on purpose — the orchestrator reads it
// back out of history to decide whether the previous reply came from a
// specialist, which is how conversation continuity works. So it is stripped at
// display, in core, where both clients get it.

import { mapHistoryMessage, stripRoutingTag } from "../chat-service";

describe("stripRoutingTag", () => {
  it("removes the tag a real user saw", () => {
    expect(stripRoutingTag("[Using generic agent]\n\nToday is Monday."))
      .toBe("Today is Monday.");
  });

  it("handles every agent id shape the router emits", () => {
    // Dynamic agents carry admin-chosen ids, which may contain underscores or
    // hyphens; the web app's original regex used \w+ and would have missed a
    // hyphenated one.
    for (const id of ["generic", "real_estate", "knee_arthritis", "dr-david"]) {
      expect(stripRoutingTag(`[Using ${id} agent]\n\nhello`)).toBe("hello");
    }
  });

  it("only strips a LEADING tag", () => {
    // The phrase could legitimately appear inside an answer — an admin asking
    // Jarvis what the tag means, for instance.
    const text = "The marker looks like [Using generic agent] in the logs.";
    expect(stripRoutingTag(text)).toBe(text);
  });

  it("leaves ordinary replies untouched", () => {
    expect(stripRoutingTag("Today is Monday.")).toBe("Today is Monday.");
  });

  it("survives empty and undefined content", () => {
    expect(stripRoutingTag("")).toBe("");
    expect(stripRoutingTag(undefined as unknown as string)).toBe("");
  });
});

describe("mapHistoryMessage", () => {
  const base = {
    id: "m1",
    sender: "assistant" as const,
    content: "[Using generic agent]\n\nToday is Monday.",
    timestamp: "2026-08-04T12:57:59Z",
    attachments: [],
  };

  it("strips the tag from every field that carries the text", () => {
    // Three fields hold the same string. Stripping one and not the others is
    // how it leaked back in through a re-render.
    const out = mapHistoryMessage(base as never);
    expect(out.message).toBe("Today is Monday.");
    expect(out.streamingContent).toBe("Today is Monday.");
  });

  it("strips it inside content blocks too", () => {
    const out = mapHistoryMessage({
      ...base,
      metadata: { widgets: [{ type: "action_tiles" }] },
    } as never);
    expect(out.contentBlocks?.[0]).toEqual({
      type: "text",
      content: "Today is Monday.",
    });
  });

  it("does not touch what the user themselves typed", () => {
    const out = mapHistoryMessage({
      ...base,
      sender: "user",
      content: "[Using generic agent] what does this mean?",
    } as never);
    expect(out.message).toBe("[Using generic agent] what does this mean?");
  });
});
