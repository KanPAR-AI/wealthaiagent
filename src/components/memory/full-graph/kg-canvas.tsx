// components/memory/full-graph/kg-canvas.tsx — SVG rendering for the Full
// Knowledge Graph. Reuses the SAME hand-rolled force layout MemoryGraph
// uses (lib/graph-force-layout.ts, ADR-004 — no new dependency), just over
// a richer node/edge set (subjects, namespace hubs, records, entities).
// Status is encoded in FORM as well as color (accessibility skill): active
// = solid, superseded = dashed, expired/disputed = dotted with a distinct
// hue — never color alone.
import { useMemo, useState } from "react";
import { computeForceLayout } from "@/lib/graph-force-layout";
import { cn } from "@/lib/utils";
import type { KgEdge, KgNode } from "@/lib/knowledge-graph-assembly";

export interface KgCanvasProps {
  nodes: KgNode[];
  edges: KgEdge[];
  centerId?: string | null;
  selectedId?: string | null;
  onSelectNode: (node: KgNode) => void;
  className?: string;
}

const WIDTH = 720;
const HEIGHT = 480;

const RADIUS_BY_KIND: Record<KgNode["kind"], number> = {
  subject: 22,
  namespace: 14,
  entity: 12,
  record: 8,
};

function recordDash(status: KgNode["status"]): string | undefined {
  switch (status) {
    case "superseded":
      return "4 2";
    case "expired":
    case "disputed":
      return "1 3";
    default:
      return undefined; // active: solid
  }
}

function recordFillClass(status: KgNode["status"]): string {
  switch (status) {
    case "active":
      return "fill-emerald-500/70 stroke-emerald-600";
    case "superseded":
      return "fill-zinc-300/30 stroke-zinc-500";
    case "expired":
      return "fill-zinc-200/20 stroke-zinc-400";
    case "disputed":
      return "fill-amber-300/40 stroke-amber-600";
    default:
      return "fill-background stroke-muted-foreground";
  }
}

function edgeClass(kind: KgEdge["kind"]): string {
  switch (kind) {
    case "supersede":
      return "stroke-blue-500";
    case "entity-relation":
      return "stroke-indigo-500";
    case "record-entity":
      return "stroke-indigo-300";
    default:
      return "stroke-muted-foreground/30";
  }
}

export function KgCanvas({ nodes, edges, centerId, selectedId, onSelectNode, className }: KgCanvasProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const positions = useMemo(
    () =>
      computeForceLayout(
        nodes.map((n) => ({ id: n.id })),
        edges.map((e) => ({ source: e.source, target: e.target })),
        centerId ?? null,
        { width: WIDTH, height: HEIGHT },
      ),
    [nodes, edges, centerId],
  );

  // Fit the view to what was actually laid out. The force layout clamps to
  // its box, so a node on the boundary sat half outside a fixed viewBox and
  // its label was cut (seen on the first real browser pass, 51 records).
  const viewBox = useMemo(() => {
    const pts = Array.from(positions.values());
    if (pts.length === 0) return `${-WIDTH / 2} ${-HEIGHT / 2} ${WIDTH} ${HEIGHT}`;
    const PAD = 48;
    const minX = Math.min(...pts.map((p) => p.x)) - PAD;
    const maxX = Math.max(...pts.map((p) => p.x)) + PAD;
    const minY = Math.min(...pts.map((p) => p.y)) - PAD;
    const maxY = Math.max(...pts.map((p) => p.y)) + PAD;
    return `${minX} ${minY} ${Math.max(maxX - minX, 1)} ${Math.max(maxY - minY, 1)}`;
  }, [positions]);

  if (nodes.length === 0) return null;

  return (
    <svg
      viewBox={viewBox}
      role="img"
      aria-label="Complete knowledge graph. Solid nodes are active records, dashed are superseded, dotted are expired or disputed. A row-based Table view with the same data is available."
      className={cn("h-[560px] w-full rounded-md border border-border/60 bg-muted/10", className)}
      data-testid="kg-canvas"
    >
      <defs>
        <marker id="kg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="fill-blue-500" />
        </marker>
      </defs>

      {edges.map((edge) => {
        const from = positions.get(edge.source);
        const to = positions.get(edge.target);
        if (!from || !to) return null;
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        return (
          <g key={edge.id}>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className={edgeClass(edge.kind)}
              strokeWidth={edge.kind === "supersede" ? 2 : 1}
              strokeDasharray={edge.kind === "record-entity" ? "2 2" : undefined}
              markerEnd={edge.kind === "supersede" ? "url(#kg-arrow)" : undefined}
            />
            {edge.kind === "entity-relation" && (
              <text x={midX} y={midY} textAnchor="middle" className="pointer-events-none select-none fill-indigo-600 text-[8px] dark:fill-indigo-300">
                {edge.relationType}
              </text>
            )}
          </g>
        );
      })}

      {nodes.map((node) => {
        const p = positions.get(node.id);
        if (!p) return null;
        const r = RADIUS_BY_KIND[node.kind];
        const isSelected = node.id === selectedId;
        const isHovered = node.id === hovered;
        const commonProps = {
          transform: `translate(${p.x}, ${p.y})`,
          className: "cursor-pointer",
          tabIndex: 0,
          role: "button" as const,
          "aria-label": `${node.kind} ${node.label}${node.status ? `, ${node.status}` : ""}${node.problem ? ", flagged" : ""}`,
          "data-testid": `kg-node-${node.kind}`,
          onClick: () => onSelectNode(node),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectNode(node);
            }
          },
          onMouseEnter: () => setHovered(node.id),
          onMouseLeave: () => setHovered((h) => (h === node.id ? null : h)),
        };

        return (
          <g key={node.id} {...commonProps}>
            {node.kind === "entity" ? (
              <rect
                x={-r}
                y={-r}
                width={r * 2}
                height={r * 2}
                transform="rotate(45)"
                className={cn(
                  "fill-indigo-400/20 stroke-indigo-500 stroke-2",
                  (isSelected || isHovered) && "stroke-primary",
                )}
              />
            ) : node.kind === "namespace" ? (
              <circle
                r={r}
                className={cn(
                  "fill-muted stroke-muted-foreground/60 stroke-2",
                  (isSelected || isHovered) && "stroke-primary",
                )}
              />
            ) : node.kind === "subject" ? (
              <circle r={r} className={cn("fill-primary stroke-primary", isSelected && "stroke-[3px]")} />
            ) : (
              <circle
                r={r}
                strokeWidth={node.problem ? 3 : 2}
                strokeDasharray={recordDash(node.status)}
                className={cn(
                  recordFillClass(node.status),
                  node.problem && "stroke-amber-500",
                  (isSelected || isHovered) && "stroke-primary",
                )}
              />
            )}
            <text
              y={r + 12}
              textAnchor="middle"
              className="pointer-events-none select-none fill-foreground text-[9px]"
            >
              {truncate(node.label)}
              {node.count ? ` (${node.count})` : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function truncate(label: string): string {
  return label.length > 18 ? `${label.slice(0, 17)}…` : label;
}
