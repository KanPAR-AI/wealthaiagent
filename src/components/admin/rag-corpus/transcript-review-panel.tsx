/**
 * TranscriptReviewPanel — curation UI for a staged corpus transcript.
 *
 * Shows when a corpus ingestion job transitions to `awaiting_review`
 * (after video/audio transcription completes). Lets the admin curate
 * the transcript BEFORE it's chunked and committed to the corpus:
 *
 *   - Auto-generated clarifying questions at the top (based on
 *     transcript metadata — speaker count, non-speech ratio, low
 *     confidence segments, mixed languages)
 *   - Speaker list with colored pills + % of speech time
 *   - Segment list with per-row controls:
 *       * keep/skip toggle (checkbox)
 *       * inline text edit (pencil → textarea → save)
 *       * speaker relabel dropdown
 *       * ▸ play button (inline <video> seek)
 *       * speaker pill + timestamp + confidence bar
 *   - Bulk actions: "Keep only Speaker X", "Drop all low-confidence",
 *     "Drop all non-speech" (applied as global curation filters)
 *   - Finalize / Cancel buttons (calls the finalize/cancel endpoints)
 *
 * After Finalize, only the kept segments get embedded into the corpus.
 */

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Play,
  Pause,
  Pencil,
  Loader2,
  Users,
  AlertTriangle,
  Volume2,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  fetchStagedTranscript,
  finalizeStagedJob,
  cancelStagedJob,
} from "@/services/admin-service";
import type {
  StagedJobPayload,
  StagedSegment,
  FinalizeCurationRequest,
} from "@/services/admin-service";
import { toast } from "sonner";

interface Props {
  agentId: string;
  jobId: string;
  onFinalized: () => void;
  onCancelled: () => void;
}

// Colors for up to 6 speakers — cycled past that
const SPEAKER_COLORS: Record<string, string> = {
  A: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  B: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  C: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  D: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
  E: "bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30",
  F: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
};

function speakerColorClass(id: string): string {
  return SPEAKER_COLORS[id] || "bg-muted text-muted-foreground border-border";
}

