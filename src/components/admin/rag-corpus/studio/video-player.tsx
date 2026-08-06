// The player (docs/25 screen 4).
//
// WHY A CUSTOM SCRUB BAR RATHER THAN `controls`
//
// The native control strip can show a position. It cannot show that seconds
// 21–47 are the sit-to-stand and 47–63 is a contraindication, and that is the
// entire reason somebody opens this screen. They are not watching the video;
// they are checking whether the segment boundaries the extractor produced
// actually line up with what happens on screen. So the segments ARE the scrub
// bar, and the playhead runs across them.
//
// Hovering shows the frame at that position, pulled from the sprite sheet the
// backend already rendered — one request for the whole track, then arithmetic.
// See filmstrip.tsx.
//
// WHEN THERE IS NOTHING TO PLAY
//
// Most of this library was ingested before the media store existed: it was
// transcribed and then deleted. That is the NORMAL case here, not an error, so
// it renders as an explanation with the fix in it rather than a broken frame.

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, VideoOff } from "lucide-react";

import {
  mediaUrl,
  type AssetMedia,
  type AssetSegment,
} from "@/services/corpus-video-service";
import { FrameAt } from "./filmstrip";
import { formatTime } from "./format";
import { toneOf } from "./segment-tone";

/** A seek asked for by another part of the screen — a transcript line, a
 *  segment row, a block on the timeline.
 *
 *  The nonce is load-bearing: clicking the SAME segment twice must seek twice,
 *  and a bare `seconds` would be an unchanged prop the second time and do
 *  nothing. That reads as a dead click on the one interaction people repeat
 *  most, checking a boundary. */
export interface SeekRequest {
  seconds: number;
  nonce: number;
}

export function VideoPlayer({
  media,
  segments,
  duration,
  seekTo,
  onSeeked,
}: {
  media: AssetMedia | null;
  segments: AssetSegment[];
  duration: number;
  seekTo?: SeekRequest | null;
  onSeeked?: (seconds: number) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null);
  const [failed, setFailed] = useState("");

  const seek = useCallback((seconds: number) => {
    if (!video.current) return;
    video.current.currentTime = Math.max(0, Math.min(seconds, duration || 0));
    setAt(video.current.currentTime);
    onSeeked?.(video.current.currentTime);
  }, [duration, onSeeked]);

  // Keyed on the nonce alone. Depending on `seek` would re-fire the last
  // requested seek every time the duration or the callback identity changed,
  // which yanks the playhead back mid-watch for no reason the viewer can see.
  useEffect(() => {
    if (seekTo) seek(seekTo.seconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekTo?.nonce]);

  if (!media) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-border bg-muted/30">
        <Loader2 size={16} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!media.stored && media.youtube_id) {
    // A YouTube ingest stores no footage on purpose — YouTube hosts it. The
    // embed plays it in place; a seek from a segment row or transcript line
    // reloads the embed at that offset (the plain iframe exposes no seek
    // API, and loading YouTube's JS API for an admin check isn't worth it).
    const start = Math.max(0, Math.floor(seekTo?.seconds ?? 0));
    return (
      <div className="space-y-2">
        <div className="overflow-hidden rounded-lg border border-border bg-black">
          <iframe
            key={seekTo?.nonce ?? 0}
            className="aspect-video w-full"
            src={`https://www.youtube.com/embed/${media.youtube_id}?start=${start}${seekTo ? "&autoplay=1" : ""}`}
            title={media.source}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Hosted on YouTube — clicking a segment reopens the player at that
          moment.{" "}
          <a
            href={media.watch_url || `https://www.youtube.com/watch?v=${media.youtube_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            Watch on YouTube
          </a>
        </p>
      </div>
    );
  }

  if (!media.stored) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-6 text-center">
        <VideoOff size={20} className="text-muted-foreground" />
        <p className="text-xs font-medium">No footage stored for this source</p>
        <p className="max-w-md text-[11px] leading-relaxed text-muted-foreground">
          {media.reason}
        </p>
      </div>
    );
  }

  const pct = duration > 0 ? Math.min(100, (at / duration) * 100) : 0;
  const strip = media.filmstrip;

  const posOf = (e: React.MouseEvent) => {
    const box = bar.current?.getBoundingClientRect();
    if (!box || !duration) return null;
    const x = Math.max(0, Math.min(e.clientX - box.left, box.width));
    return { x, t: (x / box.width) * duration };
  };

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-lg border border-border bg-black">
        <video
          ref={video}
          className="aspect-video w-full"
          src={mediaUrl(media.source_url || "")}
          poster={media.poster_url ? mediaUrl(media.poster_url) : undefined}
          preload="metadata"
          onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() =>
            // Nearly always an expired ticket — they last an hour, and this
            // screen is one somebody leaves open. Say the fix, not the code.
            setFailed(
              "The video stopped loading. Playback links expire after an hour — refresh the page to get a new one.",
            )
          }
        />
        {failed && (
          <p className="absolute inset-x-0 bottom-0 bg-rose-950/80 px-3 py-1.5 text-[11px] text-rose-100">
            {failed}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => (playing ? video.current?.pause() : void video.current?.play())}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border hover:bg-muted"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
        </button>

        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {formatTime(at)} / {formatTime(duration)}
        </span>

        {/* The segments ARE the scrub bar. */}
        <div
          ref={bar}
          className="relative h-7 flex-1 cursor-pointer overflow-hidden rounded-md bg-muted"
          onClick={(e) => {
            const p = posOf(e);
            if (p) seek(p.t);
          }}
          onMouseMove={(e) => setHover(posOf(e))}
          onMouseLeave={() => setHover(null)}
        >
          {segments.map((s) =>
            s.start_seconds == null || !duration ? null : (
              <div
                key={s.id}
                title={`${s.title} · ${formatTime(s.start_seconds)}`}
                className={`absolute inset-y-0 ${toneOf(s.type)} opacity-70`}
                style={{
                  left: `${(s.start_seconds / duration) * 100}%`,
                  width: `${
                    (((s.end_seconds ?? s.start_seconds + 1) - s.start_seconds) /
                      duration) *
                    100
                  }%`,
                }}
              />
            ),
          )}
          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-foreground"
            style={{ left: `${pct}%` }}
          />
        </div>
      </div>

      {/* The hover preview. Positioned over the bar, clamped so it stays on
          screen at both ends rather than being cut off exactly where somebody
          is checking the last segment's boundary. */}
      {hover && strip && (
        <div
          className="pointer-events-none relative"
          style={{ height: 0 }}
        >
          <div
            className="absolute -top-[7.5rem] z-10 rounded-md border border-border bg-popover p-1 shadow-lg"
            style={{
              left: `min(max(${hover.x}px, 5rem), calc(100% - 5rem))`,
              transform: "translateX(-50%)",
            }}
          >
            <FrameAt strip={strip} seconds={hover.t} width={144} />
            <p className="mt-0.5 text-center text-[10px] tabular-nums text-muted-foreground">
              {formatTime(hover.t)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
