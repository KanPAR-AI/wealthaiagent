// Steps 3, 4 and 5 — Schema, Review, Publish (docs/25 screen 2's stepper).
//
// One file because they are the same shape: read something the backend already
// computes, show it, offer the one action that moves forward. Splitting them
// into three would be three copies of the same loading and error handling.
//
// SCHEMA: the interesting output is `unsupported`
//
// A schema engine that only ever proposes fields will happily propose
// `contraindication` over footage that never mentions one, and the corpus then
// extracts a column of nulls that reads as a processing failure rather than an
// absence in the source. So `unsupported` is rendered first-class, not as an
// afterthought below the fields.
//
// REVIEW: this is the step that says "do not publish yet"
//
// Sources without timings are the specific defect that made this whole surface
// a no-op — an untimed transcript looks identical on screen, and only a timed
// one can be cut into spans. Publishing a corpus of untimed sources produces
// documents that all carry the same blob of text and compete for every query.
//
// PUBLISH: four outcomes, not two
//
// `published_unreachable` — indexed, verified, and no agent subscribes — is
// reported as its own thing, because calling that "published" is exactly the
// softness that let a corpus reach no answer for weeks while every step said
// OK.

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, Rocket } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  fetchSources,
  publishCorpus,
  suggestSchema,
  type PublishResult,
  type SchemaSuggestion,
  type SourceSummary,
} from "@/services/corpus-video-service";

// ── step 3 ──────────────────────────────────────────────────────────────────

export function SchemaStep({
  corpusId,
  onContinue,
}: {
  corpusId: string;
  onContinue: () => void;
}) {
  const [data, setData] = useState<SchemaSuggestion | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setData(await suggestSchema(corpusId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [corpusId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="max-w-3xl space-y-3">
      <div>
        <h3 className="text-sm font-medium">What to extract from every item</h3>
        <p className="text-xs text-muted-foreground">
          Proposed from your purpose <em>and</em> from what your media actually
          contains — which is why it can also say what it cannot support.
        </p>
      </div>

      {busy && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" /> reading your sources…
        </p>
      )}
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      {data && (
        <>
          <div className="space-y-1.5">
            {data.fields.map((f) => (
              <div key={f.name} className="rounded-lg border border-border px-2.5 py-2">
                <p className="text-xs font-medium">{f.name}</p>
                <p className="text-[11px] text-muted-foreground">{f.instruction}</p>
                {f.why && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    why: {f.why}
                  </p>
                )}
              </div>
            ))}
            {data.fields.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nothing proposed. That usually means no source has a usable
                transcript yet.
              </p>
            )}
          </div>

          {data.unsupported?.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-2.5 py-2">
              <p className="flex items-center gap-1.5 text-xs font-medium">
                <AlertTriangle size={12} /> Your media cannot support these
              </p>
              <ul className="mt-1 space-y-1.5">
                {data.unsupported.map((u, i) => (
                  // Keyed by index: `wanted` is free prose from a model and two
                  // entries can legitimately repeat a phrase, which would
                  // collapse them into one row.
                  <li key={i} className="text-[11px]">
                    <span className="font-medium">{u.wanted}</span>
                    <p className="text-muted-foreground">{u.why_not}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                Extracting one anyway produces a column of nulls, which reads as
                a processing failure rather than an absence in your source.
              </p>
            </div>
          )}

          {data.note && (
            <p className="text-[11px] text-muted-foreground">{data.note}</p>
          )}
        </>
      )}

      <Button size="sm" onClick={onContinue} disabled={busy}>
        Continue →
      </Button>
    </div>
  );
}

// ── step 4 ──────────────────────────────────────────────────────────────────

export function ReviewStep({
  corpusId,
  onContinue,
}: {
  corpusId: string;
  onContinue: () => void;
}) {
  const [summary, setSummary] = useState<SourceSummary | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setSummary((await fetchSources(corpusId)).summary);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    })();
  }, [corpusId]);

  const blocked = (summary?.needs_retranscribe ?? 0) > 0;

  return (
    <div className="max-w-3xl space-y-3">
      <div>
        <h3 className="text-sm font-medium">Check before the whole corpus runs</h3>
        <p className="text-xs text-muted-foreground">
          Publishing writes vectors. Fixing a source afterwards means writing
          them again.
        </p>
      </div>

      {busy && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" /> checking…
        </p>
      )}
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      {summary && (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Sources", summary.sources],
              ["Items", summary.items],
              ["With transcript", summary.with_transcript],
              ["With timings", summary.with_timings],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-md border border-border px-2 py-1.5">
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</dt>
                <dd className="text-sm font-medium tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>

          {blocked && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-2.5 py-2">
              <p className="flex items-center gap-1.5 text-xs font-medium">
                <AlertTriangle size={12} />
                {summary.needs_retranscribe} source
                {summary.needs_retranscribe === 1 ? "" : "s"} without timings
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                An untimed transcript looks identical on screen and cannot be
                cut into spans, so every item from that source carries the same
                block of text and they compete for the same query. Re-transcribe
                them from the corpus view first.
              </p>
            </div>
          )}

          {summary.no_speech > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {summary.no_speech} source{summary.no_speech === 1 ? " has" : "s have"} no
              speech — those are named from on-screen text instead, which is
              expected rather than a fault.
            </p>
          )}
        </>
      )}

      <Button size="sm" onClick={onContinue} disabled={busy}>
        {blocked ? "Publish anyway →" : "Continue →"}
      </Button>
    </div>
  );
}