function formatSeek(seconds: number): string {
  if (!seconds || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function TranscriptReviewPanel({
  agentId,
  jobId,
  onFinalized,
  onCancelled,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<StagedJobPayload | null>(null);

  // Per-segment curation state
  const [keepMap, setKeepMap] = useState<Record<number, boolean>>({});
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);

  // Global curation filters
  const [dropNonSpeech, setDropNonSpeech] = useState(true);
  const [minConfidence, setMinConfidence] = useState(0);
  const [selectedSpeakers, setSelectedSpeakers] = useState<Set<string>>(new Set());

  const [finalizing, setFinalizing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // --- Load staged transcript on mount ---
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchStagedTranscript(agentId, jobId);
        if (!mounted) return;
        setPayload(data);

        // Default: keep all speech segments, skip non-speech
        const initialKeep: Record<number, boolean> = {};
        data.staged.transcript.segments.forEach((s, i) => {
          initialKeep[i] = s.is_speech;
        });
        setKeepMap(initialKeep);

        // Default selected speakers = all speakers (no filter)
        setSelectedSpeakers(new Set(data.staged.transcript.speakers.map((s) => s.id)));
      } catch (err) {
        if (mounted) setError((err as Error).message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [agentId, jobId]);

  // --- Derived: segments filtered by global filters (for the display) ---
  const effectiveKeep = useMemo(() => {
    if (!payload) return {};
    const out: Record<number, boolean> = {};
    payload.staged.transcript.segments.forEach((seg, i) => {
      let keep = keepMap[i] ?? seg.is_speech;
      if (dropNonSpeech && !seg.is_speech) keep = false;
      if (seg.confidence < minConfidence) keep = false;
      if (selectedSpeakers.size > 0 && !selectedSpeakers.has(seg.speaker)) {
        keep = false;
      }
      out[i] = keep;
    });
    return out;
  }, [payload, keepMap, dropNonSpeech, minConfidence, selectedSpeakers]);

  const keptCount = useMemo(
    () => Object.values(effectiveKeep).filter(Boolean).length,
    [effectiveKeep]
  );

  // --- Actions ---
  const toggleSegment = (i: number, value: boolean) => {
    setKeepMap((prev) => ({ ...prev, [i]: value }));
  };

  const startEdit = (i: number, currentText: string) => {
    setEdits((prev) => ({ ...prev, [i]: edits[i] ?? currentText }));
    setEditingIdx(i);
  };

  const commitEdit = (i: number, newText: string) => {
    setEdits((prev) => ({ ...prev, [i]: newText }));
    setEditingIdx(null);
  };

  const handleFinalize = async () => {
    if (!payload) return;
    if (keptCount === 0) {
      toast.error("Cannot finalize — no segments selected");
      return;
    }
    setFinalizing(true);
    try {
      const keep_segment_indices = Object.entries(effectiveKeep)
        .filter(([, v]) => v)
        .map(([k]) => Number(k));
      const segment_edits: Record<number, string> = {};
      Object.entries(edits).forEach(([k, v]) => {
        const idx = Number(k);
        const orig = payload.staged.transcript.segments[idx]?.text;
        if (v && v !== orig) segment_edits[idx] = v;
      });
      const curation: FinalizeCurationRequest = {
        keep_segment_indices,
        segment_edits: Object.keys(segment_edits).length > 0 ? segment_edits : undefined,
        drop_non_speech: dropNonSpeech,
        min_confidence: minConfidence,
      };
      await finalizeStagedJob(agentId, jobId, curation);
      toast.success("Corpus finalized", {
        description: `${keptCount} segments committed to the corpus`,
      });
      onFinalized();
    } catch (err) {
      toast.error("Finalize failed", {
        description: (err as Error).message,
      });
    } finally {
      setFinalizing(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Discard this transcript? Nothing will be added to the corpus.")) {
      return;
    }
    setCancelling(true);
    try {
      await cancelStagedJob(agentId, jobId);
      toast.success("Discarded staged transcript");
      onCancelled();
    } catch (err) {
      toast.error("Cancel failed", { description: (err as Error).message });
    } finally {
      setCancelling(false);
    }
  };

  // --- Render ---
  if (loading) {
    return (
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="p-6 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          <span className="text-sm text-muted-foreground">
            Loading staged transcript…
          </span>
        </CardContent>
      </Card>
    );
  }

  if (error || !payload) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-6">
          <p className="text-sm text-destructive">
            Failed to load staged transcript: {error || "Unknown error"}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { transcript, source_url, filename } = {
    transcript: payload.staged.transcript,
    source_url: payload.source_url,
    filename: payload.staged.filename,
  };

  // --- Auto-generated clarifying questions based on transcript metadata ---
  const lowConfidenceCount = transcript.segments.filter(
    (s) => s.confidence < 0.6
  ).length;
  const nonSpeechPct = Math.round(transcript.non_speech_ratio * 100);
  const hasMultipleSpeakers = transcript.speakers.length > 1;
  const hasMultipleLanguages = transcript.detected_languages.length > 1;

  return (
    <Card className="border-blue-500/30 bg-blue-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-500" />
          Review transcript — {filename}
          <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
            {transcript.engine}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Engine/summary bar */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
          <span>{formatSeek(transcript.total_duration_seconds)} total</span>
          <span>•</span>
          <span>{transcript.segments.length} segments</span>
          <span>•</span>
          <span>{transcript.speakers.length} speakers</span>
          <span>•</span>
          <span>{transcript.detected_languages.join(", ") || "en"}</span>
          {nonSpeechPct > 0 && (
            <>
              <span>•</span>
              <span>{nonSpeechPct}% non-speech</span>
            </>
          )}
        </div>

        {/* Clarifying questions */}
        {(hasMultipleSpeakers || lowConfidenceCount > 0 || nonSpeechPct > 5 || hasMultipleLanguages) && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              <MessageSquare size={12} />
              Review before committing
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 pl-4 list-disc">
              {hasMultipleSpeakers && (
                <li>
                  <strong className="text-foreground">
                    {transcript.speakers.length} distinct speakers detected.
                  </strong>{" "}
                  Click a speaker pill to toggle it in/out of the corpus.
                </li>
              )}
              {nonSpeechPct > 5 && (
                <li>
                  <strong className="text-foreground">{nonSpeechPct}% of audio</strong> was
                  classified as non-speech (music, silence, ambient noise).
                  These are dropped by default — uncheck the toggle to keep them.
                </li>
              )}
              {lowConfidenceCount > 0 && (
                <li>
                  <strong className="text-foreground">{lowConfidenceCount} segments</strong> have
                  transcription confidence below 60%. Review each or raise the
                  confidence floor below.
                </li>
              )}
              {hasMultipleLanguages && (
                <li>
                  <strong className="text-foreground">Mixed languages detected:</strong>{" "}
                  {transcript.detected_languages.join(", ")}. Non-English segments
                  are auto-translated to English at finalize time.
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Speaker filter pills */}
        {transcript.speakers.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Users size={13} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Primary speakers:</span>
            {transcript.speakers.map((sp) => {
              const selected = selectedSpeakers.has(sp.id);
              return (
                <button
                  key={sp.id}
                  type="button"
                  onClick={() => {
                    setSelectedSpeakers((prev) => {
                      const next = new Set(prev);
                      if (next.has(sp.id)) next.delete(sp.id);
                      else next.add(sp.id);
                      return next;
                    });
                  }}
                  className={`text-[10px] px-2 py-0.5 rounded-full border font-mono transition-opacity ${speakerColorClass(sp.id)} ${selected ? "opacity-100" : "opacity-40"}`}
                  title={sp.description || `Speaker ${sp.id}`}
                >
                  Speaker {sp.id} · {Math.round(sp.speech_ratio * 100)}%
                </button>
              );
            })}
          </div>
        )}

        {/* Global filters */}
        <div className="flex items-center gap-4 flex-wrap text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={dropNonSpeech}
              onChange={(e) => setDropNonSpeech(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Drop non-speech
          </label>
          <label className="flex items-center gap-1.5">
            Min confidence:
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              className="w-20"
            />
            <span className="font-mono w-8">{minConfidence.toFixed(2)}</span>
          </label>
          <span className="ml-auto font-medium">
            {keptCount} / {transcript.segments.length} kept
          </span>
        </div>

        {/* Segment list */}
        <div className="max-h-[420px] overflow-y-auto border border-border/50 rounded-lg">
          {transcript.segments.map((seg, i) => {
            const keep = effectiveKeep[i];
            const isEditing = editingIdx === i;
            const displayText = edits[i] ?? seg.text;
            const isPlaying = playingIdx === i;

            return (
              <div
                key={i}
                className={`flex gap-2 p-2 border-b border-border/30 last:border-b-0 text-xs transition-opacity ${keep ? "opacity-100" : "opacity-40 bg-muted/30"}`}
              >
                {/* Keep/skip checkbox */}
                <input
                  type="checkbox"
                  checked={keep}
                  onChange={(e) => toggleSegment(i, e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0"
                  data-testid="review-keep-toggle"
                />

                <div className="flex-1 min-w-0 space-y-1">
                  {/* Metadata row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-mono font-medium ${speakerColorClass(seg.speaker)}`}>
                      {seg.speaker}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {formatSeek(seg.start_seconds)}–{formatSeek(seg.end_seconds)}
                    </span>
                    {!seg.is_speech && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground inline-flex items-center gap-0.5">
                        <Volume2 size={8} />
                        non-speech
                      </span>
                    )}
                    {seg.confidence < 0.6 && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-600 inline-flex items-center gap-0.5">
                        <AlertTriangle size={8} />
                        low
                      </span>
                    )}
                    <div className="w-12 h-1 rounded-full bg-border/50 overflow-hidden">
                      <div
                        className={`h-full ${seg.confidence > 0.8 ? "bg-emerald-500" : seg.confidence > 0.6 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${seg.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground font-mono">
                      {seg.confidence.toFixed(2)}
                    </span>

                    {/* Actions */}
                    <div className="ml-auto flex items-center gap-1">
                      {source_url && (
                        <button
                          type="button"
                          onClick={() => setPlayingIdx(isPlaying ? null : i)}
                          className="p-1 rounded hover:bg-muted"
                          title="Play this segment"
                        >
                          {isPlaying ? <Pause size={11} /> : <Play size={11} />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => startEdit(i, displayText)}
                        className="p-1 rounded hover:bg-muted"
                        title="Edit text"
                      >
                        <Pencil size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Text (view or edit) */}
                  {isEditing ? (
                    <div className="space-y-1">
                      <textarea
                        value={displayText}
                        onChange={(e) =>
                          setEdits((prev) => ({ ...prev, [i]: e.target.value }))
                        }
                        rows={Math.max(2, Math.ceil(displayText.length / 80))}
                        className="w-full text-xs font-mono rounded border border-border/50 bg-background p-1.5"
                        autoFocus
                      />
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => {
                            setEdits((prev) => {
                              const next = { ...prev };
                              delete next[i];
                              return next;
                            });
                            setEditingIdx(null);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => commitEdit(i, edits[i] ?? seg.text)}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-foreground/80 leading-snug">
                      {displayText}
                    </div>
                  )}

                  {/* Inline player */}
                  {isPlaying && source_url && (
                    <div className="mt-1 rounded border border-border/30 p-1">
                      <video
                        key={`${i}-${seg.start_seconds}`}
                        src={`${source_url}#t=${seg.start_seconds},${seg.end_seconds}`}
                        controls
                        autoPlay
                        preload="metadata"
                        className="w-full max-h-44 rounded"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={cancelling || finalizing}
            data-testid="review-cancel"
          >
            <XCircle size={14} className="mr-1" />
            Discard
          </Button>
          <Button
            size="sm"
            onClick={handleFinalize}
            disabled={finalizing || cancelling || keptCount === 0}
            data-testid="review-finalize"
          >
            {finalizing ? (
              <Loader2 size={14} className="mr-1 animate-spin" />
            ) : (
              <CheckCircle2 size={14} className="mr-1" />
            )}
            Commit {keptCount} segments to corpus
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
