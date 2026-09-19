// components/memory/full-graph/kg-inspector.tsx — the node inspector panel
// for the Full Knowledge Graph (§4 of the page spec): every field of the
// selected record VERBATIM, its supersede chain in order with dates, its
// entity links, and deep links to the EXISTING per-memory screens (the
// Memories Inspector's History/Usage/Evidence tabs, and the bounded
// 1-hop Graph page for an entity) — this panel does NOT re-implement any
// of those, only links to them.
import { Link } from "react-router-dom";
import { X, ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/memory/status-badge";
import { ValidityRange } from "@/components/memory/validity-range";
import { ExpandableValue } from "@/components/memory/expandable-value";
import { UntrustedText } from "@/components/memory/untrusted-text";
import type { Entity, MemoryRecord } from "@/services/memory-engine-service";
import type { KgNode, SupersedeChain } from "@/lib/knowledge-graph-assembly";

export interface KgInspectorProps {
  node: KgNode | null;
  record: MemoryRecord | null;
  chain: SupersedeChain | null;
  chainRecords: MemoryRecord[];
  linkedEntities: Entity[];
  entity: Entity | null;
  namespaceCount: number | null;
  onClose: () => void;
  onFilterNamespace?: (namespace: string) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function KgInspector({
  node,
  record,
  chain,
  chainRecords,
  linkedEntities,
  entity,
  namespaceCount,
  onClose,
  onFilterNamespace,
}: KgInspectorProps) {
  const open = !!node;

  return (
    <Sheet open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[480px]" aria-label="Knowledge graph node inspector">
        {node && (
          <>
            <SheetHeader className="border-b px-5 py-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <SheetTitle className="text-sm capitalize">{node.kind}: {node.label}</SheetTitle>
                  <SheetDescription className="sr-only">
                    Full verbatim details for this knowledge-graph node.
                  </SheetDescription>
                </div>
                <Button variant="ghost" size="icon" className="size-7" onClick={onClose} aria-label="Close inspector">
                  <X className="size-4" />
                </Button>
              </div>
            </SheetHeader>

            <div className="space-y-4 overflow-y-auto px-5 py-4 text-sm" data-testid="kg-inspector">
              {node.kind === "record" && record && (
                <>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={record.status} />
                    <span className="text-xs text-muted-foreground">v{record.version}</span>
                  </div>
                  <Field label="Namespace">{record.namespace}</Field>
                  <Field label="Predicate">{record.predicate ?? "—"}</Field>
                  <Field label="Subject">
                    <UntrustedText inline>{record.subject?.text ?? "—"}</UntrustedText>
                  </Field>
                  <Field label="Value">
                    <ExpandableValue value={record.value} />
                  </Field>
                  <Field label="Text">
                    <UntrustedText>{record.text || "(no text)"}</UntrustedText>
                  </Field>
                  <Field label="Valid">
                    <ValidityRange validFrom={record.valid_from} validUntil={record.valid_until} />
                  </Field>
                  <Field label="Confidence / Authority / Importance">
                    {Math.round(record.confidence * 100)}% / {Math.round(record.authority * 100)}% /{" "}
                    {Math.round(record.importance * 100)}%
                  </Field>
                  <Field label="Source type">{record.source_type}</Field>
                  <Field label="Observed / Created / Updated">
                    {record.observed_at ?? "—"} / {record.created_at ?? "—"} / {record.updated_at ?? "—"}
                  </Field>
                  <Field label="Tags">{record.tags.length ? record.tags.join(", ") : "—"}</Field>
                  <Field label="Pinned">{record.pinned ? "Yes" : "No"}</Field>
                  <Field label="ID">
                    <span className="font-mono text-xs">{record.id}</span>
                  </Field>

                  <Field label="Supersede chain">
                    {chain ? (
                      <ol className="flex flex-col gap-1">
                        {chainRecords.map((r, i) => (
                          <li
                            key={r.id}
                            className={`flex items-center gap-2 rounded px-1.5 py-0.5 text-xs ${
                              r.id === record.id ? "bg-primary/10 font-medium" : "text-muted-foreground"
                            }`}
                          >
                            <span>{i + 1}.</span>
                            <StatusBadge status={r.status} />
                            <span>{r.valid_from ?? r.created_at ?? "—"}</span>
                            {r.id === record.id && <span>(this record)</span>}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <span className="text-xs text-muted-foreground">No supersession recorded for this record.</span>
                    )}
                  </Field>

                  <Field label="Entity links">
                    {linkedEntities.length ? (
                      <ul className="flex flex-col gap-1">
                        {linkedEntities.map((e) => (
                          <li key={e.id}>
                            <Link to={`/memory/graph?entity=${encodeURIComponent(e.id)}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                              <UntrustedText inline>{e.canonical_name}</UntrustedText>
                              <ExternalLink className="size-3" aria-hidden="true" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-muted-foreground">No entity_ids on this record.</span>
                    )}
                  </Field>

                  <Link
                    to={`/memory/memories/${encodeURIComponent(record.id)}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-xs font-medium hover:bg-muted/40"
                  >
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                    Open full inspector (Details · History · Evidence · Usage)
                  </Link>
                </>
              )}

              {node.kind === "entity" && (
                <>
                  <Field label="Canonical name">
                    <UntrustedText inline>{entity?.canonical_name ?? node.label}</UntrustedText>
                  </Field>
                  <Field label="Type">{entity?.entity_type ?? "—"}</Field>
                  <Field label="Aliases">{entity?.aliases.length ? entity.aliases.join(", ") : "—"}</Field>
                  <Field label="ID">
                    <span className="font-mono text-xs">{node.entityId}</span>
                  </Field>
                  <Link
                    to={`/memory/graph?entity=${encodeURIComponent(node.entityId ?? "")}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-xs font-medium hover:bg-muted/40"
                  >
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                    Open bounded 1-hop Graph view
                  </Link>
                </>
              )}

              {node.kind === "namespace" && (
                <>
                  <Field label="Namespace">{node.namespace}</Field>
                  <Field label="Records here">{node.count ?? namespaceCount ?? "—"}</Field>
                  {onFilterNamespace && node.namespace && (
                    <Button variant="outline" size="sm" onClick={() => onFilterNamespace(node.namespace!)}>
                      Filter to this namespace
                    </Button>
                  )}
                </>
              )}

              {node.kind === "subject" && (
                <Field label="Subject">
                  <UntrustedText inline>{node.label}</UntrustedText>
                </Field>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
