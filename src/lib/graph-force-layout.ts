// lib/graph-force-layout.ts — hand-rolled SVG force layout for MemoryGraph
// (UI-7, OPEN_QUESTIONS Q1 resolved to option (a): no d3-force/react-force-
// graph/@xyflow — none of those are in wealthaiagent/package.json, and
// ADR-004 requires sign-off before adding a competing dependency. recharts/
// framer-motion/lightweight-charts (the libs that ARE installed) don't do
// node/edge force layout either, so this is a small Fruchterman-Reingold-
// style implementation, pure and deterministic.
//
// This is PURE PRESENTATION GEOMETRY, not a memory semantic — it decides
// where a node sits on screen, never which nodes/edges exist (that is the
// engine's `neighborhood()` response, MUI-1010). Same nodes/edges in ->
// same positions out (seeded index-based initial placement, never
// Math.random) so the canvas is stable across re-renders and testable.

export interface LayoutNode {
  id: string;
}

export interface LayoutEdge {
  source: string;
  target: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface ForceLayoutOptions {
  width?: number;
  height?: number;
  iterations?: number;
}

const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 360;
const DEFAULT_ITERATIONS = 120;

/** Fruchterman-Reingold-style force layout bounded to `width`x`height`,
 *  centered at the origin. `centerId`, if present among `nodes`, is PINNED
 *  at (0, 0) — it is the resolved/re-centered entity the graph is showing
 *  the neighborhood of, not something physics should move. */
export function computeForceLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  centerId: string | null,
  opts: ForceLayoutOptions = {},
): Map<string, Point> {
  const width = opts.width ?? DEFAULT_WIDTH;
  const height = opts.height ?? DEFAULT_HEIGHT;
  const iterations = opts.iterations ?? DEFAULT_ITERATIONS;
  const positions = new Map<string, Point>();
  const n = nodes.length;
  if (n === 0) return positions;

  const k = Math.sqrt((width * height) / n); // ideal edge length

  // Deterministic seeded placement: center pinned at origin, everyone else
  // starts evenly spaced on a ring (never coincident, never random).
  nodes.forEach((node, i) => {
    if (node.id === centerId) {
      positions.set(node.id, { x: 0, y: 0 });
      return;
    }
    const angle = (2 * Math.PI * i) / Math.max(1, n);
    const radius = Math.min(width, height) / 2.4;
    positions.set(node.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  });

  const ids = nodes.map((node) => node.id);
  if (n === 1) return positions; // nothing to simulate

  for (let iter = 0; iter < iterations; iter++) {
    const disp = new Map<string, Point>(ids.map((id) => [id, { x: 0, y: 0 }]));

    // repulsion — every pair of nodes pushes apart
    for (let a = 0; a < ids.length; a++) {
      for (let b = a + 1; b < ids.length; b++) {
        const pa = positions.get(ids[a])!;
        const pb = positions.get(ids[b])!;
        let dx = pa.x - pb.x;
        let dy = pa.y - pb.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (k * k) / dist;
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        const da = disp.get(ids[a])!;
        const db = disp.get(ids[b])!;
        da.x += dx;
        da.y += dy;
        db.x -= dx;
        db.y -= dy;
      }
    }

    // attraction — edges pull their endpoints together
    for (const edge of edges) {
      const ps = positions.get(edge.source);
      const pt = positions.get(edge.target);
      if (!ps || !pt) continue; // an edge to a node outside this view
      let dx = ps.x - pt.x;
      let dy = ps.y - pt.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist * dist) / k;
      dx = (dx / dist) * force;
      dy = (dy / dist) * force;
      const ds = disp.get(edge.source)!;
      const dt = disp.get(edge.target)!;
      ds.x -= dx;
      ds.y -= dy;
      dt.x += dx;
      dt.y += dy;
    }

    // apply displacement with a cooling schedule, clamp to bounds
    const temperature = Math.max(1, k * (1 - iter / iterations));
    for (const id of ids) {
      if (id === centerId) continue; // pinned
      const p = positions.get(id)!;
      const d = disp.get(id)!;
      const dlen = Math.sqrt(d.x * d.x + d.y * d.y) || 0.01;
      const capped = Math.min(dlen, temperature);
      p.x += (d.x / dlen) * capped;
      p.y += (d.y / dlen) * capped;
      p.x = Math.max(-width / 2, Math.min(width / 2, p.x));
      p.y = Math.max(-height / 2, Math.min(height / 2, p.y));
    }
  }

  return positions;
}
