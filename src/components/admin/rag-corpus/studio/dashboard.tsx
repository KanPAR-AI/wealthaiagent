// Corpus Studio — Home (docs/25 screen 1).
//
// The page answers three questions in the order somebody actually asks them:
// what do I have, what needs me, and what is happening right now. The old
// Corpus tab opened with a list of 74 near-identical rows, which answers none
// of them.

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, Loader2, Plus, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  fetchActivity,
  fetchDashboard,
  fetchProcessingQueue,
  type ActivityEvent,
  type CorpusCard as Card,
  type QueueRow,
} from "@/services/corpus-video-service";
import { CorpusCard } from "./corpus-card";
import { relativeTime } from "./format";

export function StudioHome({
  onOpenCorpus,
  onCreate,
}: {
  onOpenCorpus: (corpusId: string) => void;
  onCreate: () => void;
}) {
  const [cards, setCards] = useState<Card[]>([]);
  const [totals, setTotals] = useState({ corpora: 0, processing: 0, needs_review: 0, unreachable: 0 });
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      // Three independent reads. One failing must not blank the other two —
      // a dashboard that goes empty because an activity feed timed out reads
      // as "you have no corpora", which is the worst thing it could say.
      const [dash, act, q] = await Promise.allSettled([
        fetchDashboard(),
        fetchActivity(12),
        fetchProcessingQueue(),
      ]);
      if (dash.status === "fulfilled") {
        setCards(dash.value.corpora);
        setTotals(dash.value.totals);
      } else {
        setError(String(dash.reason?.message ?? dash.reason));
      }
      if (act.status === "fulfilled") setEvents(act.value.events);
      if (q.status === "fulfilled") setQueue(q.value.queue);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start gap-3">
        <div>
          <h2 className="text-lg font-semibold">Corpus Studio</h2>
          <p className="text-xs text-muted-foreground">
            Build, review and publish knowledge corpora your agents can answer from.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={busy}>
            <RefreshCw size={13} className={`mr-1 ${busy ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={onCreate}>
            <Plus size={14} className="mr-1" /> New corpus
          </Button>
        </div>
      </header>

      {/* What needs attention, before anything else. Zero of something is not
          shown at all — a row of green zeroes trains people to stop reading. */}
      {(totals.needs_review > 0 || totals.unreachable > 0 || totals.processing > 0) && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
          {totals.processing > 0 && (
            <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
              <Loader2 size={11} className="animate-spin" /> {totals.processing} processing
            </span>
          )}
          {totals.needs_review > 0 && (
            <span className="flex items-center gap-1 text-orange-700 dark:text-orange-400">
              <AlertTriangle size={11} /> {totals.needs_review} need a person
            </span>
          )}
          {totals.unreachable > 0 && (
            <span className="flex items-center gap-1 text-rose-700 dark:text-rose-400">
              <AlertTriangle size={11} /> {totals.unreachable} indexed but unread by any agent
            </span>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400">
          Could not load corpora ({error}) — this list may be incomplete.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            My corpora
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((c) => (
              <CorpusCard key={c.corpus_id} card={c} onOpen={onOpenCorpus} />
            ))}

            <button
              onClick={onCreate}
              className="flex min-h-[11rem] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              <Plus size={18} />
              <span className="text-xs font-medium">New corpus</span>
              <span className="text-[11px]">Start from what it should do</span>
            </button>
          </div>
          {!busy && !cards.length && !error && (
            <p className="mt-3 text-xs text-muted-foreground">
              No corpora yet. A corpus starts with what you want it to answer,
              not with an upload.
            </p>
          )}
        </section>

        <aside className="space-y-4">
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Loader2 size={11} /> Processing
              {queue.length > 0 && (
                <span className="rounded-full bg-amber-500/15 px-1.5 text-[10px] text-amber-700 dark:text-amber-400">
                  {queue.length} active
                </span>
              )}
            </h3>
            {queue.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Nothing in flight.</p>
            ) : (
              <div className="space-y-1.5">
                {queue.slice(0, 6).map((r) => (
                  <div key={r.job_id} className="rounded-md border border-border px-2.5 py-1.5">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-[11px] font-medium">{r.source}</span>
                      <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                        {r.percent}%
                      </span>
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">{r.stage}</p>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-amber-400 transition-all"
                        style={{ width: `${Math.max(r.percent, 2)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Activity size={11} /> Recent activity
            </h3>
            {events.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Nothing yet.</p>
            ) : (
              <div className="space-y-2">
                {events.map((e, i) => (
                  <button
                    key={`${e.at}-${i}`}
                    onClick={() => e.corpus_id && onOpenCorpus(e.corpus_id)}
                    className="block w-full text-left"
                  >
                    <p className="truncate text-[11px] font-medium">{e.title}</p>
                    <p className="flex gap-1.5 text-[11px] text-muted-foreground">
                      {e.detail && <span className="truncate">{e.detail}</span>}
                      <span className="ml-auto shrink-0">{relativeTime(e.at)}</span>
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
