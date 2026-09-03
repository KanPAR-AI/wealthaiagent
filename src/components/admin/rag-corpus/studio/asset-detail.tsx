// One asset, with the tabs the mockup shows (docs/25 screens 4–6).
//
// Overview · Transcript · Segments are real. AI Extract · Knowledge Graph ·
// Preview are rendered as EXPLICITLY NOT BUILT rather than hidden, because a
// tab that quietly is not there reads as a product that never planned one,
// while a tab saying what it needs is a roadmap somebody can argue with.

import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft, Layers, Loader2, MonitorPlay, Plus, Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  addSegment, fetchAssetDetail, fetchAssetMedia, patchVideo, requestDub,
  setSegmentType,
  type AssetDetail, type AssetMedia,
} from "@/services/corpus-video-service";
import { CorpusAssistantPanel } from "../corpus-assistant-panel";
import { AiExtractTab } from "./ai-extract";
import { FilmstripTrack } from "./filmstrip";
import { formatBytes, formatTime } from "./format";
import { TYPE_TONE } from "./segment-tone";
import { VideoPlayer, type SeekRequest } from "./video-player";

const TABS = [
  { key: "overview", label: "Overview", built: true },
  { key: "transcript", label: "Transcript", built: true },
  { key: "segments", label: "Segments", built: true },
  { key: "extract", label: "AI Extract", built: true },
  // Scoped to THIS source: the backend attaches the asset's real facts — cue
  // count, transcript origin, which fields are empty — so "why is there no
  // phase here?" gets answered instead of guessed.
  { key: "assistant", label: "Ask", built: true },
  { key: "graph", label: "Knowledge Graph", built: false },
  { key: "preview", label: "Preview", built: false },
] as const;

const NOT_BUILT: Record<string, string> = {
  graph:
    "Nothing builds a knowledge graph. It needs the extractor to propose " +
    "RELATIONSHIPS between entities — that field exists in the schema " +
    "proposal now, and nothing consumes it.",
  preview:
    "Previewing means asking this corpus a question and seeing the answer " +
    "with its citations. Retrieval returns segments today; nothing " +
    "synthesises an answer from them.",
};

function Confidence({ value }: { value: number | null }) {
  // "—", never 0%. Zero reads as "known to be wrong"; absent means nobody has
  // said.
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  const pct = Math.round(value * 100);
  const tone =
    pct >= 90 ? "text-emerald-600 dark:text-emerald-400"
      : pct >= 70 ? "text-amber-600 dark:text-amber-400"
        : "text-rose-600 dark:text-rose-400";
  return <span className={`tabular-nums ${tone}`}>{pct}%</span>;
}

