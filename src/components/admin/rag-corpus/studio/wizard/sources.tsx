// Step 2 of 5 — Sources (docs/25 screen 3).
//
// WHAT THE PROGRESS BAR ACTUALLY MEANS
//
// The mockup shows "Uploading 78%", and there are two honest ways to get a
// number like that and one dishonest one. The dishonest one is a timer that
// crawls to 90% and waits, which is what most upload UIs do.
//
// This uses the real thing: XHR reports how many bytes of the request body
// have gone out (fetch cannot), so the percentage during UPLOAD is measured.
// What no client can measure is the server's work afterwards — ingest
// transcribes before it answers — so that is a separate PROCESSING phase with
// a spinner rather than a bar parked at 100% pretending to still be moving.
//
// Files go up one at a time. Ingest holds a transcription open per request,
// and firing eight at a browser's six-connection limit means six requests
// queue at the socket layer showing "uploading" while nothing moves. Serial is
// slower and legible; parallel is faster and lies.
//
// THE OTHER TWO TABS
//
// YouTube and Drive are rendered and disabled, with what is actually missing.
// A YouTube ingest exists on the OLD agent-corpus surface and writes to a
// different collection with a different shape; wiring this tab to it would put
// documents in a corpus that the studio's own pipeline cannot read. That is
// worth saying rather than hiding the tab and implying nobody thought of it.

import { useCallback, useRef, useState } from "react";
import {
  AlertTriangle, Check, CloudUpload, FileVideo, Link2, Loader2, Upload, X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ACCEPTED_UPLOAD,
  MAX_UPLOAD_BYTES,
  ingestAssetWithProgress,
} from "@/services/corpus-video-service";
import { formatBytes } from "../format";

type Phase = "queued" | "uploading" | "processing" | "done" | "failed";

interface Row {
  id: string;
  file: File;
  phase: Phase;
  fraction: number;
  note: string;
  error: string;
  reused: boolean;
}

const TABS = [
  { key: "files", label: "Upload Files", icon: Upload, built: true },
  {
    key: "youtube",
    label: "YouTube Links",
    icon: Link2,
    built: false,
    why:
      "A YouTube ingest exists, but on the older agent-corpus surface: it " +
      "writes a differently shaped document into a different collection, " +
      "which this studio's pipeline cannot read. Pointing this tab at it " +
      "would silently create a corpus that never publishes.",
  },
  {
    key: "drive",
    label: "Drive / Cloud",
    icon: CloudUpload,
    built: false,
    why:
      "Needs an OAuth connection per user and a fetch-by-reference ingest — " +
      "the pipeline takes an uploaded file today, so there is nothing for a " +
      "Drive file id to hand to.",
  },
] as const;

