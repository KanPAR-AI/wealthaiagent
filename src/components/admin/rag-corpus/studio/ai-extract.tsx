// AI Extract, per asset (docs/25 screen 4).
//
// WHAT THIS TAB IS FOR
//
// The corpus-wide extraction is the batch: expensive, and it feels
// irreversible. The question people have BEFORE running it is "will this spec
// work on my footage?", and the only previous answer was a dry run over one
// arbitrary document. This runs the spec against the asset in front of you,
// shows what it produced and the evidence it read, and lets you accept,
// override, or change the spec and go again.
//
// THREE STATES PER CELL, AND THE DIFFERENCE IS THE WHOLE POINT
//
//   human      somebody decided it. No automatic pass will touch it again.
//   suggested  a model proposed it and nobody has looked. NOT the value.
//   missing    nothing proposed anything.
//
// A screen that renders `suggested` the way it renders `human` makes a guess
// indistinguishable from a decision — silently, permanently, and in a corpus
// that has produced exactly that failure before. So a proposal is visually
// unfinished until somebody acts on it, and the act is one click.
//
// OVERRIDING IS AS EASY AS AGREEING
//
// Deliberate. A reviewer who has to fight the UI to disagree stops
// disagreeing, and their agreement then means nothing.

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, Loader2, Pencil, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  acceptExtractedValue,
  fetchAssetExtract,
  runAssetExtract,
  type AssetExtract,
  type ExtractedValue,
} from "@/services/corpus-video-service";
import { formatTime, relativeTime } from "./format";

