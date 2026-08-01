import { useCallback, useEffect, useState } from "react";
import { LabellingPanel } from "./labelling-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, RefreshCw, Check } from "lucide-react";
import {
  fetchVideos,
  importVideos,
  patchVideo,
  type CorpusVideoDoc,
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

const STATES: { key: VideoState; label: string }[] = [
  { key: "unlabelled", label: "Needs a name" },
  { key: "translation_review", label: "Translation review" },
  { key: "labelled", label: "Done" },
];

export function VideoLibraryPanel({ agentId }: { agentId: string }) {
  // A corpus is addressed by its own id, not by an agent. `agentId` is only a
  // convenience default when the panel is opened from inside an agent's tab.
  const [corpusId, setCorpusId] = useState(agentId || "knee");
  const [state, setState] = useState<VideoState>("unlabelled");
  const [kind, setKind] = useState("");   // "" = every source
  const [docs, setDocs] = useState<CorpusVideoDoc[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<string>("");

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const view = await fetchVideos(corpusId, state, kind);
      setDocs(view.documents);
      setSummary(view.summary);
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Video size={14} /> Video library — {corpusId}
          <span className="ml-auto flex items-center gap-2">
            <input
              value={corpusId}
              onChange={(e) => setCorpusId(e.target.value)}
              placeholder="corpus id"
              className="w-28 rounded-md border border-border bg-background px-2 py-1 text-xs"
            />
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
        <div className="flex flex-wrap gap-2">
          {STATES.map((s) => (
            <button key={s.key} onClick={() => setState(s.key)}
              className={`rounded-full px-2.5 py-1 text-xs border transition-colors ${
                state === s.key
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}>
              {s.label}
              <span className="ml-1.5 opacity-70">{summary[s.key] ?? 0}</span>
            </button>
          ))}
          {/* A corpus holds footage AND text; the filter is a lens over one
              collection rather than a second collection, so a rule written
              once applies to both. */}
          <span className="ml-4 flex gap-2">
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
            Nothing in this state.
          </p>
        )}

        <div className="space-y-2">
          {docs.slice(0, 60).map((d) => {
            const curated = d.provenance?.exercise?.source === "human";
            return (
              <div key={d.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-medium">
                    {d.exercise || d.topic || d.title || "(unnamed)"}
                  </span>
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

                {state === "unlabelled" && (
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
  );
}