export function SourcesStep({
  corpusId,
  instruction,
  onDone,
}: {
  corpusId: string;
  instruction?: string;
  onDone: () => void;
}) {
  const [tab, setTab] = useState<string>("files");
  const [rows, setRows] = useState<Row[]>([]);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const patch = useCallback((id: string, next: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...next } : r)));
  }, []);

  const add = useCallback((files: FileList | File[]) => {
    const incoming = [...files].map((file, i) => ({
      id: `${file.name}-${file.size}-${i}-${rows.length}`,
      file,
      // Rejected here as well as by the server. A file the server will refuse
      // should not spend four minutes uploading to find that out.
      phase: (file.size > MAX_UPLOAD_BYTES ? "failed" : "queued") as Phase,
      fraction: 0,
      note: "",
      error:
        file.size > MAX_UPLOAD_BYTES
          ? `${formatBytes(file.size)} is over the 10 GB limit.`
          : "",
      reused: false,
    }));
    setRows((rs) => [...rs, ...incoming]);
  }, [rows.length]);

  const run = useCallback(async () => {
    setRunning(true);
    // A snapshot, not a live read: rows mutate as each upload progresses, and
    // iterating the live array would re-process a row whose phase just changed.
    const todo = rows.filter((r) => r.phase === "queued");
    for (const row of todo) {
      patch(row.id, { phase: "uploading", fraction: 0 });
      try {
        const out = await ingestAssetWithProgress(corpusId, row.file, {
          instruction,
          onProgress: (fraction) => {
            patch(row.id, {
              fraction,
              // Crossing to processing at the moment the last byte lands,
              // rather than when the response returns, so the bar never sits
              // full while the server transcribes.
              phase: fraction >= 1 ? "processing" : "uploading",
            });
          },
        });
        patch(row.id, {
          phase: "done",
          fraction: 1,
          reused: out.reused_existing_transcript,
          note: out.reused_existing_transcript
            ? `reused an existing transcript · ${out.segments} segments`
            : `${out.segments} segments · ${out.documents} documents`,
        });
      } catch (e) {
        patch(row.id, {
          phase: "failed",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    setRunning(false);
  }, [rows, corpusId, instruction, patch]);

  const done = rows.filter((r) => r.phase === "done").length;
  const queued = rows.filter((r) => r.phase === "queued").length;
  const active = TABS.find((t) => t.key === tab);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-start">
      <section className="space-y-3">
        <div className="flex flex-wrap gap-1.5 border-b border-border">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs transition-colors ${
                  tab === t.key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={12} />
                {t.label}
                {!t.built && <span className="text-[9px] opacity-60">soon</span>}
              </button>
            );
          })}
        </div>

        {tab === "files" ? (
          <>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (e.dataTransfer.files.length) add(e.dataTransfer.files);
              }}
              onClick={() => input.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/60"
              }`}
            >
              <CloudUpload size={22} className="text-muted-foreground" />
              <p className="text-xs font-medium">
                Drop videos here, or click to choose
              </p>
              <p className="text-[11px] text-muted-foreground">
                MP4, MOV, AVI, MKV, WEBM · MP3, M4A, WAV · up to 10 GB each
              </p>
              <input
                ref={input}
                type="file"
                multiple
                accept={ACCEPTED_UPLOAD}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) add(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => void run()} disabled={running || !queued}>
                {running ? (
                  <>
                    <Loader2 size={13} className="mr-1 animate-spin" /> Processing…
                  </>
                ) : (
                  <>Process {queued || ""} {queued === 1 ? "file" : "files"}</>
                )}
              </Button>
              <Button size="sm" variant="outline" onClick={onDone} disabled={!done}>
                Continue →
              </Button>
              {running && (
                <span className="text-[11px] text-muted-foreground">
                  One at a time — each file is transcribed as it arrives.
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-border px-4 py-6">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <AlertTriangle size={13} /> {active?.label} is not wired up
            </p>
            <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-muted-foreground">
              {active && "why" in active ? active.why : ""}
            </p>
          </div>
        )}
      </section>

      <aside className="space-y-2 lg:sticky lg:top-4">
        <p className="text-xs font-medium">
          {rows.length} {rows.length === 1 ? "Source" : "Sources"} Added
          {done > 0 && (
            <span className="ml-1 text-[11px] font-normal text-muted-foreground">
              · {done} processed
            </span>
          )}
        </p>

        {rows.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Nothing yet. A corpus with no sources can be created, but it cannot
            answer anything.
          </p>
        ) : (
          <div className="space-y-1.5">
            {rows.map((r) => (
              <FileRow
                key={r.id}
                row={r}
                onRemove={
                  r.phase === "queued" || r.phase === "failed"
                    ? () => setRows((rs) => rs.filter((x) => x.id !== r.id))
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

const PHASE_LABEL: Record<Phase, string> = {
  queued: "Queued",
  uploading: "Uploading",
  processing: "Transcribing",
  done: "Uploaded 100%",
  failed: "Failed",
};

function FileRow({ row, onRemove }: { row: Row; onRemove?: () => void }) {
  const pct = Math.round(row.fraction * 100);
  return (
    <div className="rounded-md border border-border px-2.5 py-1.5">
      <div className="flex items-baseline gap-1.5">
        <FileVideo size={11} className="shrink-0 translate-y-0.5 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium">
          {row.file.name}
        </span>
        {row.phase === "done" && (
          <Check size={11} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
        )}
        {onRemove && (
          <button onClick={onRemove} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X size={11} />
          </button>
        )}
      </div>

      <p className="flex gap-1.5 text-[11px] text-muted-foreground">
        <span>
          {row.phase === "uploading" ? `Uploading ${pct}%` : PHASE_LABEL[row.phase]}
        </span>
        <span className="ml-auto shrink-0">{formatBytes(row.file.size)}</span>
      </p>

      {(row.phase === "uploading" || row.phase === "processing") && (
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${
              // Indeterminate during processing, because nothing here can
              // measure a transcription in progress and a bar that keeps
              // creeping would be inventing the number.
              row.phase === "processing" ? "w-full animate-pulse bg-sky-400" : "bg-amber-400"
            }`}
            style={row.phase === "uploading" ? { width: `${Math.max(pct, 2)}%` } : undefined}
          />
        </div>
      )}

      {row.note && (
        <p className={`mt-0.5 text-[11px] ${row.reused ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
          {row.note}
        </p>
      )}
      {row.error && (
        <p className="mt-0.5 text-[11px] text-rose-600 dark:text-rose-400">{row.error}</p>
      )}
    </div>
  );
}
