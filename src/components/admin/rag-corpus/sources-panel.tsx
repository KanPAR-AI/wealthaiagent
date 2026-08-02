// The corpus by SOURCE — 49 videos, not 74 documents.
//
// The pipeline's two halves act on different things: you re-transcribe a VIDEO
// but you name an EXERCISE. Listing only entities left every source-level
// action with no row to be a button on, and three rows quoting one filename
// read as duplicated data.
//
// TRANSLATION IS NOT A SECOND PIPELINE. It repeats the LATE stages — naming and
// publishing — per language, and never the early ones, because a timestamp is
// language-independent: the squat hold starts at 1:40 whichever language
// describes it. So languages appear as a property of a source, not as a
// separate run of it.

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, Clock, Film, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchSources,
  ingestAsset,
  retranscribeSource,
  type CorpusSource,
  type SourceSummary,
} from "@/services/corpus-video-service";
import { StageBadge } from "./corpus-pipeline";

function mmss(s?: number | null) {
  if (!s) return "";
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}

export function SourcesPanel({
  corpusId,
  onChanged,
}: {
  corpusId: string;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<CorpusSource[]>([]);
  const [summary, setSummary] = useState<SourceSummary | null>(null);
  const [instruction, setInstruction] = useState("");
  const [busySource, setBusySource] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const pending = useRef<string>("");
  const fileInput = useRef<HTMLInputElement>(null);
  // Adding a NEW asset, as opposed to re-transcribing one already here.
  const addInput = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const out = await fetchSources(corpusId);
      setRows(out.sources);
      setSummary(out.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [corpusId]);

  useEffect(() => { void load(); }, [load]);

  const pick = (source: string) => {
    pending.current = source;
    fileInput.current?.click();
  };

  const onFile = async (file?: File) => {
    const source = pending.current;
    if (!file || !source) return;
    setBusySource(source);
    setError("");
    setNote("");
    try {
      const out = await retranscribeSource(corpusId, source, file, instruction);
      setNote(
        `${source}: ${out.segments} timed segments, ${out.items_updated} item(s) updated` +
          (out.spans_proposed ? `, ${out.spans_proposed} span(s) proposed` : ""),
      );
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusySource("");
      pending.current = "";
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const addAsset = async (file?: File) => {
    if (!file) return;
    setAdding(true);
    setError("");
    setNote("");
    try {
      const out = await ingestAsset(corpusId, file, instruction);
      setNote(
        `${out.file}: ${out.segments} timed segments, ${out.documents} document(s). ` +
          out.note,
      );
      await load();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
      if (addInput.current) addInput.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Film size={14} /> Sources — {corpusId}
          {summary && (
            <span className="ml-auto text-[11px] font-normal text-muted-foreground">
              {summary.sources} sources · {summary.items} items
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {summary && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">
                {summary.with_timings}
              </span>{" "}
              of {summary.sources} have timed transcripts
            </span>
            {summary.needs_retranscribe > 0 && (
              <span className="text-amber-700 dark:text-amber-400">
                {summary.needs_retranscribe} could be re-transcribed to get spans
                automatically
              </span>
            )}
            {summary.no_speech > 0 && (
              <span className="text-muted-foreground">
                {summary.no_speech} have no speech — named from the screen
              </span>
            )}
            {summary.not_from_a_source > 0 && (
              <span className="text-muted-foreground">
                {summary.not_from_a_source} derived document(s) come from no
                source — see &ldquo;By item&rdquo;
              </span>
            )}
            {summary.awaiting_translation_review > 0 && (
              <span className="text-amber-700 dark:text-amber-400">
                {summary.awaiting_translation_review} translation(s) unread
              </span>
            )}
          </div>
        )}

        <div>
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Instructions for the transcriber
          </label>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={2}
            placeholder="e.g. Physiotherapy coaching. Keep exercise names exactly as the coach says them. Label the coach and the patient separately."
            className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Kept with the result — a transcript made under one set of
            instructions is not the same artefact as one made under another.
          </p>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="video/*,audio/*"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <input
          ref={addInput}
          type="file"
          accept="video/*,audio/*"
          className="hidden"
          data-testid="add-asset-input"
          onChange={(e) => void addAsset(e.target.files?.[0])}
        />

        <div className="flex items-center gap-2">
          <Button size="sm" disabled={adding} onClick={() => addInput.current?.click()}>
            {adding ? <Loader2 size={13} className="mr-1 animate-spin" />
                    : <Upload size={13} className="mr-1" />}
            {adding ? "Processing…" : "Add video"}
          </Button>
          <span className="text-[11px] text-muted-foreground">
            Footage already processed is reused, not transcribed again.
          </span>
        </div>

        {note && <p className="text-[11px] text-emerald-700 dark:text-emerald-400">{note}</p>}
        {error && <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.source} className="rounded-lg border border-border px-3 py-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium">{r.source}</span>
                <StageBadge stage={r.stage} />
                <span className="text-muted-foreground">
                  {r.items} item{r.items === 1 ? "" : "s"}
                  {r.duration_s ? ` · ${mmss(r.duration_s)}` : ""}
                </span>
                {r.languages.length > 1 && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                    {r.languages.join(" · ")}
                  </span>
                )}
                {r.has_timings ? (
                  <span className="flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    <Clock size={9} /> timed
                  </span>
                ) : r.has_speech ? (
                  <span className="flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    <AudioLines size={9} /> no timings
                  </span>
                ) : (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    no speech
                  </span>
                )}

                {/* Only offered where it would change something. A source with
                    no speech has nothing to transcribe, and one that is already
                    timed would only be re-cut. */}
                {r.has_speech && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    disabled={!!busySource}
                    onClick={() => pick(r.source)}
                  >
                    {busySource === r.source ? (
                      <Loader2 size={12} className="mr-1 animate-spin" />
                    ) : (
                      <Upload size={12} className="mr-1" />
                    )}
                    {r.has_timings ? "Re-transcribe" : "Transcribe with timings"}
                  </Button>
                )}
              </div>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {r.titles.join(" · ")}
              </p>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Re-transcribing asks for the file because the sources are not stored on
          the server — documents carry a filename, not a location.
        </p>
      </CardContent>
    </Card>
  );
}
