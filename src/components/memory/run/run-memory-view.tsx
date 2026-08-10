// components/memory/run/run-memory-view.tsx — Run Memory (UI_SPEC §19, UI-6).
// For ONE run: which memories were actually USED (drove a slot/tool/plan) vs
// merely RETRIEVED (surfaced, changed nothing). Both columns are real trace
// rows from the engine's usage projection (ADR-002) — the UI draws the
// distinction from the data, never inferring "used". Each row shows the
// memory's CURRENT label/value (a since-changed memory reads honestly) and
// deep-links to its inspector. All values render inert (T24).
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Check, Eye, ArrowLeft } from "lucide-react";
import {
  getRunMemory,
  MemoryEngineError,
  type RunMemory,
  type RunMemoryRow,
} from "@/services/memory-engine-service";
import { UntrustedText } from "@/components/memory/untrusted-text";
import { StatusBadge } from "@/components/memory/status-badge";
import { LoadingSkeleton } from "@/components/memory/loading-skeleton";
import { EmptyState } from "@/components/memory/empty-state";
import { ErrorState } from "@/components/memory/error-state";
import type { MemoryStatus } from "@/services/memory-engine-service";

type Status = "loading" | "success" | "error";

function Row({ row, used }: { row: RunMemoryRow; used: boolean }) {
  const label = row.predicate?.replace(/[._]/g, " ") ?? "(deleted memory)";
  return (
    <li className="rounded-md border border-border/60 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <Link
          to={`/chataiagent/memory/memories/${encodeURIComponent(row.memory_id)}`}
          className="font-medium capitalize text-primary hover:underline"
        >
          {label}
        </Link>
        <StatusBadge status={(row.status as MemoryStatus) ?? "active"} />
      </div>
      {row.current_value != null && (
        <div className="mt-1 text-xs text-muted-foreground">
          now:{" "}
          <UntrustedText sourceLabel="current value" inline>
            {String(row.current_value)}
          </UntrustedText>
        </div>
      )}
      {used && row.slot != null && (
        <div className="mt-1 text-xs text-muted-foreground">
          drove <span className="font-medium text-foreground">{row.slot}</span>
          {row.value != null && (
            <>
              {" = "}
              <UntrustedText sourceLabel="slot value" inline>
                {String(row.value)}
              </UntrustedText>
            </>
          )}
        </div>
      )}
    </li>
  );
}

export function RunMemoryView() {
  const { runId } = useParams<{ runId: string }>();
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<RunMemory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    let alive = true;
    setStatus("loading");
    getRunMemory(runId)
      .then((r) => {
        if (!alive) return;
        setData(r);
        setStatus("success");
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof MemoryEngineError ? err.message : "Could not load this run.");
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [runId]);

  if (status === "loading") return <LoadingSkeleton rows={6} />;
  if (status === "error") return <ErrorState message={error ?? undefined} />;
  if (!data) return null;

  const empty = data.used.length === 0 && data.retrieved.length === 0;

  return (
    <div className="space-y-5 p-4" data-testid="run-memory">
      <div className="flex items-center gap-2">
        <Link
          to="/chataiagent/memory/overview"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" /> Memory
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-sm font-semibold">Run memory</h1>
        <span className="truncate font-mono text-xs text-muted-foreground">{data.run_id}</span>
      </div>

      {empty ? (
        <EmptyState
          title="No memory in this run"
          description="No memories were retrieved or used in this run. Nothing is estimated — this reflects the real trace."
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          <section>
            <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
              <Check className="size-3.5 text-primary" aria-hidden="true" />
              Used ({data.used.length})
            </h2>
            {data.used.length === 0 ? (
              <p className="text-xs text-muted-foreground">No memory drove this run.</p>
            ) : (
              <ol className="space-y-2" data-testid="run-used">
                {data.used.map((r, i) => (
                  <Row key={`u-${r.memory_id}-${i}`} row={r} used />
                ))}
              </ol>
            )}
          </section>
          <section>
            <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
              <Eye className="size-3.5" aria-hidden="true" />
              Retrieved, not used ({data.retrieved.length})
            </h2>
            {data.retrieved.length === 0 ? (
              <p className="text-xs text-muted-foreground">Every retrieved memory was used.</p>
            ) : (
              <ol className="space-y-2" data-testid="run-retrieved">
                {data.retrieved.map((r, i) => (
                  <Row key={`r-${r.memory_id}-${i}`} row={r} used={false} />
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
