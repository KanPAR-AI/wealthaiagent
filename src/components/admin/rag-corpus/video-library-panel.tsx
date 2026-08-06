import { useCallback, useEffect, useState } from "react";
import { CorpusAssistantPanel } from "./corpus-assistant-panel";
import { LabellingPanel } from "./labelling-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReadersPicker } from "./studio/readers-picker";
import { Video, RefreshCw, Check, Upload, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { DocumentDetail } from "./document-detail";
import { ExtractPanel } from "./extract-panel";
import { PipelineFunnel, StageBadge } from "./corpus-pipeline";
import { SourcesPanel } from "./sources-panel";
import { CreateCorpus } from "./create-corpus";
import {
  fetchVideos,
  importVideos,
  patchVideo,
  fetchCorpora,
  fetchReprocessPlan,
  publishCorpus,
  type CorpusListing,
  type CorpusVideoDoc,
  type ReprocessPlan,
  type Funnel,
  type VideoState,
} from "@/services/corpus-video-service";

/**
 * The review queue for indexed videos.
 *
 * Most of this library was named automatically — read off a title card, or out
 * of the narration. A handful could not be: the footage shows "PHASE 2
 * EXERCISES" and then only countdown timers, and the extractor is deliberately
 * forbidden from guessing a name from the posture, because a guessed name is
 * indistinguishable from a read one once embedded and this corpus routes people
 * with arthritic knees toward movements.
 *
 * So those need a person, and what a person types WINS: a later re-index fills
 * blanks but never overwrites a human field. This panel makes that visible
 * rather than asking anyone to trust it.
 */

// "" = every state. It is first and it is the default because the panel used to
// open filtered to "Needs a name", so a corpus with nothing outstanding — the
// good case — greeted you with "Nothing in this state." over an empty list,
// which reads as an empty corpus rather than a finished one.
const STATES: { key: VideoState | ""; label: string }[] = [
  { key: "", label: "All" },
  { key: "unlabelled", label: "Needs a name" },
  { key: "translation_review", label: "Translation review" },
  { key: "labelled", label: "Done" },
];

export function VideoLibraryPanel({
  agentId,
  onBackToStudio,
  onOpenAsset,
}: {
  agentId: string;
  /** Present when rendered inside Corpus Studio; absent standalone. */
  onBackToStudio?: () => void;
  onOpenAsset?: (source: string) => void;
}) {
  // A corpus is addressed by its own id, not by an agent. `agentId` is only a
  // convenience default when the panel is opened from inside an agent's tab.
  const [corpusId, setCorpusId] = useState(agentId || "knee");
  const [state, setState] = useState<VideoState | "">("");
  const [kind, setKind] = useState("");   // "" = every source
  const [docs, setDocs] = useState<CorpusVideoDoc[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<string>("");
  const [readers, setReaders] = useState<string[]>([]);
  const [editingReaders, setEditingReaders] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishNote, setPublishNote] = useState("");
  const [funnel, setFunnel] = useState<Funnel | undefined>();
  // Which rows are expanded / selected. Selection feeds the batch
  // extraction: pick documents that share a subject, write the guidelines
  // once, and they all come back keyed the same way.
  const [open, setOpen] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  // Sources or items. Sources is the default because the early pipeline
  // stages act on a video, and that is where an unfinished corpus is.
  const [view, setView] = useState<"sources" | "items">("sources");
  const [corpora, setCorpora] = useState<CorpusListing[]>([]);
  const [plan, setPlan] = useState<ReprocessPlan | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const view = await fetchVideos(corpusId, state, kind);
      setDocs(view.documents);
      setSummary(view.summary);
      setReaders(view.readers || []);
      setFunnel(view.funnel);
    } catch (e) {
      // An empty list and a failed read look identical, and "nothing needs you"
      // is a reassuring thing to show when the truth is "we could not look".
      setError(e instanceof Error ? e.message : String(e));
      setDocs([]);
    } finally {
      setBusy(false);
    }
  }, [corpusId, state, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    fetchCorpora().then((r) => setCorpora(r.corpora)).catch(() => {});
  }, []);

  // What a re-extraction would cost. Pre-processing is content-addressed and
  // shared, so footage transcribed under one corpus is not transcribed again
  // under another — and this library has three byte-identical pairs.
  useEffect(() => {
    fetchReprocessPlan(corpusId).then(setPlan).catch(() => setPlan(null));
  }, [corpusId]);

  const save = async (doc: CorpusVideoDoc) => {
    const value = (draft[doc.id] ?? "").trim();
    if (!value) return;
    try {
      await patchVideo(corpusId, doc.doc_id || doc.id, "exercise", value);
      setSaved(doc.id);
      setDraft((d) => ({ ...d, [doc.id]: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-4">
      {onBackToStudio && (
        <button onClick={onBackToStudio}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          ‹ All corpora
        </button>
      )}

      {/* The front door. Someone arriving at 74 near-identical rows cannot see
          what is wrong with them; asking is the one interaction that scales to
          a corpus you did not build yourself. */}
      <CorpusAssistantPanel corpusId={corpusId} onChanged={load} />

      {/* Scopes everything below it, so it sits ABOVE the view toggle rather
          than inside one of the views — where it was unreachable from the
          other, making a freshly built corpus impossible to open. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Corpus
        </span>
        <select
          value={corpusId}
          onChange={(e) => setCorpusId(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
        >
          {!corpora.some((c) => c.corpus_id === corpusId) && (
            <option value={corpusId}>{corpusId}</option>
          )}
          {corpora.map((c) => (
            <option key={c.corpus_id} value={c.corpus_id}>
              {c.name || c.corpus_id} ({c.documents} docs)
              {c.unnamed ? " — no purpose recorded" : ""}
            </option>
          ))}
        </select>
        <CreateCorpus
          onCreated={async (id) => {
            // Refresh the list BEFORE selecting. Selecting first left the
            // picker rendering the fallback option — a bare id — for a corpus
            // that has a perfectly good name, until the fetch landed.
            try {
              const r = await fetchCorpora();
              setCorpora(r.corpora);
            } catch {
              /* the fallback option still shows the id, so it stays usable */
            }
            setCorpusId(id);
          }}
        />
        {plan && plan.sources > 0 && (
          <span className="text-[11px] text-muted-foreground">
            Re-extraction: {plan.note}
          </span>
        )}
      </div>

      <div className="flex gap-1.5">
        {([["sources", "By source"], ["items", "By item"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setView(k)}
            className={`rounded-full px-3 py-1 text-xs border transition-colors ${
              view === k ? "border-primary bg-primary/10 text-foreground"
                         : "border-border text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
        <span className="self-center text-[11px] text-muted-foreground">
          {view === "sources"
            ? "One row per video — transcribe and segment act here."
            : "One row per extracted item — naming and publishing act here."}
        </span>
      </div>

      {view === "sources" && (
        <SourcesPanel corpusId={corpusId} onChanged={load} onOpenAsset={onOpenAsset} />
      )}

      {view === "items" && (
        <ExtractPanel corpusId={corpusId} selected={picked} onDone={load} />
      )}

    {view === "items" && (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Video size={14} /> Items — {corpusId}
          <span className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try { await importVideos(corpusId); await load(); }
                      catch (e) { setError(e instanceof Error ? e.message : String(e)); }
                      finally { setBusy(false); }
                    }}>
              <RefreshCw size={13} className="mr-1" /> Re-import
            </Button>
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* WHAT STATE IS THIS CORPUS IN — before any list of rows.
            The page used to open with 74 near-identical rows and no way to tell
            whether any of it had reached an agent. "Indexed 0 of 74" is the
            first thing worth knowing and it was the one thing not shown. */}
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
            <span>
              <span className="font-medium tabular-nums">
                {(summary.total ?? 0) - (summary.pending_publish ?? 0)}
              </span>
              <span className="text-muted-foreground"> of {summary.total ?? 0} indexed</span>
            </span>
            {(summary.pending_publish ?? 0) > 0 && (
              <span className="text-amber-700 dark:text-amber-400">
                {summary.pending_publish} waiting to publish
              </span>
            )}
            {/* Reading it was never the problem — the panel has shown "no
                agent yet" for weeks. SETTING it had no control anywhere, so
                the warning named a fix nobody could apply. */}
            <button
              type="button"
              onClick={() => setEditingReaders((v) => !v)}
              data-testid="toggle-readers"
              className="text-muted-foreground underline-offset-2 hover:underline"
            >
              read by{" "}
              {readers.length ? (
                <span className="text-foreground">{readers.join(", ")}</span>
              ) : (
                <span className="text-amber-700 dark:text-amber-400">no agent yet</span>
              )}
            </button>
            <Button
              size="sm"
              className="ml-auto"
              disabled={publishing || !(summary.pending_publish ?? 0)}
              onClick={async () => {
                setPublishing(true);
                setPublishNote("");
                try {
                  const r = await publishCorpus(corpusId);
                  const held = Object.entries(r.held_back || {});
                  setPublishNote(
                    `Indexed ${r.documents_published} document(s) as ${r.chunks} chunk(s)` +
                      (held.length
                        ? ` — held back ${held.map(([k, v]) => `${v} ${k}`).join(", ")}`
                        : ""),
                  );
                  await load();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setPublishing(false);
                }
              }}
            >
              <Upload size={13} className="mr-1" />
              {publishing ? "Publishing…" : "Publish"}
            </Button>
          </div>
          {publishNote && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">{publishNote}</p>
          )}
          {/* Not a nag: a document nobody can name is one an agent would
              retrieve and be unable to say anything about. */}
          {(summary.unlabelled ?? 0) > 0 && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
              <AlertTriangle size={11} />
              {summary.unlabelled} document(s) nobody could name — these never publish.
            </p>
          )}
        </div>
          {editingReaders && (
            <div className="mt-2">
              <ReadersPicker
                corpusId={corpusId}
                readers={readers}
                published={(summary?.total ?? 0) > 0}
                onChange={setReaders}
              />
            </div>
          )}


        {/* Where the WORK is, before any list of rows. */}
        <PipelineFunnel funnel={funnel} />



        {/* Two different questions, so two labelled groups. They read as one
            undifferentiated row of chips otherwise, and nothing said they were
            combined rather than alternatives. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Status
          </span>
          {STATES.map((s) => (
            <button key={s.key} onClick={() => setState(s.key)}
              className={`rounded-full px-2.5 py-1 text-xs border transition-colors ${
                state === s.key
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}>
              {s.label}
              {/* "All" has no key of its own in the summary, so the generic
                  lookup rendered it as 0 — a filter labelled "All 0" over a
                  full list. */}
              <span className="ml-1.5 opacity-70">
                {s.key ? (summary[s.key] ?? 0) : (summary.total ?? 0)}
              </span>
            </button>
          ))}
          {/* A corpus holds footage AND text; the filter is a lens over one
              collection rather than a second collection, so a rule written
              once applies to both. */}
          <span className="ml-3 flex items-center gap-2 border-l border-border pl-3">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Source
            </span>
            {[
              { key: "", label: "All sources" },
              { key: "video", label: "Video" },
              { key: "pdf", label: "PDF" },
            ].map((k) => (
              <button key={k.key} onClick={() => setKind(k.key)}
                className={`rounded-full px-2.5 py-1 text-xs border transition-colors ${
                  kind === k.key
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}>
                {k.label}
                {k.key && <span className="ml-1.5 opacity-70">{summary[k.key] ?? 0}</span>}
              </button>
            ))}
          </span>
          <span className="ml-auto self-center text-xs text-muted-foreground">
            {summary.total ?? 0} documents
          </span>
        </div>

        {error && (
          <p className="text-xs text-rose-600 dark:text-rose-400">
            Could not load the queue ({error}) — this list may be incomplete.
          </p>
        )}

        {!error && !busy && docs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No documents match this filter.
          </p>
        )}

        <div className="space-y-2">
          {docs.slice(0, 60).map((d) => {
            const curated = d.provenance?.exercise?.source === "human";
            const key = d.doc_id || d.id;
            const isOpen = open === d.id;
            return (
              <div key={d.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {/* Selection drives the batch extraction above: pick the
                      documents that share a subject, write the guidelines once,
                      and every one comes back keyed the same way. */}
                  <input
                    type="checkbox"
                    checked={picked.includes(key)}
                    onChange={(e) =>
                      setPicked((p) =>
                        e.target.checked ? [...p, key] : p.filter((x) => x !== key))}
                    className="h-3.5 w-3.5 accent-primary"
                    aria-label={`select ${d.exercise || d.title}`}
                  />
                  <button
                    onClick={() => setOpen(isOpen ? "" : d.id)}
                    className="flex items-center gap-1 font-medium hover:underline"
                  >
                    {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {d.exercise || d.topic || d.title || "(unnamed)"}
                  </button>
                  <StageBadge stage={d.stage} />
                  {d.phase && (
                    <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-violet-600 dark:text-violet-400">
                      Phase {d.phase}
                    </span>
                  )}
                  {curated && (
                    <span
                      title={`Set by ${d.provenance?.exercise?.by} — a re-index will not overwrite it`}
                      className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-600 dark:text-emerald-400">
                      curated
                    </span>
                  )}
                  {d.language && d.language !== "en" && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-700 dark:text-amber-400">
                      {d.language}
                    </span>
                  )}
                  <span className="ml-auto text-muted-foreground">
                    {d.video_file} · {d.duration_s}s · {d.source}
                  </span>
                </div>

                {d.next_action && (
                  <p className="mt-1 text-[11px] text-muted-foreground">{d.next_action}</p>
                )}

                {(state === "unlabelled" || d.stage === "named") && (
                  <div className="mt-2 flex gap-2">
                    <input
                      value={draft[d.id] ?? ""}
                      onChange={(e) =>
                        setDraft((s) => ({ ...s, [d.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") void save(d); }}
                      placeholder="Name the exercise shown in this video"
                      className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
                    />
                    <Button size="sm" onClick={() => void save(d)}
                            disabled={!(draft[d.id] ?? "").trim()}>
                      {saved === d.id ? <Check size={13} /> : "Save"}
                    </Button>
                  </div>
                )}

                {isOpen && <DocumentDetail doc={d} corpusId={corpusId} onSaved={load} />}
              </div>
            );
          })}
        </div>

        {/* Whatever the current filter shows is what gets delegated -- the
            reviewer already narrowed to the documents that need a person, so
            asking them to re-select the same set would only introduce a way to
            get it wrong. */}
        <div className="mt-4">
          <LabellingPanel
            corpusId={corpusId}
            candidateIds={docs.map((d) => d.doc_id || d.id).filter(Boolean)}
          />
        </div>
      </CardContent>
    </Card>
    )}
    </div>
  );
}
