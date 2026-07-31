import type { MemoryFact, WithdrawnFact } from "@/services/memory-service";

/**
 * The memory DAG: what the assistant was told, and what it concluded from it.
 *
 * Memory is not a flat list. "This user is affluent" is derived FROM "salary =
 * 5 lakh", and that edge is the whole reason cascade repair can work — correct
 * the salary and the conclusion drawn from it gets withdrawn. Without seeing
 * the edges, a withdrawn fact looks arbitrary and a wrong conclusion looks
 * unexplainable.
 *
 * Rendered as a tree rather than a free-form node graph because the shape is
 * genuinely shallow: repair stops at the first derived layer, so anything
 * deeper is not something the system acts on automatically.
 */

export interface GraphNode {
  fact: MemoryFact;
  /** Facts inferred FROM this one. */
  children: GraphNode[];
  withdrawn: boolean;
}

export interface MemoryGraph {
  /** Facts the user stated directly — nothing was inferred to produce them. */
  roots: GraphNode[];
  /**
   * Derived facts whose evidence is no longer in the store. Shown separately
   * rather than dropped: a conclusion whose source has vanished is exactly the
   * thing you want to notice, not hide.
   */
  orphans: GraphNode[];
}

/**
 * Build the DAG from a flat fact list. Live and withdrawn facts are passed
 * together so a withdrawn conclusion still appears under the fact that
 * invalidated it — that adjacency IS the explanation.
 */
export function buildGraph(
  live: MemoryFact[],
  withdrawn: WithdrawnFact[] = [],
): MemoryGraph {
  const all: { fact: MemoryFact; withdrawn: boolean }[] = [
    ...live.map((f) => ({ fact: f, withdrawn: false })),
    ...withdrawn.map((f) => ({ fact: f as MemoryFact, withdrawn: true })),
  ];

  const nodes = new Map<string, GraphNode>();
  for (const { fact, withdrawn: w } of all) {
    if (!fact.key) continue;
    // A key can appear in both lists if it was re-derived; the live copy wins.
    const existing = nodes.get(fact.key);
    if (existing && !existing.withdrawn) continue;
    nodes.set(fact.key, { fact, children: [], withdrawn: w });
  }

  const roots: GraphNode[] = [];
  const orphans: GraphNode[] = [];

  for (const node of nodes.values()) {
    const sources = (node.fact.derived_from || []).filter((s) => s !== node.fact.key);
    if (!sources.length) {
      roots.push(node);
      continue;
    }
    // Attach to every source it was inferred from. A fact derived from two
    // facts appears under both — duplicating it is more honest than picking
    // one parent and hiding the other dependency.
    const parents = sources.map((s) => nodes.get(s)).filter(Boolean) as GraphNode[];
    if (!parents.length) orphans.push(node);
    else parents.forEach((p) => p.children.push(node));
  }

  const byKey = (a: GraphNode, b: GraphNode) =>
    (a.fact.key || "").localeCompare(b.fact.key || "");
  roots.sort(byKey);
  orphans.sort(byKey);
  roots.forEach((r) => r.children.sort(byKey));
  return { roots, orphans };
}

function NodeRow({ node, depth }: { node: GraphNode; depth: number }) {
  const f = node.fact;
  return (
    <div>
      <div
        className="flex gap-2 text-xs items-baseline py-0.5"
        style={{ paddingLeft: depth * 18 }}
      >
        {depth > 0 && (
          <span className="text-muted-foreground shrink-0" aria-hidden>
            └─
          </span>
        )}
        <span
          className={`font-medium shrink-0 ${node.withdrawn ? "line-through opacity-60" : ""}`}
        >
          {f.key}
        </span>
        <span
          className={`text-muted-foreground truncate ${node.withdrawn ? "line-through opacity-60" : ""}`}
        >
          {String(f.value ?? "")}
        </span>
        {depth === 0 && !node.children.length && (
          <span className="text-[11px] text-muted-foreground/70 shrink-0">stated</span>
        )}
        {node.withdrawn && (
          <span className="ml-auto shrink-0 text-[11px] rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-700 dark:text-amber-400">
            withdrawn
          </span>
        )}
      </div>
      {node.children.map((c) => (
        <NodeRow key={`${f.key}>${c.fact.key}`} node={c} depth={depth + 1} />
      ))}
    </div>
  );
}

export function MemoryGraphView({
  live,
  withdrawn,
}: {
  live: MemoryFact[];
  withdrawn?: WithdrawnFact[];
}) {
  const { roots, orphans } = buildGraph(live, withdrawn || []);
  const hasEdges = roots.some((r) => r.children.length) || orphans.length > 0;

  if (!roots.length && !orphans.length) return null;

  return (
    <div className="space-y-1">
      {!hasEdges && (
        <p className="text-xs text-muted-foreground">
          Every fact here was stated directly — nothing has been inferred yet,
          so there is nothing to withdraw if one of them changes.
        </p>
      )}
      {roots.map((r) => (
        <NodeRow key={r.fact.key} node={r} depth={0} />
      ))}
      {!!orphans.length && (
        <div className="pt-2">
          <p className="text-xs text-muted-foreground">
            Inferred from facts that are no longer stored — nothing would
            withdraw these if the original evidence changed:
          </p>
          {orphans.map((o) => (
            <NodeRow key={o.fact.key} node={o} depth={1} />
          ))}
        </div>
      )}
    </div>
  );
}
