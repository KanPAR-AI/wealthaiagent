// components/memory/graph/edge-inspector.tsx — EdgeInspector (UI_SPEC
// §27-30, MUI-0029): the relationship, its validity window, confidence,
// and evidence for ONE selected edge. All fields are the engine's own
// Relation record (gateway.neighborhood, MUI-1010) — nothing here is
// derived client-side. Entity/relation text renders via UntrustedText
// (T24) — a relation between two entities is still memory-adjacent data,
// not an instruction.
import { X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ValidityRange } from "@/components/memory/validity-range";
import { UntrustedText } from "@/components/memory/untrusted-text";
import type { GraphEdge, GraphNode } from "@/services/memory-engine-service";

export interface EdgeInspectorProps {
  edge: GraphEdge | null;
  sourceNode: GraphNode | null;
  targetNode: GraphNode | null;
  open: boolean;
  onClose: () => void;
}

export function EdgeInspector({ edge, sourceNode, targetNode, open, onClose }: EdgeInspectorProps) {
  return (
    <Sheet open={open && !!edge} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[420px]" aria-label="Edge Inspector">
        {edge && (
          <>
            <SheetHeader className="border-b px-5 py-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <SheetTitle className="text-sm">Relationship</SheetTitle>
                  <SheetDescription className="sr-only">
                    Details for the selected graph edge, including validity window and evidence.
                  </SheetDescription>
                </div>
                <Button variant="ghost" size="icon" className="size-7" onClick={onClose} aria-label="Close edge inspector">
                  <X className="size-4" />
                </Button>
              </div>
            </SheetHeader>

            <div className="space-y-4 px-5 py-4 text-sm" data-testid="edge-inspector">
              <div className="flex flex-wrap items-center gap-1.5">
                <UntrustedText inline>{sourceNode?.label ?? edge.source}</UntrustedText>
                <span className="text-muted-foreground">—</span>
                <UntrustedText inline>{edge.relation_type}</UntrustedText>
                <span className="text-muted-foreground">→</span>
                <UntrustedText inline>{targetNode?.label ?? edge.target}</UntrustedText>
              </div>

              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Valid</div>
                <ValidityRange validFrom={edge.valid_from} validUntil={edge.valid_until} />
              </div>

              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Status</div>
                <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-xs capitalize">
                  {edge.status}
                </span>
              </div>

              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Confidence</div>
                <span className="text-sm">{Math.round(edge.confidence * 100)}%</span>
              </div>

              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Evidence</div>
                {edge.evidence_id ? (
                  <span className="font-mono text-xs text-muted-foreground" data-testid="edge-evidence-id">
                    {edge.evidence_id}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">No evidence recorded for this relationship.</span>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
