// components/memory/inspector/inspector-evidence-tab.tsx — Inspector Evidence
// (UI_SPEC §15-16, UI-35). Explains WHY a memory exists via its evidence
// records. Every excerpt is UNTRUSTED and rendered inert (UntrustedText).
// A server-withheld (sensitive) row shows "protected", never the content —
// a memory can be visible while its protected evidence is not (UI-35). The
// data comes from a real backend endpoint; nothing is fabricated.
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import {
  getEvidenceForMemory,
  MemoryEngineError,
  type EvidenceRow,
} from "@/services/memory-engine-service";
import { UntrustedText } from "@/components/memory/untrusted-text";
import { LoadingSkeleton } from "@/components/memory/loading-skeleton";
import { EmptyState } from "@/components/memory/empty-state";
import { ErrorState } from "@/components/memory/error-state";
import { trackMemoryEvent } from "@/lib/memory-telemetry";

const TYPE_LABEL: Record<string, string> = {
  message: "User message",
  document: "Document",
  tool_result: "Tool result",
  run_trace: "Run",
  human_feedback: "Human feedback",
};

type Status = "loading" | "success" | "forbidden" | "error";

export function InspectorEvidenceTab({ memoryId }: { memoryId: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [rows, setRows] = useState<EvidenceRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    trackMemoryEvent("memory_evidence_opened", { memory_id: memoryId });
    getEvidenceForMemory(memoryId)
      .then((r) => {
        if (!alive) return;
        setRows(r.evidence);
        setStatus("success");
      })
      .catch((err: unknown) => {
        if (!alive) return;
        if (err instanceof MemoryEngineError && err.status === 403) {
          setStatus("forbidden"); // no memory.read_evidence — backend refused
          return;
        }
        setError(err instanceof MemoryEngineError ? err.message : "Could not load evidence.");
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [memoryId]);

  if (status === "loading") return <LoadingSkeleton rows={3} />;
  if (status === "forbidden")
    return <EmptyState title="Evidence is protected" description="You don't have permission to view the evidence behind this memory." />;
  if (status === "error") return <ErrorState message={error ?? undefined} />;
  if (rows.length === 0)
    return <EmptyState title="No evidence recorded" description="This memory has no linked evidence." />;

  return (
    <div className="space-y-4" data-testid="inspector-evidence">
      <p className="text-xs font-semibold uppercase text-muted-foreground">Why this is remembered</p>
      {rows.map((ev) => (
        <div key={ev.id} className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{TYPE_LABEL[ev.type] ?? ev.type}</span>
            {ev.observed_at && <span>{new Date(ev.observed_at).toLocaleDateString()}</span>}
          </div>
          {ev.withheld ? (
            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
              <Lock className="size-3.5" aria-hidden="true" />
              Protected — you don't have access to this excerpt.
            </div>
          ) : (
            <UntrustedText sourceLabel={TYPE_LABEL[ev.type] ?? ev.type}>
              {ev.excerpt || "(no excerpt)"}
            </UntrustedText>
          )}
        </div>
      ))}
    </div>
  );
}
