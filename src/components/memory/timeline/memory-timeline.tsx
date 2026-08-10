// components/memory/timeline/memory-timeline.tsx — Timeline (UI_SPEC §25-26).
// The temporal value-history of ONE fact slot: horizontal validity bars on a
// time axis, PLUS a required event-LIST alternative (accessibility skill —
// non-visual users get the same information). All validity windows are engine
// outputs; nothing temporal is computed client-side. A fact is chosen via
// namespace + predicate (from the URL, so it's deep-linkable).
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { List, GanttChartSquare } from "lucide-react";
import {
  getTimeline,
  MemoryEngineError,
  type TimelineSpan,
} from "@/services/memory-engine-service";
import { LoadingSkeleton } from "@/components/memory/loading-skeleton";
import { ErrorState } from "@/components/memory/error-state";
import { EmptyState } from "@/components/memory/empty-state";
import { StatusBadge } from "@/components/memory/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function fmt(ts: string | null): string {
  if (!ts) return ts === null ? "" : "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleDateString();
}

type View = "chart" | "list";

export function MemoryTimeline() {
  const [params] = useSearchParams();
  const namespace = params.get("namespace") ?? "";
  const predicate = params.get("predicate") ?? "";
  const [view, setView] = useState<View>("chart");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [spans, setSpans] = useState<TimelineSpan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!namespace || !predicate) {
      setStatus("idle");
      return;
    }
    let alive = true;
    setStatus("loading");
    getTimeline(namespace, predicate)
      .then((r) => {
        if (!alive) return;
        setSpans(r.spans);
        setStatus("success");
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof MemoryEngineError ? err.message : "Could not load the timeline.");
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [namespace, predicate, reloadKey]);

  // Compute a shared time domain for the bars (display geometry only, not a
  // memory semantic — validity windows themselves come from the backend).
  const domain = useMemo(() => {
    const times: number[] = [];
    for (const s of spans) {
      if (s.valid_from) times.push(new Date(s.valid_from).getTime());
      times.push(s.valid_until ? new Date(s.valid_until).getTime() : Date.now());
    }
    if (times.length === 0) return null;
    const min = Math.min(...times);
    const max = Math.max(...times, Date.now());
    return { min, max, span: Math.max(1, max - min) };
  }, [spans]);

  if (!namespace || !predicate) {
    return (
      <EmptyState
        title="Pick a fact to see its history"
        description="Open a memory and use its History, or navigate here with ?namespace=…&predicate=… to see how a value changed over time."
      />
    );
  }
  if (status === "loading" || status === "idle") return <LoadingSkeleton rows={4} />;
  if (status === "error")
    return <ErrorState message={error ?? undefined} onRetry={() => setReloadKey((k) => k + 1)} />;
  if (spans.length === 0) {
    return <EmptyState title="No history for this fact" description="This fact has no recorded value history (it may have been forgotten)." />;
  }

  return (
    <div className="space-y-4" data-testid="memory-timeline">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold capitalize">{predicate.replace(/[._]/g, " ")} — history</h2>
        {/* View toggle: chart ↔ accessible list (both show the same data) */}
        <div className="flex gap-1" role="group" aria-label="Timeline view">
          <Button variant={view === "chart" ? "secondary" : "ghost"} size="sm" className="gap-1.5" onClick={() => setView("chart")} aria-pressed={view === "chart"}>
            <GanttChartSquare className="size-3.5" aria-hidden="true" /> Chart
          </Button>
          <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" className="gap-1.5" onClick={() => setView("list")} aria-pressed={view === "list"}>
            <List className="size-3.5" aria-hidden="true" /> List
          </Button>
        </div>
      </div>

      {view === "chart" && domain ? (
        <div className="space-y-2" role="img" aria-label="Value validity periods over time. A list alternative is available via the List view.">
          {spans.map((s) => {
            const start = s.valid_from ? new Date(s.valid_from).getTime() : domain.min;
            const end = s.valid_until ? new Date(s.valid_until).getTime() : domain.max;
            const left = ((start - domain.min) / domain.span) * 100;
            const width = Math.max(2, ((end - start) / domain.span) * 100);
            return (
              <div key={s.id} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 truncate font-medium">{String(s.value ?? s.text)}</span>
                <div className="relative h-6 flex-1 rounded bg-muted/30">
                  <div
                    className={cn(
                      "absolute top-0 h-6 rounded",
                      s.status === "active" ? "bg-primary/70" : "bg-muted-foreground/40",
                    )}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${fmt(s.valid_from)} → ${s.valid_until ? fmt(s.valid_until) : "current"}`}
                  />
                </div>
                <StatusBadge status={s.status} />
              </div>
            );
          })}
        </div>
      ) : (
        // Accessible event-list alternative (required — accessibility skill).
        <ol className="divide-y divide-border/50" data-testid="timeline-list">
          {spans.map((s) => (
            <li key={s.id} className="flex items-center gap-2 py-2 text-sm">
              <span className="font-medium">{String(s.value ?? s.text)}</span>
              <span className="text-muted-foreground">
                {fmt(s.valid_from)} → {s.valid_until ? fmt(s.valid_until) : "current"}
              </span>
              <StatusBadge status={s.status} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