export function AssetDetailView({
  corpusId,
  source,
  onBack,
}: {
  corpusId: string;
  source: string;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<string>("overview");
  const [data, setData] = useState<AssetDetail | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [lineType, setLineType] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", type: "instruction", start: "", end: "" });
  const [media, setMedia] = useState<AssetMedia | null>(null);
  // "" idle · "working" request sent · anything else is a message to show.
  const [dubState, setDubState] = useState("");
  // In-place correction of what OCR read (pipeline step 3).
  const [ocrEditing, setOcrEditing] = useState(false);
  const [ocrDraft, setOcrDraft] = useState("");
  const [ocrSaving, setOcrSaving] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [seekTo, setSeekTo] = useState<SeekRequest | null>(null);

  // A seek from anywhere on the screen. The nonce makes clicking the same
  // segment twice seek twice — see SeekRequest.
  const goTo = useCallback((seconds: number | null | undefined) => {
    if (seconds == null) return;
    setSeekTo({ seconds, nonce: Date.now() });
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setData(await fetchAssetDetail(corpusId, source, { q, lineType }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [corpusId, source, q, lineType]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const m = await fetchAssetMedia(corpusId, source);
        if (live) setMedia(m);
      } catch {
        // A missing player must not blank a screen whose real job is the
        // transcript and the segments. `stored: false` is the honest state.
        if (live) setMedia({ corpus_id: corpusId, source, duration_s: null,
                             stored: false,
                             reason: "Could not reach the media store." });
      }
    })();
    return () => { live = false; };
  }, [corpusId, source]);

  const info = data?.info;
  const duration = info?.duration_s ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs">
        <button onClick={onBack} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <ChevronLeft size={13} /> {corpusId}
        </button>
        <span className="text-muted-foreground">›</span>
        <span className="font-medium">{source}</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
        <div className="space-y-2">
          <VideoPlayer media={media} segments={data?.segments ?? []}
                       duration={duration} seekTo={seekTo} />
          {media?.stored && media.filmstrip && duration > 0 && (
            <FilmstripTrack strip={media.filmstrip} duration={duration}
                            onSeek={goTo} />
          )}
          {/* On-demand dubbing (docs/44 AMB-1). Only offered for stored
              footage without a Hindi track; once the track exists the
              player's own language selector takes over. */}
          {media?.stored && media.content_sha &&
            !(media.audio_tracks?.length) && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px]"
                disabled={dubState === "working"}
                onClick={async () => {
                  setDubState("working");
                  try {
                    const r = await requestDub(corpusId, media.content_sha!);
                    setDubState(
                      r.status === "reused"
                        ? "A Hindi track already exists — refresh to see the selector."
                        : "Dubbing started — the Hindi option appears here when the job finishes.",
                    );
                  } catch (e) {
                    setDubState(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                {dubState === "working" ? "Requesting…" : "Dub in Hindi"}
              </Button>
              {dubState && dubState !== "working" && (
                <span className="text-[11px] text-muted-foreground">{dubState}</span>
              )}
            </div>
          )}
        </div>
        {/* Beside the player: what is actually IN this video. The counts are
            the fastest read of whether an extraction went wrong — a 12-minute
            routine that produced one segment is visible here in a way it is
            not three tabs away. */}
        {data && (
          <div className="space-y-2">
            {data.insight && (
              <p className="rounded-lg border border-border bg-muted/30 px-2.5 py-2 text-[11px] leading-relaxed">
                {data.insight}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(data.segments_by_type)
                .filter(([, n]) => n > 0)
                .map(([type, n]) => (
                  <button
                    key={type}
                    onClick={() => setTab("segments")}
                    className="flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] capitalize hover:bg-muted"
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${TYPE_TONE[type] ?? TYPE_TONE.other}`} />
                    {n} {n === 1 ? type : `${type}s`}
                  </button>
                ))}
            </div>
            {data.segments.length > 0 && (
              <ul className="space-y-0.5">
                {data.segments.slice(0, 8).map((sg) => (
                  <li key={sg.id}>
                    <button
                      onClick={() => goTo(sg.start_seconds)}
                      className="flex w-full gap-2 rounded px-1.5 py-1 text-left text-[11px] hover:bg-muted/60"
                    >
                      <span className="w-10 shrink-0 tabular-nums text-muted-foreground">
                        {formatTime(sg.start_seconds)}
                      </span>
                      <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${TYPE_TONE[sg.type] ?? TYPE_TONE.other}`} />
                      <span className="truncate">{sg.title}</span>
                    </button>
                  </li>
                ))}
                {data.segments.length > 8 && (
                  <li className="px-1.5 text-[11px] text-muted-foreground">
                    +{data.segments.length - 8} more in Segments
                  </li>
                )}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-xs transition-colors ${
              tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {!t.built && <span className="ml-1 text-[9px] opacity-60">soon</span>}
          </button>
        ))}
      </div>

      {busy && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 size={12} className="animate-spin" /> loading…</p>}
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      {data && tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Video info
            </h3>
            <dl className="grid grid-cols-3 gap-2 text-xs">
              {[
                ["Duration", formatTime(info?.duration_s)],
                ["Resolution", info?.resolution ?? "—"],
                ["FPS", info?.fps ? String(info.fps) : "—"],
                ["Size", formatBytes(info?.size_bytes)],
                ["Language", (info?.language ?? "en").toUpperCase()],
                ["Audio", info?.audio ?? "—"],
                // Shown because it is what a query FILTERS on. A source whose
                // phase card was read correctly used to look identical to one
                // that had never been read.
                ["Phase", info?.phases?.length ? info.phases.join(", ") : "—"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md border border-border px-2 py-1.5">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</dt>
                  <dd className="truncate font-medium">{v}</dd>
                </div>
              ))}
            </dl>

          </section>

          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Processing pipeline
            </h3>
            <ol className="space-y-1.5">
              {data.pipeline.map((s) => (
                <li key={s.key} className="flex items-start gap-2 rounded-md border border-border px-2.5 py-1.5">
                  <span
                    className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-semibold ${
                      s.state === "done"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.step}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{s.label}</p>
                    {s.key === "ocr" && ocrEditing ? (
                      <div className="mt-1 space-y-1">
                        <textarea
                          className="w-full rounded border border-border bg-background p-1.5 font-mono text-[11px]"
                          rows={Math.max(2, ocrDraft.split("\n").length)}
                          value={ocrDraft}
                          onChange={(e) => setOcrDraft(e.target.value)}
                          aria-label="On-screen text blocks, one per line"
                        />
                        <div className="flex gap-1.5">
                          <Button size="sm" className="h-5 px-2 text-[10px]" disabled={ocrSaving}
                            onClick={async () => {
                              if (!s.ocr_doc_id) return;
                              setOcrSaving(true);
                              try {
                                await patchVideo(corpusId, s.ocr_doc_id, "on_screen_text",
                                  ocrDraft.split("\n").map((l) => l.trim()).filter(Boolean));
                                setOcrEditing(false);
                                await load();
                              } catch (e) {
                                setOcrError(e instanceof Error ? e.message : String(e));
                              } finally { setOcrSaving(false); }
                            }}>
                            {ocrSaving ? "Saving…" : "Save"}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-5 px-2 text-[10px]"
                            onClick={() => setOcrEditing(false)}>Cancel</Button>
                          {ocrError && <span className="text-[10px] text-destructive">{ocrError}</span>}
                        </div>
                      </div>
                    ) : (
                      <p className="truncate text-[11px] text-muted-foreground">{s.detail}</p>
                    )}
                  </div>
                  {/* A reviewer can correct what OCR read — a misread phase
                      card is a wrong filter fact they can SEE on the player.
                      Doc-level edit, stamped human, survives re-extraction. */}
                  {s.key === "ocr" && !!s.ocr_doc_id && !ocrEditing && (
                    <button
                      className="shrink-0 text-[10px] text-primary underline underline-offset-2"
                      onClick={() => {
                        setOcrDraft((s.ocr_blocks ?? []).join("\n"));
                        setOcrError("");
                        setOcrEditing(true);
                      }}
                    >
                      Correct
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}

      {data && tab === "transcript" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search transcript…"
                className="rounded-md border border-border bg-background py-1 pl-7 pr-2 text-xs"
              />
            </div>
            {["", ...data.segment_types].map((t) => (
              <button
                key={t || "all"}
                onClick={() => setLineType(t)}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                  lineType === t ? "border-primary bg-primary/10" : "border-border text-muted-foreground"
                }`}
              >
                {t && <span className={`h-1.5 w-1.5 rounded-full ${TYPE_TONE[t]}`} />}
                {t || "All"}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-muted-foreground">
              {data.transcript.length} line{data.transcript.length === 1 ? "" : "s"}
              {data.on_screen_text.length > 0 && ` · ${data.on_screen_text.length} on-screen`}
            </span>
          </div>

          {data.transcript.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {info?.has_speech
                ? "No line matches that filter."
                : "This source has no narration — its items are named from on-screen text."}
            </p>
          ) : (
            <div className="max-h-[28rem] space-y-0.5 overflow-y-auto rounded-lg border border-border p-2">
              {data.transcript.map((l, i) => (
                <button key={i} onClick={() => goTo(l.start_seconds)}
                        className="flex w-full gap-2 rounded px-1.5 py-1 text-left text-[11px] hover:bg-muted/50">
                  <span className="w-10 shrink-0 tabular-nums text-muted-foreground">
                    {formatTime(l.start_seconds)}
                  </span>
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${TYPE_TONE[l.type] ?? TYPE_TONE.other}`} />
                  <span className="leading-relaxed">{l.text}</span>
                </button>
              ))}
            </div>
          )}

          {data.on_screen_text.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                <MonitorPlay size={11} /> On-screen text
              </p>
              <div className="flex flex-wrap gap-1">
                {data.on_screen_text.map((t, i) => (
                  <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{t}</span>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Stored as plain strings. Per-block confidence and the frame each
                was read from need ingest to keep frames, which it currently
                samples and discards.
              </p>
            </div>
          )}
        </div>
      )}

      {data && tab === "segments" && (
        <div className="space-y-3">
          {/* The timeline. One lane per type, blocks positioned by their span
              — which is only possible because segmentation stores real
              start/end seconds rather than a chunk index. */}
          <div className="rounded-lg border border-border p-3">
            <div className="mb-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
              {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                <span key={f}>{formatTime(duration * f)}</span>
              ))}
            </div>
            <div className="space-y-1">
              {data.segment_types.map((type) => (
                <div key={type} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 truncate text-[10px] capitalize text-muted-foreground">
                    {type}
                  </span>
                  <div className="relative h-3 flex-1 rounded bg-muted/50">
                    {data.segments
                      .filter((s) => s.type === type && s.start_seconds !== null)
                      .map((s) => (
                        <button
                          key={s.id}
                          onClick={() => goTo(s.start_seconds)}
                          title={`${s.title} · ${formatTime(s.start_seconds)}–${formatTime(s.end_seconds)}`}
                          className={`absolute top-0 h-3 rounded ${TYPE_TONE[type]} hover:ring-1 hover:ring-foreground`}
                          style={{
                            left: `${((s.start_seconds ?? 0) / (duration || 1)) * 100}%`,
                            width: `${Math.max(
                              (((s.end_seconds ?? 0) - (s.start_seconds ?? 0)) / (duration || 1)) * 100,
                              0.8,
                            )}%`,
                          }}
                        />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <h3 className="text-xs font-medium">
              Segments ({data.segments.length})
            </h3>
            <Button size="sm" variant="outline" className="ml-auto"
                    onClick={() => setAdding((a) => !a)}>
              <Plus size={12} className="mr-1" /> Add segment
            </Button>
          </div>

          {adding && (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-2.5">
              <input value={draft.title} placeholder="Title"
                     onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                     className="w-40 rounded-md border border-border bg-background px-2 py-1 text-xs" />
              <select value={draft.type}
                      onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs">
                {data.segment_types.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={draft.start} placeholder="start (0:42)"
                     onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                     className="w-24 rounded-md border border-border bg-background px-2 py-1 text-xs" />
              <input value={draft.end} placeholder="end (5:10)"
                     onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                     className="w-24 rounded-md border border-border bg-background px-2 py-1 text-xs" />
              <Button size="sm" onClick={async () => {
                const toSecs = (v: string) => v.includes(":")
                  ? v.split(":").reduce((a, p) => a * 60 + Number(p), 0)
                  : Number(v);
                try {
                  await addSegment(corpusId, source, {
                    title: draft.title, segment_type: draft.type,
                    start_seconds: toSecs(draft.start), end_seconds: toSecs(draft.end),
                  });
                  setAdding(false);
                  setDraft({ title: "", type: "instruction", start: "", end: "" });
                  await load();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}>Save</Button>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-[11px]">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  {["#", "Title", "Type", "Phase", "Start", "End", "Duration", "Confidence"].map((h) => (
                    <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.segments.map((s, i) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="max-w-[14rem] truncate px-2 py-1.5 font-medium">{s.title}</td>
                    <td className="px-2 py-1.5">
                      <select
                        value={s.type}
                        onChange={async (e) => {
                          await setSegmentType(corpusId, s.id, e.target.value);
                          await load();
                        }}
                        className="rounded border border-border bg-background px-1 py-0.5 text-[10px] capitalize"
                      >
                        {data.segment_types.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      {s.phase ? (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 tabular-nums">
                          {s.phase}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">
                      <button onClick={() => goTo(s.start_seconds)}
                              className="hover:underline">
                        {formatTime(s.start_seconds)}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">{formatTime(s.end_seconds)}</td>
                    <td className="px-2 py-1.5 tabular-nums">{formatTime(s.duration_seconds)}</td>
                    <td className="px-2 py-1.5"><Confidence value={s.confidence} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "extract" && (
        <AiExtractTab corpusId={corpusId} source={source} onSeek={goTo} />
      )}

      {tab === "assistant" && (
        <CorpusAssistantPanel
          corpusId={corpusId}
          source={source}
          onChanged={load}
        />
      )}

      {data && !TABS.find((t) => t.key === tab)?.built && (
        <div className="rounded-lg border border-dashed border-border p-4">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <Layers size={13} /> Not built yet
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {NOT_BUILT[tab]}
          </p>
        </div>
      )}
    </div>
  );
}
