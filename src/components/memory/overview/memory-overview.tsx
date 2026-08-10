// components/memory/overview/memory-overview.tsx — Overview screen (UI_SPEC
// §6-7). Real aggregates from GET /memory/overview: active-memory summary,
// memory-by-domain, needs-attention, recent changes. NO vanity metrics; the
// "used" metric is deliberately absent until the UI-6 usage projection
// (retrieval ≠ use). Every number comes from the backend; nothing computed.
import { useNavigate } from "react-router-dom";
import { Brain, Sparkles, AlertTriangle, GitBranch } from "lucide-react";
import { useMemoryOverview } from "@/hooks/memory/use-memory-overview";
import { LoadingSkeleton } from "@/components/memory/loading-skeleton";
import { ErrorState } from "@/components/memory/error-state";
import { EmptyState } from "@/components/memory/empty-state";
import { StatusBadge } from "@/components/memory/status-badge";
import { SourceBadge } from "@/components/memory/source-badge";
import { cn } from "@/lib/utils";

function StatCard({ label, value, icon: Icon, hint }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; hint?: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        <span className="text-xs font-medium uppercase">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function MemoryOverview() {
  const { status, data, error, refetch } = useMemoryOverview();
  const navigate = useNavigate();

  if (status === "loading") return <LoadingSkeleton rows={6} />;
  if (status === "error") return <ErrorState message={error ?? undefined} onRetry={refetch} />;
  if (!data) return null;

  const domains = Object.entries(data.by_namespace).sort((a, b) => b[1] - a[1]);
  const isEmpty = data.active_count === 0 && data.recent_changes.length === 0;

  if (isEmpty) {
    return (
      <EmptyState
        title="No memories yet"
        description="Memories appear when you explicitly ask the system to remember something, or when allowed durable facts are learned."
      />
    );
  }

  return (
    <div className="space-y-6" data-testid="memory-overview">
      {/* Active-memory summary */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Active" value={data.active_count} icon={Brain} />
        <StatCard label="Inferred" value={data.inferred_count} icon={Sparkles} hint="not user-confirmed" />
        <StatCard label="Superseded" value={data.superseded_count} icon={GitBranch} />
        <StatCard label="New this week" value={data.new_this_week} icon={Sparkles} />
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Memory by domain */}
        <section>
          <h2 className="mb-2 text-sm font-semibold">Memory by domain</h2>
          {domains.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active memories.</p>
          ) : (
            <ul className="space-y-1.5">
              {domains.map(([ns, count]) => (
                <li key={ns}>
                  <button
                    onClick={() => navigate(`/memory/memories?namespace=${encodeURIComponent(ns)}`)}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                  >
                    <span className="capitalize">{ns}</span>
                    <span className="tabular-nums text-muted-foreground">{count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Needs attention */}
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <AlertTriangle className="size-4 text-amber-500" aria-hidden="true" />
            Needs attention
          </h2>
          {data.inferred_count === 0 && data.disputed_count === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing needs review.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {data.inferred_count > 0 && (
                <li>
                  <button onClick={() => navigate("/memory/inbox")} className="text-left hover:underline">
                    {data.inferred_count} inferred {data.inferred_count === 1 ? "memory" : "memories"} awaiting review
                  </button>
                </li>
              )}
              {data.disputed_count > 0 && (
                <li>
                  <button onClick={() => navigate("/memory/memories?status=disputed")} className="text-left hover:underline">
                    {data.disputed_count} disputed {data.disputed_count === 1 ? "memory" : "memories"}
                  </button>
                </li>
              )}
            </ul>
          )}
        </section>
      </div>

      {/* Recent changes */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">Recent changes</h2>
        <ul className="divide-y divide-border/50">
          {data.recent_changes.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => navigate(`/memory/memories/${encodeURIComponent(r.id)}`)}
                className={cn("flex w-full items-center gap-2 py-2 text-left text-sm hover:bg-muted/30")}
              >
                <StatusBadge status={r.status} />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium capitalize">{(r.predicate ?? "memory").replace(/[._]/g, " ")}</span>
                  {r.value != null && <span className="text-muted-foreground"> → {String(r.value)}</span>}
                </span>
                <SourceBadge source={r.source_type} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-muted-foreground">
        A "used" metric (memory that actually influenced a run) arrives with the Run
        Memory view — retrieval alone is not use.
      </p>
    </div>
  );
}
