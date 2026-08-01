// The corpus as a pipeline, not a list.
//
// A list of 74 documents that all look equally finished cannot say what state
// the WORK is in. Every knee document had been transcribed, none had been
// segmented, none had been indexed — and the page said none of that, so the
// next action was unguessable unless you already knew the system.
//
// Stages come from the server, derived from each document. Nothing here decides
// what a stage means; it only draws it.

import { AlertTriangle, Check } from "lucide-react";

import type { Funnel } from "@/services/corpus-video-service";

const STAGE_TONE: Record<string, string> = {
  ingested: "bg-muted text-muted-foreground",
  read: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  segmented: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  named: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  published: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  complete: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

/** A document's badge names the earliest stage it has NOT cleared — the thing
 *  to act on — so the label reads as "waiting for". `published` is the one
 *  terminal state, so it reads as done. */
export function StageBadge({ stage }: { stage?: string }) {
  if (!stage) return null;
  // `published` means NEEDS publishing — it is the stage not yet cleared.
  // Only `complete` is done. Treating them as one drew a green tick over a
  // corpus where nothing had been indexed.
  const done = stage === "complete";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
        STAGE_TONE[stage] || STAGE_TONE.ingested
      }`}
    >
      {done && <Check size={9} />}
      {done ? "published" : stage === "rejected" ? "rejected" : `needs ${stage}`}
    </span>
  );
}

export function PipelineFunnel({ funnel }: { funnel?: Funnel }) {
  if (!funnel?.total) return null;
  const stages = funnel.stages.filter((s) => s.key !== "ingested");
  // The stage the most documents are waiting on. This is the corpus's actual
  // bottleneck, and naming it is the whole reason for drawing a funnel rather
  // than five numbers.
  const bottleneck = Object.entries(funnel.stuck_at)
    .filter(([k]) => k !== "complete" && k !== "rejected")
    .sort((a, b) => b[1] - a[1])[0];
  const blocked = bottleneck && funnel.stages.find((s) => s.key === bottleneck[0]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-stretch gap-1.5">
        {stages.map((s) => {
          const cleared = funnel.cleared[s.key] ?? 0;
          const pct = Math.round((cleared / funnel.total) * 100);
          return (
            <div
              key={s.key}
              title={s.blurb}
              className="min-w-[7.5rem] flex-1 rounded-md border border-border bg-background px-2.5 py-1.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-medium">{s.label}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {cleared}/{funnel.total}
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${
                    pct === 100 ? "bg-emerald-500" : pct === 0 ? "bg-rose-400" : "bg-amber-400"
                  }`}
                  style={{ width: `${Math.max(pct, pct === 0 ? 0 : 4)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {blocked && (
        <p className="flex items-start gap-1.5 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-medium">
              {bottleneck![1]} document(s) are waiting on {blocked.label.toLowerCase()}.
            </span>{" "}
            {blocked.next}
          </span>
        </p>
      )}
    </div>
  );
}
