// The frame preview, drawn from one sprite sheet.
//
// WHY THIS IS NOT AN <img> PER FRAME
//
// A scrub preview has to have a picture under the cursor before the cursor
// stops moving. Fetching a thumbnail per position means a request every few
// pixels of pointer travel — hundreds per video, each with its own round trip,
// most of them cancelled before they land. It feels broken even when every
// request succeeds.
//
// So the backend renders every thumbnail into ONE JPEG (services/corpus/
// filmstrip.py) and this component moves a window over it. After the single
// sheet request there is no network at all: showing second 412 is arithmetic
// on `background-position`. That is the whole design.
//
// THE MAPPING IS THE BACKEND'S, NOT OURS
//
// `interval_s` comes down with the sheet rather than being re-derived here from
// a duration. Recomputing it in the browser is how a preview ends up three
// seconds off — still a real frame from the video, so it looks right, and
// nobody ever reports it.

import type { Filmstrip as Strip } from "@/services/corpus-video-service";
import { mediaUrl } from "@/services/corpus-video-service";

export function tileIndex(t: number, strip: Strip): number {
  if (!strip?.count || !strip.interval_s) return 0;
  // Clamped, never wrapped: a pointer at the right-hand edge showing the FIRST
  // frame is actively misleading, where showing the last one is merely blunt.
  return Math.max(0, Math.min(strip.count - 1, Math.floor(t / strip.interval_s)));
}

/** One frame from the sheet, scaled to `width`. */
export function FrameAt({
  strip,
  seconds,
  width = 160,
  className = "",
}: {
  strip: Strip;
  seconds: number;
  width?: number;
  className?: string;
}) {
  const i = tileIndex(seconds, strip);
  const col = i % strip.columns;
  const row = Math.floor(i / strip.columns);

  // Everything scales by one factor so the window, the sheet and the offsets
  // cannot disagree — the bug where a preview shows a seam between two frames
  // is always these three being scaled independently.
  const k = width / strip.tile_width;
  const height = strip.tile_height * k;

  return (
    <div
      className={`overflow-hidden rounded bg-black ${className}`}
      style={{
        width,
        height,
        backgroundImage: `url(${mediaUrl(strip.url)})`,
        backgroundSize: `${strip.sheet_width * k}px ${strip.sheet_height * k}px`,
        backgroundPosition: `-${col * strip.tile_width * k}px -${row * strip.tile_height * k}px`,
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}

/** The strip under the scrub bar: a run of tiles across the whole duration.
 *
 *  Rendered as a row of windows onto the same sheet, so it costs the same one
 *  request the hover preview already paid for. */
export function FilmstripTrack({
  strip,
  duration,
  tiles = 12,
  height = 34,
  onSeek,
}: {
  strip: Strip;
  duration: number;
  tiles?: number;
  height?: number;
  onSeek?: (seconds: number) => void;
}) {
  const n = Math.min(tiles, strip.count);
  const width = (strip.tile_width * height) / strip.tile_height;

  return (
    <div className="flex w-full overflow-hidden rounded-md border border-border">
      {Array.from({ length: n }, (_, i) => {
        const at = (duration * i) / n;
        return (
          <button
            key={i}
            title={`seek to ${Math.round(at)}s`}
            onClick={() => onSeek?.(at)}
            className="min-w-0 flex-1 opacity-80 transition-opacity hover:opacity-100"
            style={{ height }}
          >
            <FrameAt strip={strip} seconds={at} width={width} className="h-full w-full" />
          </button>
        );
      })}
    </div>
  );
}
