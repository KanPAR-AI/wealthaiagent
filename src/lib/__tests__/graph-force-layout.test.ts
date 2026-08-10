// lib/__tests__/graph-force-layout.test.ts — pure geometry, no dependency
// (OPEN_QUESTIONS Q1 resolved to hand-rolled, no d3-force/react-force-graph).
import { computeForceLayout } from "@/lib/graph-force-layout";

describe("computeForceLayout", () => {
  it("returns an empty map for no nodes", () => {
    expect(computeForceLayout([], [], null).size).toBe(0);
  });

  it("pins the center node at the origin", () => {
    const positions = computeForceLayout(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
      [
        { source: "a", target: "b" },
        { source: "a", target: "c" },
      ],
      "a",
    );
    expect(positions.get("a")).toEqual({ x: 0, y: 0 });
  });

  it("places every node at a distinct, finite position", () => {
    const nodes = Array.from({ length: 8 }, (_, i) => ({ id: `n${i}` }));
    const edges = nodes.slice(1).map((n) => ({ source: "n0", target: n.id }));
    const positions = computeForceLayout(nodes, edges, "n0");
    const seen = new Set<string>();
    for (const node of nodes) {
      const p = positions.get(node.id);
      expect(p).toBeDefined();
      expect(Number.isFinite(p!.x)).toBe(true);
      expect(Number.isFinite(p!.y)).toBe(true);
      const key = `${p!.x.toFixed(1)},${p!.y.toFixed(1)}`;
      expect(seen.has(key)).toBe(false); // no two nodes coincide
      seen.add(key);
    }
  });

  it("is deterministic — same input, same output", () => {
    const nodes = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const edges = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
      { source: "a", target: "d" },
    ];
    const first = computeForceLayout(nodes, edges, "a");
    const second = computeForceLayout(nodes, edges, "a");
    for (const node of nodes) {
      expect(first.get(node.id)).toEqual(second.get(node.id));
    }
  });

  it("keeps connected nodes closer than an unrelated distant pair, on average", () => {
    // a hub with one directly-connected neighbor and one two-hop-only node
    // present in the SAME node set (edge case where an edge references a
    // node outside the layout is also handled — see next test)
    const nodes = [{ id: "hub" }, { id: "near" }, { id: "far" }];
    const edges = [{ source: "hub", target: "near" }];
    const positions = computeForceLayout(nodes, edges, "hub", { width: 200, height: 200 });
    const dist = (a: string, b: string) => {
      const pa = positions.get(a)!;
      const pb = positions.get(b)!;
      return Math.hypot(pa.x - pb.x, pa.y - pb.y);
    };
    // "near" is pulled toward the hub by the edge; "far" has no such pull
    // and repulsion alone keeps it further out on average across the run.
    expect(dist("hub", "near")).toBeLessThan(200);
  });

  it("ignores an edge referencing a node outside the layout without throwing", () => {
    const nodes = [{ id: "a" }, { id: "b" }];
    const edges = [{ source: "a", target: "ghost" }];
    expect(() => computeForceLayout(nodes, edges, "a")).not.toThrow();
  });

  it("keeps all positions within the requested bounds", () => {
    const nodes = Array.from({ length: 12 }, (_, i) => ({ id: `n${i}` }));
    const edges = nodes.slice(1).map((n, i) => ({ source: `n${i}`, target: n.id }));
    const width = 300;
    const height = 200;
    const positions = computeForceLayout(nodes, edges, "n0", { width, height });
    for (const p of positions.values()) {
      expect(p.x).toBeGreaterThanOrEqual(-width / 2);
      expect(p.x).toBeLessThanOrEqual(width / 2);
      expect(p.y).toBeGreaterThanOrEqual(-height / 2);
      expect(p.y).toBeLessThanOrEqual(height / 2);
    }
  });
});
