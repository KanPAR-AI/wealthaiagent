// components/memory/graph/graph-table.tsx — GraphTable (UI_SPEC §27-30,
// MUI-0030, UI-28/A11Y-03). A real HTML <table> carrying the SAME edges the
// canvas shows — a screen-reader user gets identical information, not a
// degraded summary, and it doubles as the mobile default (RESPONSIVE_SPEC
// "mobile graph→table default", no separate mobile-only component). Every
// row is keyboard-operable (native <button>s, no custom widget/roving
// tabindex needed for a table this size).
import { ExternalLink } from "lucide-react";
import { ValidityRange } from "@/components/memory/validity-range";
import { UntrustedText } from "@/components/memory/untrusted-text";
import type { GraphEdge, GraphNode } from "@/services/memory-engine-service";

export interface GraphTableProps {
  edges: GraphEdge[];
  nodesById: Map<string, GraphNode>;
  onSelectEdge: (edgeId: string) => void;
  onSelectEntity: (entityId: string) => void;
}

export function GraphTable({ edges, nodesById, onSelectEdge, onSelectEntity }: GraphTableProps) {
  const label = (id: string) => nodesById.get(id)?.label ?? id;

  return (
    <div className="overflow-x-auto rounded-md border border-border/60" data-testid="graph-table">
      <table className="w-full text-sm">
        <caption className="sr-only">Entity relationships in this neighborhood</caption>
        <thead className="bg-muted/30 text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              Source
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Relationship
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Target
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Valid
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Confidence
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {edges.map((edge) => (
            <tr key={edge.id}>
              <td className="px-3 py-2">
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => onSelectEntity(edge.source)}
                >
                  <UntrustedText inline>{label(edge.source)}</UntrustedText>
                </button>
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                <UntrustedText inline>{edge.relation_type}</UntrustedText>
              </td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => onSelectEntity(edge.target)}
                >
                  <UntrustedText inline>{label(edge.target)}</UntrustedText>
                </button>
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                <ValidityRange validFrom={edge.valid_from} validUntil={edge.valid_until} />
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{Math.round(edge.confidence * 100)}%</td>
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => onSelectEdge(edge.id)}
                  aria-label={`View details for ${label(edge.source)} ${edge.relation_type} ${label(edge.target)}`}
                >
                  <ExternalLink className="size-3" aria-hidden="true" />
                  Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {edges.length === 0 && (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">No relationships in this neighborhood.</p>
      )}
    </div>
  );
}
