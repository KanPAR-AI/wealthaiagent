/**
 * Progress that cannot lie.
 *
 * WHY THIS FILE HAS RULES
 *
 * The corpus dashboard spent weeks showing a spinner and "about 5m left" over
 * 74 finished documents that were never going to move. Nothing was processing.
 * The status logic could not tell "work in flight" from "work nobody started",
 * so it animated over both — and an animation is a promise that something is
 * happening.
 *
 * That is worse than showing nothing. Silence makes a person look; a spinner
 * makes them wait.
 *
 * So every bar here obeys four rules:
 *
 *   1. A DETERMINATE bar moves only when the server reported a new number.
 *      No easing toward 90%, no synthetic creep while waiting.
 *   2. Work of unknown length gets an INDETERMINATE shimmer and an elapsed
 *      clock — never a percentage nobody computed.
 *   3. A bar that stops receiving updates SAYS SO and stops animating. This is
 *      the direct fix for the five-minute estimate that never expired.
 *   4. Progress never goes backwards, because a bar that retreats reads as a
 *      failure even when the number is more honest.
 *
 * Motion is CSS-only and respects prefers-reduced-motion: an admin screen that
 * pulses at somebody with vestibular sensitivity is not "engaging".
 */

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";

/** No server update for this long, while still claiming to run, means the bar
 *  should stop pretending. Generous, because transcription genuinely goes
 *  quiet for a while — the point is to catch minutes, not seconds. */
const STALL_AFTER_MS = 90_000;

export interface StageProgressProps {
  /** 0-100 from the server, or null for work of unknown length. */
  percent?: number | null;
  /** What is happening right now, in the server's words. */
  stage?: string;
  /** ISO timestamp of the last real update, for staleness. */
  updatedAt?: string | null;
  /** Terminal states stop every animation and settle the bar. */
  done?: boolean;
  failed?: boolean;
  label?: string;
  /** When the work started, so an indeterminate bar can show elapsed time. */
  startedAt?: number;
  compact?: boolean;
}

function useNow(active: boolean, everyMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [active, everyMs]);
  return now;
}

function elapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m}m ${s % 60}s` : `${m}m`;
}

export function StageProgress({
  percent = null,
  stage = "",
  updatedAt = null,
  done = false,
  failed = false,
  label = "",
  startedAt,
  compact = false,
}: StageProgressProps) {
  const running = !done && !failed;
  const now = useNow(running);

  // RULE 4 — monotonic. A server that recomputes and reports a smaller number
  // is being more honest, but a bar that retreats reads as a failure.
  const high = useRef(0);
  const value = percent === null || percent === undefined ? null : percent;
  if (value !== null && value > high.current) high.current = value;
  const shown = done ? 100 : value === null ? null : high.current;

  // RULE 3 — a bar that stopped hearing anything says so.
  const lastUpdate = updatedAt ? Date.parse(updatedAt) : null;
  const stalled =
    running && lastUpdate !== null && now - lastUpdate > STALL_AFTER_MS;

  const tone = failed
    ? "bg-rose-500"
    : stalled
      ? "bg-amber-500"
      : done
        ? "bg-emerald-500"
        : "bg-primary";

  return (
    <div className="w-full" data-testid="stage-progress">
      {!compact && (label || stage) && (
        <div className="mb-1 flex items-baseline gap-2 text-[11px]">
          {label && <span className="font-medium">{label}</span>}
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {failed ? "failed" : done ? "done" : stage}
          </span>
          {/* A NUMBER ONLY WHEN THERE IS ONE. Work of unknown length shows how
              long it has been going instead of a percentage invented to fill
              the space. */}
          {shown !== null ? (
            <span className="tabular-nums text-muted-foreground">{Math.round(shown)}%</span>
          ) : startedAt && running ? (
            <span className="tabular-nums text-muted-foreground">
              {elapsed(now - startedAt)}
            </span>
          ) : null}
        </div>
      )}

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        {shown === null && running && !stalled ? (
          // RULE 2 — indeterminate. A travelling band claims motion and nothing
          // about how much is left.
          <div className={`h-full w-1/3 rounded-full ${tone} motion-safe:animate-[cs-slide_1.4s_ease-in-out_infinite] motion-reduce:w-full motion-reduce:opacity-60`} />
        ) : (
          <div
            className={`h-full rounded-full ${tone} motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out`}
            style={{ width: `${shown === null ? 100 : Math.min(100, shown)}%` }}
            data-testid="stage-progress-bar"
          />
        )}
      </div>

      {stalled && (
        <p
          className="mt-1 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400"
          data-testid="stage-progress-stalled"
        >
          <AlertTriangle size={10} />
          No update for {elapsed(now - (lastUpdate ?? now))} — this may have
          stopped.
        </p>
      )}

      <style>{`@keyframes cs-slide {
        0%   { transform: translateX(-100%); }
        100% { transform: translateX(400%); }
      }`}</style>
    </div>
  );
}

/**
 * A named-stage rail: the steps this job goes through, which one it is on.
 *
 * Shown because "62%" answers "how long" and not "what is it doing" — and when
 * something stalls, the stage name is the only thing that tells you where.
 */
export function StageRail({
  stages,
  current,
  done = false,
}: {
  stages: string[];
  current: string;
  done?: boolean;
}) {
  const at = stages.findIndex(
    (s) => s.toLowerCase() === (current || "").toLowerCase(),
  );
  return (
    <ol className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1" data-testid="stage-rail">
      {stages.map((s, i) => {
        const passed = done || (at >= 0 && i < at);
        const now = !done && at === i;
        return (
          <li
            key={s}
            className={`flex items-center gap-1 text-[11px] ${
              passed
                ? "text-emerald-600 dark:text-emerald-400"
                : now
                  ? "text-foreground"
                  : "text-muted-foreground/50"
            }`}
          >
            {passed ? (
              <Check size={10} />
            ) : now ? (
              <Loader2 size={10} className="motion-safe:animate-spin" />
            ) : (
              <span className="h-1 w-1 rounded-full bg-current opacity-50" />
            )}
            {s}
          </li>
        );
      })}
    </ol>
  );
}
