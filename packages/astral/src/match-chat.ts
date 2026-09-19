/**
 * The one sentence that opens a conversation about a stored match
 * (docs/49 ASTRAL-146, docs/73 ASTRAL-341).
 *
 * ── why this is in the package and not in an app ──────────────────────────
 *
 * It is a CARRIER, not copy. The engine switches a chat onto a stored match
 * deterministically, by reading the name out of this exact shape —
 * `graph._MATCH_NAME_CUE` matches `match with <Name>` and
 * `_rehydrate_stored_match` then copies the STORED scorecard into the chat's
 * envelope, so the turn narrates what is on file and computes nothing. A
 * second wording in a second app is a second parse to keep in step, and the
 * failure mode is silent: the engine simply asks for both people's birth
 * details again, which is the bug this rehydration was written to fix
 * (bug 82d63ac2).
 *
 * So both surfaces — the Astral app's scorecard screen and the AstroMatch
 * panel's shortlist — build the turn here.
 *
 * ── what it may carry, and what it may not ────────────────────────────────
 *
 * A NAME, which is a label the engine joined onto the artifact at read time
 * (ASTRAL-141), and nothing else. **No birth values.** ASTRAL-146's rule is
 * that a restated copy is the one that goes stale: the date, time and place
 * are already on the People store, stamped with their provenance, and a
 * sentence that repeated them would be a second, unversioned copy travelling
 * through a prompt.
 */

/** The label both surfaces put on the control. One name for one act. */
export const ASK_ABOUT_MATCH_LABEL = 'Ask AI about this match';

/**
 * The opener.
 *
 * `match with <Name>` is the cue the engine's deterministic switch reads; the
 * rest of the sentence is what makes it a question a person would ask. A name
 * that is missing falls back to "this person" — which does not rehydrate, and
 * the engine then asks rather than guessing, which is the honest outcome for
 * a match whose person has no label at all.
 */
export function askAboutMatchTurn(name: string | null | undefined): string {
  const who = String(name ?? '').trim();
  return `Tell me more about my match with ${who || 'this person'}.`;
}
