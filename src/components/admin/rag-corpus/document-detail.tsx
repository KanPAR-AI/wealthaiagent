// What a document actually contains — the evidence, not just the conclusions.
//
// The page used to show extraction's OUTPUT (a name, a phase) with none of the
// material it came from, so there was no way to tell whether a subtitle had
// been produced, what it said, or whether the extractor had read it correctly.
// 185k characters of narration existed and reached no screen.
//
// The transcript is shown but NOT embedded: it belongs to the whole video, and
// twelve videos hold several exercises, so three exercise documents legitimately
// share one narration. `evidence_from` says which video it is, so that is
// visible rather than looking like duplication.

import { useState } from "react";
import { Check, Clock, FileText, Loader2, MonitorPlay } from "lucide-react";

import { Button } from "@/components/ui/button";
import { setSegment, type CorpusVideoDoc } from "@/services/corpus-video-service";

function hhmmss(total?: number) {
  if (total === undefined || total === null) return "";
  const s = Math.max(0, Math.round(total));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** "4:20" or "260" both mean 260 seconds. Someone reading a timestamp off a
 *  player types what the player shows. */
function parseTime(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  if (t.includes(":")) {
    const parts = t.split(":").map((p) => Number(p));
    if (parts.some((p) => Number.isNaN(p))) return null;
    return parts.reduce((acc, p) => acc * 60 + p, 0);
  }
  const n = Number(t);
  return Number.isNaN(n) ? null : n;
}

export function DocumentDetail({
  doc,
  corpusId,
  onSaved,
}: {
  doc: CorpusVideoDoc;
  corpusId: string;
  onSaved: () => void;
}) {
  const [start, setStart] = useState(hhmmss(doc.start_seconds));
  const [end, setEnd] = useState(hhmmss(doc.end_seconds));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  const transcript = (doc.source_transcript || "").trim();
  const onScreen = doc.on_screen_text || [];

  const save = async () => {
    const s = parseTime(start);
    const e = parseTime(end);
    if (s === null || e === null) {
      setErr("Enter both times, as 4:20 or as seconds.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await setSegment(corpusId, doc.doc_id || doc.id, s, e);
      setOk(true);
      onSaved();
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      {/* Timestamps. A person can set these; the model cannot — the stored
          transcript has no segments and the source videos are unreachable, so
          a proposed span would be a guess wearing a number's clothes. */}
      <div>
        <p className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          <Clock size={11} /> When this item happens in {doc.evidence_from || doc.video_file}
        </p>
        {/* The relationship that makes the whole page make sense: a row is one
            ITEM inside a video, and several rows can share one source. Without
            it, three rows quoting one filename and one transcript look like a
            bug. */}
        {(doc.items_in_source ?? 1) > 1 && (
          <p className="mb-1.5 text-[11px] text-muted-foreground">
            This video holds {doc.items_in_source} items — each needs its own
            span, and they share the transcript below.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <input value={start} onChange={(e) => setStart(e.target.value)}
                 placeholder="start (0:42)"
                 className="w-24 rounded-md border border-border bg-background px-2 py-1 text-xs" />
          <span className="text-xs text-muted-foreground">→</span>
          <input value={end} onChange={(e) => setEnd(e.target.value)}
                 placeholder="end (5:10)"
                 className="w-24 rounded-md border border-border bg-background px-2 py-1 text-xs" />
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void save()}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : ok ? <Check size={12} /> : "Save span"}
          </Button>
          {doc.duration_s ? (
            <span className="text-[11px] text-muted-foreground">
              source is {hhmmss(doc.duration_s)} long
            </span>
          ) : null}
        </div>
        {err && <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{err}</p>}
      </div>

      {/* Suggestions from extraction. Proposals, never values — accepting is
          what stamps them as a person's. */}
      {doc.suggested && Object.keys(doc.suggested).length > 0 && (
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            Suggested by extraction — not applied
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(doc.suggested).map(([k, v]) => (
              <span key={k}
                    className="rounded-md border border-dashed border-border px-2 py-0.5 text-[11px]">
                <span className="font-mono text-muted-foreground">{k}</span>{" "}
                {String((v as { value?: unknown })?.value ?? "")}
              </span>
            ))}
          </div>
        </div>
      )}

      {onScreen.length > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <MonitorPlay size={11} /> Text shown on screen
          </p>
          <div className="flex flex-wrap gap-1">
            {onScreen.map((t, i) => (
              <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{t}</span>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          <FileText size={11} /> Transcript
          {transcript && (
            <span className="font-normal normal-case tracking-normal">
              ({transcript.length.toLocaleString()} characters)
            </span>
          )}
        </p>
        {transcript ? (
          <>
            <div className="max-h-56 overflow-y-auto rounded-md border border-border bg-muted/30 px-2.5 py-2 text-[11px] leading-relaxed whitespace-pre-wrap">
              {transcript}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              This is the whole video&apos;s narration, stored without timings.
              Keeping the transcriber&apos;s timestamps would let the span above
              be proposed automatically instead of typed.
            </p>
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {doc.has_speech === false
              ? "No narration — this source has no speech, so its name was read off the screen."
              : "No transcript on this document. Run the evidence backfill, or re-ingest the source."}
          </p>
        )}
      </div>
    </div>
  );
}