// ── step 5 ──────────────────────────────────────────────────────────────────

const OUTCOME: Record<string, { label: string; tone: string; blurb: string }> = {
  published: {
    label: "Published",
    tone: "border-emerald-500/40 bg-emerald-500/5",
    blurb: "Indexed, verified, and an agent can retrieve from it.",
  },
  published_unreachable: {
    label: "Published, but unreachable",
    tone: "border-rose-500/40 bg-rose-500/5",
    blurb:
      "Indexed and verified — and no agent subscribes to it, so nothing can " +
      "retrieve from it yet. Set readers on the corpus.",
  },
  published_unverified: {
    label: "Published, not verified",
    tone: "border-amber-500/40 bg-amber-500/5",
    blurb: "The vectors were written but a retrieval check did not come back clean.",
  },
  published_failed_evaluation: {
    label: "Published, failing its own questions",
    tone: "border-amber-500/40 bg-amber-500/5",
    blurb:
      "Indexed, but it does not answer the questions you said it must. The " +
      "vectors are correct and are kept — what must not happen is calling it done.",
  },
  nothing_publishable: {
    label: "Nothing was published",
    tone: "border-amber-500/40 bg-amber-500/5",
    blurb:
      "Every document was held back, so no vectors were written and nothing " +
      "can retrieve from this corpus. See what was held back below — the usual " +
      "cause is items nobody has labelled yet.",
  },
};

// The fallback for a status this build has never heard of. NOT "published" —
// defaulting an unknown outcome to the successful one is how a wizard came to
// announce "indexed, verified, and an agent can retrieve from it" over a corpus
// with zero chunks and zero readers.
const UNKNOWN = {
  label: "Finished, with an outcome this page does not recognise",
  tone: "border-amber-500/40 bg-amber-500/5",
  blurb:
    "The publish ran and reported something this version of the studio does " +
    "not know how to describe. The numbers below are what it actually did.",
};

export function PublishStep({
  corpusId,
  onFinish,
}: {
  corpusId: string;
  onFinish: () => void;
}) {
  const [result, setResult] = useState<(PublishResult & { status?: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const go = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setResult(await publishCorpus(corpusId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [corpusId]);

  // Numbers first, label second. A corpus that wrote no chunks did not
  // publish, whatever the payload calls it — believing the label over the count
  // is how "0 documents, 0 chunks" got announced as a success.
  const outcome = !result
    ? null
    : result.chunks === 0 && result.documents_published === 0
      ? OUTCOME.nothing_publishable
      : OUTCOME[result.status ?? ""] ?? UNKNOWN;

  return (
    <div className="max-w-3xl space-y-3">
      <div>
        <h3 className="text-sm font-medium">Index it, and prove an agent can reach it</h3>
        <p className="text-xs text-muted-foreground">
          Publishing is not the last step — reaching an answer is. This runs a
          retrieval check afterwards and reports what it found.
        </p>
      </div>

      {!result && (
        <Button size="sm" onClick={() => void go()} disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={13} className="mr-1 animate-spin" /> Publishing…
            </>
          ) : (
            <>
              <Rocket size={13} className="mr-1" /> Publish
            </>
          )}
        </Button>
      )}

      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      {result && outcome && (
        <>
          <div className={`rounded-lg border px-3 py-2 ${outcome.tone}`}>
            <p className="flex items-center gap-1.5 text-xs font-medium">
              {outcome === OUTCOME.published ? <Check size={13} /> : <AlertTriangle size={13} />}
              {outcome.label}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {outcome.blurb}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              ["Documents", result.documents_published],
              ["Chunks", result.chunks],
              ["Readers", result.readers?.length ?? 0],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-md border border-border px-2 py-1.5">
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</dt>
                <dd className="text-sm font-medium tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>

          {Object.keys(result.held_back ?? {}).length > 0 && (
            <div className="rounded-lg border border-border px-2.5 py-2">
              <p className="text-xs font-medium">Held back</p>
              <ul className="mt-1 space-y-0.5">
                {Object.entries(result.held_back).map(([why, n]) => (
                  <li key={why} className="text-[11px] text-muted-foreground">
                    {n} — {why.replace(/_/g, " ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button size="sm" onClick={onFinish}>
            Open the corpus →
          </Button>
        </>
      )}
    </div>
  );
}
