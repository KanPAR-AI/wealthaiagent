// components/widgets/bedtime-video-widget.tsx
//
// Renders a fenced ```bedtime_video JSON``` block emitted by the backend
// BedtimeStoryAgent. Two states:
//   - status === "complete": play the mp4 inline
//   - status === "pending":  spinner + progress text, polls /jobs/{id}
//     every 3s until complete or failed, then swaps to the player.
//
// Video URL from the backend is a relative path like
// `/api/v1/bedtime/videos/xxxx.mp4` — we prepend the API base URL so it
// works both locally and in production.

import { useEffect, useRef, useState } from "react";
import { getApiUrl } from "@/config/environment";
import { auth } from "@/config/firebase";

export interface BedtimeVideoPayload {
  type: "bedtime_video";
  status: "pending" | "complete" | "failed";
  language?: string;
  request?: string;
  video_url?: string | null;
  job_id?: string;
  poll_url?: string;
  cache_hit?: boolean;
}

interface Props {
  payload: BedtimeVideoPayload;
}

const POLL_INTERVAL_MS = 3000;

function resolveVideoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  // getApiUrl is /api/v1/... by default; our video URLs already include
  // /api/v1/bedtime/videos/..., so attach directly to the base host.
  // Simplest: use the apiBaseUrl part from getApiUrl("/") and trim.
  const base = getApiUrl("/").replace(/\/api\/v\d+\/?$/, "");
  return `${base}${path}`;
}

export function BedtimeVideoWidget({ payload }: Props) {
  const [status, setStatus] = useState(payload.status);
  const [progress, setProgress] = useState<string>(payload.status === "pending" ? "starting" : "");
  const [videoUrl, setVideoUrl] = useState<string | null>(payload.video_url || null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll until we reach a terminal state.
  useEffect(() => {
    if (status !== "pending" || !payload.job_id) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const r = await fetch(getApiUrl(`/bedtime/jobs/${payload.job_id}`), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!r.ok) {
          // 404 during very early polling can happen if the job doc
          // hasn't landed in Firestore yet — keep polling quietly.
          return;
        }
        const data = await r.json();
        if (cancelled) return;

        if (data.progress) setProgress(data.progress);

        if (data.status === "complete") {
          setVideoUrl(data.video_url || null);
          setStatus("complete");
        } else if (data.status === "failed") {
          setError(data.error || "Generation failed");
          setStatus("failed");
        }
      } catch (e) {
        // Network blips — keep polling.
        void e;
      }
    };

    void poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status, payload.job_id]);

  if (status === "complete" && videoUrl) {
    const src = resolveVideoUrl(videoUrl);
    return (
      <div className="my-3 rounded-lg overflow-hidden border bg-black max-w-md">
        {src ? (
          <video
            src={src}
            controls
            playsInline
            preload="metadata"
            className="w-full h-auto"
          />
        ) : (
          <div className="p-4 text-sm text-muted-foreground">No video URL</div>
        )}
        {payload.cache_hit && (
          <div className="px-2 py-1 text-[10px] text-muted-foreground/80 bg-background">
            🗄 served from cache
          </div>
        )}
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="my-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
        <div className="font-medium text-destructive">Couldn't generate the video</div>
        {error && <div className="text-xs text-muted-foreground mt-1">{error}</div>}
      </div>
    );
  }

  // pending
  return (
    <div className="my-3 rounded-lg border bg-muted/30 p-4 max-w-md">
      <div className="flex items-center gap-2 text-sm">
        <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
        <span>Generating your bedtime story…</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground capitalize">{progress || "queued"}</div>
      {payload.request && (
        <div className="mt-2 text-xs italic text-muted-foreground">“{payload.request}”</div>
      )}
    </div>
  );
}

/** Parse a fenced ```bedtime_video {...}``` block body into a payload, or null. */
export function tryParseBedtimePayload(raw: string): BedtimeVideoPayload | null {
  try {
    const obj = JSON.parse(raw);
    if (obj && obj.type === "bedtime_video") return obj as BedtimeVideoPayload;
  } catch {
    /* not JSON — ignore */
  }
  return null;
}
