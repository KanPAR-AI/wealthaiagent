/**
 * What this agent will know — chosen from corpora that already exist.
 *
 * WHY THIS EXISTS
 *
 * The agent builder mentioned "corpus" exactly once, in a hardcoded
 * description string. There was no step, tool or prompt section that listed
 * the corpora already built, so the one genuinely useful thing the builder
 * could say to somebody creating a knowledge agent — "subscribe this to
 * `knee_timed`, it already holds 116 documents" — was unsayable.
 *
 * The result was two disconnected halves: a Corpus Studio that builds
 * knowledge nothing reads, and an agent builder that creates agents which know
 * nothing. Binding them was an API call neither screen offered.
 *
 * WHY THE SUBSCRIPTION IS APPLIED AFTER CREATION
 *
 * The subscription lives on the CORPUS (`readers: [...]`), not on the agent
 * (docs/21 §2) — so it cannot be written until the agent has an id. The
 * selection is collected here and applied by the wizard once the agent exists.
 * A partial failure is reported rather than swallowed: an agent created with
 * none of its knowledge attached, reported as success, is exactly the silent
 * half-done state this whole area keeps producing.
 */

import { useEffect, useState } from "react";
import { AlertTriangle, BookOpen, Check, Loader2 } from "lucide-react";

import { fetchCorpora, type CorpusListing } from "@/services/corpus-video-service";

const GROUNDING = [
  {
    id: "corpus_only",
    label: "Only from these corpora",
    blurb:
      "Says plainly when they do not cover a question, instead of answering " +
      "from the model's own knowledge. Recommended.",
  },
  {
    id: "corpus_first",
    label: "Prefer these, allow general knowledge",
    blurb: "May go beyond the corpora, but must label which part it made up.",
  },
  {
    id: "blended",
    label: "No constraint",
    blurb:
      "Blends corpora and the model's own knowledge indistinguishably. An " +
      "empty or stale corpus then answers exactly like a good one.",
  },
] as const;

interface Props {
  selected: string[];
  onChange: (corpusIds: string[]) => void;
  grounding: string;
  onGroundingChange: (mode: string) => void;
}

export function CorpusStep({
  selected,
  onChange,
  grounding,
  onGroundingChange,
}: Props) {
  const [corpora, setCorpora] = useState<CorpusListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetchCorpora()
      .then((r) => alive && setCorpora(r.corpora || []))
      .catch((e) => alive && setError(String(e?.message || e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <BookOpen size={15} /> Knowledge
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Corpora this agent may retrieve from. A corpus is shared — subscribing
          does not copy it, and several agents can read the same one. You can
          change this later from the corpus itself.
        </p>
      </div>

      {loading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" /> Looking for corpora…
        </p>
      )}

      {error && (
        <p className="text-xs text-rose-400" role="alert">
          Could not list corpora: {error}
        </p>
      )}

      {!loading && !error && corpora.length === 0 && (
        <div className="flex items-start gap-2 rounded border border-border/60 p-2 text-xs text-muted-foreground">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            No corpora exist yet. Build one in Corpus Studio, then come back —
            or create this agent now and subscribe it afterwards.
          </span>
        </div>
      )}

      <div className="space-y-1.5" data-testid="corpus-options">
        {corpora.map((c) => {
          const on = selected.includes(c.corpus_id);
          return (
            <button
              key={c.corpus_id}
              type="button"
              onClick={() => toggle(c.corpus_id)}
              data-testid={`corpus-${c.corpus_id}`}
              aria-pressed={on}
              className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition ${
                on
                  ? "border-emerald-500/50 bg-emerald-500/10"
                  : "border-border/60 hover:border-border"
              }`}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {on && <Check size={12} className="text-emerald-400" />}
                  {c.name || c.corpus_id}
                </span>
                {c.purpose && (
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {c.purpose}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {c.documents} doc{c.documents === 1 ? "" : "s"}
                {c.readers.length > 0 && ` · read by ${c.readers.length}`}
              </span>
            </button>
          );
        })}
      </div>

      {selected.length === 0 && corpora.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Nothing selected — this agent will answer from its prompt alone, with
          no corpus to ground it.
        </p>
      )}

      {/* SHOWN, not buried in a config file. The default is corpus_only and it
          changes what the agent is allowed to say, so somebody creating an
          agent should see that decision rather than inherit it silently. */}
      <div className="space-y-1.5 border-t border-border/60 pt-3">
        <p className="text-sm font-medium">When the corpora do not have the answer</p>
        {GROUNDING.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onGroundingChange(g.id)}
            data-testid={`grounding-${g.id}`}
            aria-pressed={grounding === g.id}
            className={`flex w-full flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition ${
              grounding === g.id
                ? "border-emerald-500/50 bg-emerald-500/10"
                : "border-border/60 hover:border-border"
            }`}
          >
            <span className="flex items-center gap-1.5 text-sm">
              {grounding === g.id && <Check size={12} className="text-emerald-400" />}
              {g.label}
            </span>
            <span className="text-[11px] leading-snug text-muted-foreground">
              {g.blurb}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
