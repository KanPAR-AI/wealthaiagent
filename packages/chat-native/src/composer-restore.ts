// Giving the user their own words back (bug 29c19678, E2 round 3).
//
// PURE — no React Native — so the root jest project can drive it. A host
// that had to DROP a turn it was holding (Astral's sign-in gate parks a turn
// and, past its time limit, discards it) hands the plain text back to the
// composer rather than making the user retype it. The composer is the only
// owner of its text state, so the host passes a `restore` request with a
// changing `key`, and the composer merges it here.
//
// Never clobbers: if the user has already started typing something new, the
// restored text goes FIRST and what they are typing stays after it.

export interface ComposerRestore {
  text: string;
  /** changes on every request, so the same words can be restored twice */
  key: number;
}

export function mergeRestoredText(current: string, restored: string): string {
  const back = String(restored ?? '').trim();
  if (!back) return current;
  const now = String(current ?? '');
  if (!now.trim()) return back;
  if (now.includes(back)) return now;
  return `${back}\n${now}`;
}
