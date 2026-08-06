// One corpus, as the dashboard shows it (docs/25 screen 1).
//
// The card leads with a STATUS and a completion ring rather than a document
// count, because the question somebody scanning this page is asking is "which
// of these needs me?" — and "74 documents" does not answer it.
//
// Five statuses, not three. `unreachable` — indexed, verified, and no agent
// subscribed — is separated from `needs_review` deliberately: both look
// unfinished, and the fix is completely different. One needs a person to name
// something; the other needs a reader added, which takes a second.

import { AlertTriangle, Check, Clock, Loader2, Users } from "lucide-react";

import type { CorpusCard as Card } from "@/services/corpus-video-service";
import { formatDuration } from "./format";

const STATUS: Record<string, { label: string; tone: string }> = {
  published: {
    label: "Published",
    tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  processing: {
    label: "Processing",
    tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  needs_review: {
    label: "Needs Review",
    tone: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  },
  unreachable: {
    label: "No reader",
    tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
  draft: { label: "Draft", tone: "bg-muted text-muted-foreground" },
};

/** The completion ring. SVG rather than a bar because the mockup shows a ring,
 *  and because a ring reads as "how far round" at a glance where a thin bar at
 *  card width does not. */
function Ring({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  const r = 16;
  const circumference = 2 * Math.PI * r;
  const tone =
    pct === 1 ? "stroke-emerald-500" : pct === 0 ? "stroke-rose-400" : "stroke-amber-400";
  return (
    <div className="relative h-11 w-11 shrink-0">
      <svg viewBox="0 0 40 40" className="h-11 w-11 -rotate-90">
        <circle cx="20" cy="20" r={r} className="fill-none stroke-muted" strokeWidth="4" />
        <circle
          cx="20" cy="20" r={r}
          className={`fill-none ${tone} transition-all`}
          strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[10px] font-semibold tabular-nums">
        {Math.round(pct * 100)}%
      </span>
    </div>
  );
}

export function CorpusCard({
  card,
  onOpen,
}: {
  card: Card;
  onOpen: (corpusId: string) => void;
}) {
  const status = STATUS[card.status] ?? STATUS.draft;

  return (
    <button
      // Keyed on the ID, not the display name. A card shows "Dr David Knee
      // Program" while the corpus is `knee_timed`, so any test or deep link
      // matching on text breaks the moment somebody renames it.
      data-testid={`corpus-card-${card.corpus_id}`}
      onClick={() => onOpen(card.corpus_id)}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:border-primary/60"
    >
      {/* No cover images exist yet, so this is a deterministic tint derived
          from the id rather than a grey box or a stock photo — a placeholder
          that pretends to be artwork is worse than one that does not. */}
      <div
        className="relative h-24 w-full"
        style={{
          background: `linear-gradient(135deg, hsl(${
            (card.corpus_id.length * 47) % 360
          } 55% 55% / 0.35), hsl(${(card.corpus_id.length * 47 + 60) % 360} 55% 45% / 0.2))`,
        }}
      >
        <span
          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${status.tone}`}
        >
          {status.label}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <p className="truncate text-sm font-medium">{card.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {card.sources} {card.sources === 1 ? "source" : "sources"} ·{" "}
            {card.language.toUpperCase()}
          </p>
        </div>

        <div className="mt-auto flex items-center gap-2.5">
          <Ring value={card.completion} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{card.headline}</p>

            {card.status === "processing" && card.eta_seconds ? (
              <p className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                <Loader2 size={10} className="animate-spin" />
                about {formatDuration(card.eta_seconds)} left
              </p>
            ) : card.issues ? (
              <p className="flex items-center gap-1 text-[11px] text-orange-700 dark:text-orange-400">
                <AlertTriangle size={10} />
                {card.issues} {card.issues === 1 ? "issue" : "issues"}
              </p>
            ) : card.status === "unreachable" ? (
              // Spelled out because "no reader" is meaningless to somebody who
              // has not read the architecture, and the fix is one click.
              <p className="flex items-center gap-1 text-[11px] text-rose-700 dark:text-rose-400">
                <AlertTriangle size={10} /> indexed, but no agent reads it
              </p>
            ) : card.status === "published" ? (
              <p className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                <Check size={10} /> {card.readers.join(", ")}
              </p>
            ) : (
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock size={10} /> {card.pending_publish} waiting to publish
              </p>
            )}
          </div>

          {card.readers.length > 0 && (
            <span
              title={card.readers.join(", ")}
              className="flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              <Users size={9} />
              {card.readers.length}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
