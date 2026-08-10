// components/memory/graph/graph-canvas.tsx — GraphCanvas (UI_SPEC §27-30).
// SVG rendering of the engine's 1-hop neighborhood using a hand-rolled
// force layout (lib/graph-force-layout.ts, no new dependency). Interactions:
// click a node to re-center (expand that node's own neighborhood — never a
// deeper server traversal, MUI-0027), click an edge to open the
// EdgeInspector. This is the visual view; GraphTable renders the SAME data
// as an accessible fallback (MUI-0030/UI-28) and is the default on mobile.
import { useMemo, useState } from "react";
import { computeForceLayout } from "@/lib/graph-force-layout";
import { cn } from "@/lib/utils";
import type { GraphEdge, GraphNode } from "@/services/memory-engine-service";

export interface GraphCanvasProps {
  centerId: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSelectNode: (nodeId: string) => void;
  onSelectEdge: (edgeId: string) => void;
  selectedEdgeId?: string | null;
  className?: string;
}

const WIDTH = 480;
const HEIGHT = 340;
const NODE_RADIUS = 18;

export function GraphCanvas({
  centerId,
  nodes,
  edges,
  onSelectNode,
  onSelectEdge,
  selectedEdgeId,
  className,
}: GraphCanvasProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Pure, deterministic geometry over the engine's own nodes/edges — no
  // semantics computed here, only where a circle sits on screen.
  const positions = useMemo(
    () =>
      computeForceLayout(
        nodes.map((n) => ({ id: n.entity_id })),
        edges.map((e) => ({ source: e.source, target: e.target })),
        centerId,
        { width: WIDTH, height: HEIGHT },
      ),
    [nodes, edges, centerId],
  );

  const byId = useMemo(() => new Map(nodes.map((n) => [n.entity_id, n])), [nodes]);
  const byIdLabel = (id: string): string => byId.get(id)?.label ?? id;

  if (nodes.length === 0) return null;

  return (
    <svg
      viewBox={`${-WIDTH / 2} ${-HEIGHT / 2} ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="Entity relationship graph. A table alternative with the same data is available via the Table view."
      className={cn("h-[340px] w-full rounded-md border border-border/60 bg-muted/10", className)}
      data-testid="graph-canvas"
    >
      {edges.map((edge) => {
        const from = positions.get(edge.source);
        const to = positions.get(edge.target);
        if (!from || !to) return null;
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        const selected = edge.id === selectedEdgeId;
        return (
          <g key={edge.id}>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className={cn(
                "cursor-pointer stroke-muted-foreground/40 transition-colors hover:stroke-primary",
                selected && "stroke-primary",
              )}
              strokeWidth={selected ? 2.5 : 1.5}
              tabIndex={0}
              role="button"
              aria-label={`Edge: ${byIdLabel(edge.source)} ${edge.relation_type} ${byIdLabel(edge.target)}`}
              onClick={() => onSelectEdge(edge.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectEdge(edge.id);
                }
              }}
            />
            {/* Relation-type label — SVG text is escaped by React the same
                as any other text node (T24); no markdown/HTML renderer
                touches it. */}
            <text
              x={midX}
              y={midY}
              textAnchor="middle"
              className="pointer-events-none select-none fill-muted-foreground text-[9px]"
            >
              {edge.relation_type}
            </text>
          </g>
        );
      })}

      {nodes.map((node) => {
        const p = positions.get(node.entity_id);
        if (!p) return null;
        const isCenter = node.entity_id === centerId;
        return (
          <g
            key={node.entity_id}
            transform={`translate(${p.x}, ${p.y})`}
            className="cursor-pointer"
            tabIndex={0}
            role="button"
            aria-label={`${node.label} (${node.type})${isCenter ? ", center of this view" : ""} — select to re-center the graph`}
            onClick={() => onSelectNode(node.entity_id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectNode(node.entity_id);
              }
            }}
            onMouseEnter={() => setHoveredNode(node.entity_id)}
            onMouseLeave={() => setHoveredNode((h) => (h === node.entity_id ? null : h))}
          >
            <circle
              r={isCenter ? NODE_RADIUS + 4 : NODE_RADIUS}
              className={cn(
                "stroke-2 transition-colors",
                isCenter ? "fill-primary stroke-primary" : "fill-background stroke-primary/60",
                hoveredNode === node.entity_id && !isCenter && "stroke-primary",
              )}
            />
            <text
              textAnchor="middle"
              dy="4"
              className={cn(
                "pointer-events-none select-none text-[10px] font-medium",
                isCenter ? "fill-primary-foreground" : "fill-foreground",
              )}
            >
              {initials(node.label)}
            </text>
            <text
              y={isCenter ? NODE_RADIUS + 18 : NODE_RADIUS + 14}
              textAnchor="middle"
              className="pointer-events-none select-none fill-foreground text-[10px]"
            >
              {truncateLabel(node.label)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function initials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function truncateLabel(label: string): string {
  return label.length > 16 ? `${label.slice(0, 15)}…` : label;
}
