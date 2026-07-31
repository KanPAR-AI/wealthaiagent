import { buildGraph } from "../memory-graph";

/**
 * The graph is the explanation. If an edge is dropped, a withdrawn conclusion
 * reads as arbitrary — "why did it stop believing that?" has no answer on the
 * page.
 */

const fact = (key: string, value = "v", derived_from: string[] = []) => ({
  key,
  value,
  derived_from,
});

describe("buildGraph", () => {
  it("puts facts the user stated at the root", () => {
    const g = buildGraph([fact("salary", "5 lakh"), fact("age", "32")]);
    expect(g.roots.map((r) => r.fact.key)).toEqual(["age", "salary"]);
    expect(g.orphans).toEqual([]);
  });

  it("nests a conclusion under the fact it was inferred from", () => {
    const g = buildGraph([
      fact("salary", "5 lakh"),
      fact("affluence_tier", "ultra_rich", ["salary"]),
    ]);
    expect(g.roots.map((r) => r.fact.key)).toEqual(["salary"]);
    expect(g.roots[0].children.map((c) => c.fact.key)).toEqual(["affluence_tier"]);
  });

  it("shows a fact under every source it depends on", () => {
    // Hiding one parent would suggest changing it has no consequence.
    const g = buildGraph([
      fact("salary"),
      fact("age"),
      fact("risk_capacity", "high", ["salary", "age"]),
    ]);
    const under = (k: string) =>
      g.roots.find((r) => r.fact.key === k)!.children.map((c) => c.fact.key);
    expect(under("salary")).toEqual(["risk_capacity"]);
    expect(under("age")).toEqual(["risk_capacity"]);
  });

  it("shows withdrawn conclusions under the fact that invalidated them", () => {
    // The adjacency IS the explanation: "we dropped this BECAUSE salary changed".
    const g = buildGraph(
      [fact("salary", "2 lakh")],
      [fact("affluence_tier", "ultra_rich", ["salary"])],
    );
    const child = g.roots[0].children[0];
    expect(child.fact.key).toBe("affluence_tier");
    expect(child.withdrawn).toBe(true);
  });

  it("prefers the live copy when a fact was re-derived", () => {
    const g = buildGraph(
      [fact("salary"), fact("tier", "middle", ["salary"])],
      [fact("tier", "ultra_rich", ["salary"])],
    );
    const children = g.roots.find((r) => r.fact.key === "salary")!.children;
    expect(children).toHaveLength(1);
    expect(children[0].withdrawn).toBe(false);
    expect(children[0].fact.value).toBe("middle");
  });

  it("surfaces conclusions whose evidence is gone rather than hiding them", () => {
    // Nothing would withdraw these if the original evidence changed, which is
    // precisely the thing worth noticing.
    const g = buildGraph([fact("affluence_tier", "ultra_rich", ["salary"])]);
    expect(g.roots).toEqual([]);
    expect(g.orphans.map((o) => o.fact.key)).toEqual(["affluence_tier"]);
  });

  it("does not let a self-referencing fact nest under itself", () => {
    const g = buildGraph([fact("salary", "5 lakh", ["salary"])]);
    expect(g.roots.map((r) => r.fact.key)).toEqual(["salary"]);
    expect(g.roots[0].children).toEqual([]);
  });

  it("handles an empty store", () => {
    expect(buildGraph([])).toEqual({ roots: [], orphans: [] });
  });
});
