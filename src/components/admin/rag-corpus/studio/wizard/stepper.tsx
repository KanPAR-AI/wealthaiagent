// Purpose → Sources → Schema → Review → Publish (docs/25 screens 2-3).
//
// The stepper is not decoration. The old create form asked for a name and a
// purpose and then dropped you into a panel stack with no indication that
// anything else was required — so corpora were routinely created, never given
// sources, and sat as drafts nobody remembered starting. Naming the five steps
// up front is the cheapest fix for that.
//
// Steps behind you are clickable; steps ahead are not. Going back to change a
// purpose is normal and should cost one click. Skipping forward past sources
// you have not added produces a schema proposal with no media to read, which
// is the "column of nulls" failure the schema engine exists to prevent.

import { Check } from "lucide-react";

export interface Step {
  key: string;
  label: string;
  blurb: string;
}

export function Stepper({
  steps,
  current,
  furthest,
  onGo,
}: {
  steps: Step[];
  current: number;
  furthest: number;
  onGo: (index: number) => void;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
      {steps.map((s, i) => {
        const done = i < furthest;
        const active = i === current;
        const reachable = i <= furthest;
        return (
          <li key={s.key} className="flex items-center gap-1">
            <button
              onClick={() => reachable && onGo(i)}
              disabled={!reachable}
              title={s.blurb}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : reachable
                    ? "text-foreground hover:bg-muted"
                    : "cursor-not-allowed text-muted-foreground/50"
              }`}
            >
              <span
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-semibold ${
                  active
                    ? "bg-primary-foreground/20"
                    : done
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <Check size={9} /> : i + 1}
              </span>
              {s.label}
            </button>
            {i < steps.length - 1 && (
              <span className="text-muted-foreground/40" aria-hidden>
                ›
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
