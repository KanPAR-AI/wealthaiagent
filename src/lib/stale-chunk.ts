// Bug a0d78f0f: after a deploy, a tab that still holds the old index.html
// asks for a hashed chunk that no longer exists. That is not a bug in the
// page; the fix is one reload of the fresh index.html. The sessionStorage
// latch keeps a genuinely broken deploy from reloading forever.
//
// Round 2: when sessionStorage itself throws (private mode, blocked storage)
// there is NO latch, so a reload could loop - in that case we do not reload
// at all and let the boundary show its message instead. The latch is cleared
// once a mount has proven healthy (main.tsx), so the NEXT deploy gets its one
// reload too.
export const RELOAD_LATCH_KEY = "app-error-boundary:reloaded";

const CHUNK_ERROR_RE =
  /(failed to fetch dynamically imported module|loading (css )?chunk [\w-]+ failed|importing a module script failed)/i;

export function isStaleChunkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return CHUNK_ERROR_RE.test(msg);
}

/** Reload once for a stale-chunk failure; false when we already did, or when
 *  no latch can be written (a reload without a latch could loop). */
export function reloadOnceForStaleChunk(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_LATCH_KEY)) return false;
    sessionStorage.setItem(RELOAD_LATCH_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

// Set by AppErrorBoundary while it is showing an error, cleared when it
// resets. A mount that is up but showing the error page is NOT healthy, and
// releasing the latch then could re-arm a reload loop (round 3).
let boundaryErrorShowing = false;

export function setBoundaryErrorShowing(showing: boolean): void {
  boundaryErrorShowing = showing;
}

export function isBoundaryErrorShowing(): boolean {
  return boundaryErrorShowing;
}

/** Release the one-reload latch, but only when the page is genuinely up:
 *  mounted for a while AND no boundary is showing an error. Returns whether
 *  it cleared. */
export function clearStaleChunkLatch(): boolean {
  if (boundaryErrorShowing) return false;
  try {
    sessionStorage.removeItem(RELOAD_LATCH_KEY);
  } catch {
    // nothing to clear
  }
  return true;
}
