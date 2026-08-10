import { memoryMatchReasonLabel } from "@/lib/memory-match-reason";

describe("memoryMatchReasonLabel", () => {
  test("exact channel -> 'Exact value'", () => {
    expect(memoryMatchReasonLabel(["exact"], "exact token match")).toBe("Exact value");
  });

  test("entity channel -> 'Entity'", () => {
    expect(memoryMatchReasonLabel(["entity"], "matched via entity")).toBe("Entity");
  });

  test("semantic channel -> 'Semantic'", () => {
    expect(memoryMatchReasonLabel(["semantic"], "matched via semantic")).toBe("Semantic");
  });

  test("lexical channel folds under 'Semantic'", () => {
    expect(memoryMatchReasonLabel(["lexical"], "matched via lexical")).toBe("Semantic");
  });

  test("structured channel -> 'Predicate'", () => {
    expect(memoryMatchReasonLabel(["structured"], "structured exact lookup")).toBe("Predicate");
  });

  test("pinned channel -> 'Pinned'", () => {
    expect(memoryMatchReasonLabel(["pinned"], "pinned (no search, T32)")).toBe("Pinned");
  });

  test("exact takes priority over other simultaneous channels", () => {
    expect(memoryMatchReasonLabel(["semantic", "exact", "entity"], "x")).toBe("Exact value");
  });

  test("no channels and an unrecognized reason -> null (never fabricates one)", () => {
    expect(memoryMatchReasonLabel([], "")).toBeNull();
  });
});