export function AiExtractTab({
  corpusId,
  source,
  onSeek,
}: {
  corpusId: string;
  source: string;
  onSeek?: (seconds: number | null) => void;
}) {
  const [data, setData] = useState<AssetExtract | null>(null);
  const [busy, setBusy] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [editing, setEditing] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [showSpec, setShowSpec] = useState(false);
  const [spec, setSpec] = useState({ instruction: "", fields: "" });

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setData(await fetchAssetExtract(corpusId, source));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [corpusId, source]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(async () => {
    setRunning(true);
    setError("");
    setResult("");
    try {
      // One field per line, `name: what counts as a correct value`. A JSON box
      // would be precise and would put a syntax error between somebody and
      // trying their idea.
      const fields = spec.fields
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [name, ...rest] = line.split(":");
          return { name: name.trim(), instruction: rest.join(":").trim() };
        })
        .filter((f) => f.name);
      const out = await runAssetExtract(corpusId, source, {
        instruction: spec.instruction || undefined,
        fields: fields.length ? fields : undefined,
      });
      setResult(
        `${out.values_proposed} proposed from ${out.items_read} item${
          out.items_read === 1 ? "" : "s"
        }${out.failed ? ` · ${out.failed} failed` : ""}${
          out.items_without_evidence
            ? ` · ${out.items_without_evidence} had nothing to read`
            : ""
        }. ${out.note}`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }, [corpusId, source, spec, load]);

  const take = useCallback(
    async (docId: string, field: string, value?: unknown) => {
      try {
        await acceptExtractedValue(corpusId, source, { doc_id: docId, field, value });
        setEditing("");
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [corpusId, source, load],
  );

  if (busy && !data) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 size={12} className="animate-spin" /> reading what extraction produced…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-2">
        <p className="max-w-2xl flex-1 text-xs leading-relaxed">{data?.headline}</p>
        <Button size="sm" variant="outline" onClick={() => setShowSpec((s) => !s)}>
          <Pencil size={12} className="mr-1" /> Spec
        </Button>
        <Button size="sm" onClick={() => void run()} disabled={running}>
          {running ? (
            <><Loader2 size={12} className="mr-1 animate-spin" /> Extracting…</>
          ) : (
            <><Sparkles size={12} className="mr-1" /> Run on this source</>
          )}
        </Button>
      </div>

      {showSpec && (
        <div className="space-y-2 rounded-lg border border-border p-2.5">
          <div>
            <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Guidelines
            </label>
            <textarea
              rows={2}
              value={spec.instruction}
              onChange={(e) => setSpec({ ...spec, instruction: e.target.value })}
              placeholder={data?.instruction || "e.g. These are knee rehab videos. Use the coach's own words."}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Fields — one per line, <code>name: what counts as a correct value</code>
            </label>
            <textarea
              rows={3}
              value={spec.fields}
              onChange={(e) => setSpec({ ...spec, fields: e.target.value })}
              placeholder={
                data?.fields.length
                  ? data.fields.map((f) => `${f.name}: ${f.instruction}`).join("\n")
                  : "equipment: the walking aid used, or null\nphase: which recovery phase"
              }
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px]"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Leave both blank to use this corpus's own schema. Anything you type
            here runs on this source only — it does not change the corpus.
          </p>
        </div>
      )}

      {result && (
        <p className="rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-[11px]">
          {result}
        </p>
      )}
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      {data && data.fields.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-[11px]">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Item</th>
                {data.fields.map((f) => (
                  <th key={f.name} className="px-2 py-1.5 text-left font-medium">
                    <span title={f.instruction}>{f.name}</span>
                    {!f.in_schema && (
                      // Marked, because this column vanishes from every other
                      // corpus the moment the real schema is re-run.
                      <span className="ml-1 rounded bg-amber-500/15 px-1 text-[9px] text-amber-700 dark:text-amber-400">
                        off-schema
                      </span>
                    )}
                  </th>
                ))}
                <th className="px-2 py-1.5 text-left font-medium">Read from</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.doc_id} className="border-t border-border align-top">
                  <td className="px-2 py-1.5">
                    <button
                      onClick={() => onSeek?.(item.start_seconds)}
                      className="font-medium hover:underline"
                    >
                      {item.title}
                    </button>
                    {item.start_seconds != null && (
                      <span className="ml-1 tabular-nums text-muted-foreground">
                        {formatTime(item.start_seconds)}
                      </span>
                    )}
                  </td>

                  {data.fields.map((f) => {
                    const cell = item.values[f.name];
                    const key = `${item.doc_id}:${f.name}`;
                    return (
                      <td key={f.name} className="px-2 py-1.5">
                        {editing === key ? (
                          <div className="flex items-center gap-1">
                            <input
                              autoFocus
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void take(item.doc_id, f.name, draft);
                                if (e.key === "Escape") setEditing("");
                              }}
                              className="w-28 rounded border border-border bg-background px-1 py-0.5 text-[11px]"
                            />
                            <button onClick={() => void take(item.doc_id, f.name, draft)}>
                              <Check size={11} className="text-emerald-600" />
                            </button>
                            <button onClick={() => setEditing("")}>
                              <X size={11} className="text-muted-foreground" />
                            </button>
                          </div>
                        ) : (
                          <Cell
                            cell={cell}
                            onAccept={() => void take(item.doc_id, f.name)}
                            onEdit={() => {
                              setEditing(key);
                              setDraft(cell?.value == null ? "" : String(cell.value));
                            }}
                          />
                        )}
                      </td>
                    );
                  })}

                  <td className="px-2 py-1.5 text-muted-foreground">
                    <span title={item.evidence.transcript_excerpt}>
                      {item.evidence.note}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.runs.length > 0 && (
        <details className="rounded-lg border border-border px-2.5 py-1.5">
          <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
            <ChevronDown size={11} /> {data.runs.length} previous run
            {data.runs.length === 1 ? "" : "s"} on this footage
          </summary>
          <ul className="mt-1.5 space-y-1">
            {[...data.runs].reverse().map((r, i) => (
              <li key={`${r.run}-${i}`} className="flex gap-2 text-[11px]">
                <span className="font-medium">{r.run}</span>
                <span className="text-muted-foreground">{r.model}</span>
                <span className="ml-auto text-muted-foreground">{relativeTime(r.at)}</span>
              </li>
            ))}
          </ul>
          {/* Runs live on the ARTIFACT, not the corpus — so this list includes
              extractions other corpora ran over the same footage. That is the
              point: "why does this corpus say something different about the
              same video?" is only answerable if the runs sit together. */}
          <p className="mt-1 text-[11px] text-muted-foreground">
            Recorded against the footage, so runs from other corpora reading the
            same file appear here too.
          </p>
        </details>
      )}
    </div>
  );
}

function Cell({
  cell,
  onAccept,
  onEdit,
}: {
  cell: ExtractedValue | undefined;
  onAccept: () => void;
  onEdit: () => void;
}) {
  if (!cell || cell.state === "missing") {
    return (
      <button onClick={onEdit} className="text-muted-foreground hover:text-foreground">
        — <span className="text-[10px]">set</span>
      </button>
    );
  }

  if (cell.state === "human") {
    return (
      <button onClick={onEdit} className="group flex items-center gap-1 text-left">
        <span>{String(cell.value)}</span>
        <Pencil size={9} className="opacity-0 transition-opacity group-hover:opacity-60" />
      </button>
    );
  }

  // A proposal. Visually unfinished on purpose — dashed, tinted, and carrying
  // its own accept control, so it cannot be mistaken for a settled value at a
  // glance.
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onEdit}
        className="rounded border border-dashed border-amber-500/60 bg-amber-500/5 px-1 py-0.5 text-amber-800 dark:text-amber-300"
        title={`proposed by ${cell.by || "a model"} — click to override`}
      >
        {String(cell.value)}
      </button>
      <button onClick={onAccept} title="Accept this value">
        <Check size={11} className="text-emerald-600 hover:scale-110" />
      </button>
    </div>
  );
}
