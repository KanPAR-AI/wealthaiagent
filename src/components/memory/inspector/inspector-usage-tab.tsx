// components/memory/inspector/inspector-usage-tab.tsx — Inspector Usage
// (UI_SPEC §17-18, UI-6). Where this memory was RETRIEVED vs where it was
// actually USED. "Used" is the strong claim — it drove a slot/tool/plan in a
// real run — and it comes from the engine's usage projection (ADR-002), never
// inferred here from a retrieval. A retrieval that changed nothing is shown
// honestly as "retrieved, not used". No fabricated counts.
import { useEffect, useState } from "react";
import { Check, Eye } from "lucide-react";
import {
  getUsageForMemory,
  MemoryEngineError,
  type UsageEvent,
} from "@/services/memory-engine-service";
import { UntrustedText } from "@/components/memory/untrusted-text";
import { LoadingSkeleton } from "@/components/memory/loading-skeleton";
import { EmptyState } from "@/components/memory/empty-state";
import { ErrorState } from "@/components/memory/error-state";
import { cn } from "@/lib/utils";

type Status = "loading" | "success" | "error";

function fmt(ts: string): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleString();
}

export function InspectorUsageTab({ memoryId }: { memoryId: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [rows, setRows] = useState<UsageEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    getUsageForMemory(memoryId)
      .then((r) => {
        if (!alive) return;
        setRows(r.usage);
        setStatus("success");
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof MemoryEngineError ? err.message : "Could not load usage.");
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [memoryId]);

  if (status === "loading") return <LoadingSkeleton rows={3} />;
  if (status === "error") return <ErrorState message={error ?? undefined} />;
  if (rows.length === 0)
    return (
      <EmptyState
        title="Never used yet"
        description="This memory hasn't been retrieved or used in any run. Retrieval and use are recorded as they happen — nothing is estimated."
      />
    );

  const usedCount = rows.filter((r) => r.outcome === "used").length;

  return (
    <div className="space-y-4" data-testid="inspector-usage">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Check className="size-3.5 text-primary" aria-hidden="true" />
          Used {usedCount}
        </span>
        <span className="flex items-center gap-1.5">
          <Eye className="size-3.5" aria-hidden="true" />
          Retrieved {rows.length - usedCount}
        </span>
      </div>
      {/* An honest reminder — retrieval is not use (UI_SPEC §17). */}
      <p className="text-xs text-muted-foreground">
        “Used” means this memory actually drove a slot, tool, or plan in a run.
        A retrieval that changed nothing is not counted as use.
      </p>
      <ol className="space-y-2" data-testid="usage-list">
        {rows.map((ev, i) => {
          const used = ev.outcome === "used";
          return (
            <li
              key={`${ev.run_id}-${ev.ts}-${i}`}
              className={cn(
                "rounded-md border p-3 text-sm",
                used ? "border-primary/40 bg-primary/5" : "border-border/60",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium">
                  {used ? (
                    <Check className="size-3.5 text-primary" aria-hidden="true" />
                  ) : (
                    <Eye className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  )}
                  {used ? "Used" : "Retrieved"}
                  <span className="font-normal text-muted-foreground">
                    · {ev.stage.replace(/_/g, " ")}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">{fmt(ev.ts)}</span>
              </div>
              {used && ev.slot != null && (
                <div className="mt-1.5 text-xs text-muted-foreground">
                  filled <span className="font-medium text-foreground">{ev.slot}</span>
                  {ev.value != null && (
                    <>
                      {" = "}
                      <UntrustedText sourceLabel="slot value" inline>
                        {String(ev.value)}
                      </UntrustedText>
                    </>
                  )}
                </div>
              )}
              <a
                href={`/chataiagent/memory/run/${encodeURIComponent(ev.run_id)}`}
                className="mt-1.5 inline-block text-xs text-primary hover:underline"
              >
                View run →
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
