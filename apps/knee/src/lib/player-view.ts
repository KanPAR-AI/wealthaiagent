// The player screen's seek, loop and caching decisions as a pure module
// (house rule 2: screen rules live in a `*-view.ts` with no React/expo,
// tested from the workspace root).
//
// Why this exists (9-agent RCA, production logs, 2026-09-10): the initial
// `#t` seek was applied inside the useVideoPlayer SETUP callback — before
// the item was ready — so expo-video silently dropped it and every Library
// tap played from 0:00: the user watched the wrong exercise. The in-session
// path never showed it because that path plays pre-cut clips. The seek must
// wait for statusChange to report "readyToPlay", and must apply exactly
// once — the language switch (replaceAsync) restores its own position and
// must not be yanked back to the segment start by a second ready event.

/**
 * One gate per mounted player. `onStatus`/`onTime`/`onPlayToEnd` return the
 * seconds to seek to, or null for "do nothing" — the screen applies the
 * seek, the gate owns the WHEN.
 */
export function createPlayerGate(start: number, end: number | null) {
  // start=0 needs no seek — playback begins there anyway, and skipping the
  // no-op means a 0-start video can never be interrupted by a late "ready".
  let initialSeekPending = start > 0;
  // The loop's re-entry guard: a slow seek leaves the playhead reporting
  // past `end` for a few more timeUpdate ticks, and re-seeking on each tick
  // stutters the loop. Armed when a loop seek is issued, cleared only when
  // the playhead reports back inside the segment (the seek landed).
  let loopSeekInFlight = false;

  return {
    /** statusChange: the initial seek, once, when the player can honour it. */
    onStatus(status: string): number | null {
      if (status !== 'readyToPlay' || !initialSeekPending) return null;
      initialSeekPending = false;
      return start;
    },

    /** timeUpdate: reaching the segment's end returns to its start. */
    onTime(currentTime: number): number | null {
      if (end === null) return null;
      if (currentTime < end) {
        loopSeekInFlight = false; // back inside the segment — seek landed
        return null;
      }
      if (loopSeekInFlight) return null;
      loopSeekInFlight = true;
      return start;
    },

    /** playToEnd: the native end-of-file loop, same guard. */
    onPlayToEnd(): number {
      loopSeekInFlight = true;
      return start;
    },
  };
}

/**
 * iOS caching stays OFF — revisited 2026-09-10 and the answer is still no.
 *
 * The server now stamps ETags on media 200/206 responses, which is what
 * makes the STREAM cacheable. But the URL this player is handed is the
 * ticketed `/files/corpus-media/...` REDIRECT, which is a 302 with
 * `Cache-Control: no-store` by design (a cached redirect would outlive the
 * ticket inside it) — and the redirect is what expo-video's iOS cache layer
 * choked on (can't-play glyph while the server probed 206-fine, owner
 * screenshot 2026-09-06). ETags fix the leg that was never the breakage.
 * Flip this only when the player receives a direct, already-resolved media
 * URL — and only after the ETag-emitting backend is deployed (client ships
 * after backend, docs/51).
 */
export const CACHING_IOS = false;

/** The `useCaching` flag for a platform. Android's cache layer handles the
 *  redirect fine and stays on. */
export function useCachingFor(platform: string): boolean {
  return platform === 'android' || (platform === 'ios' && CACHING_IOS);
}
