// When a session gets recorded, and how the exit prompt may move — pure
// (house rule 2). The screen calls these and decides nothing.
//
// Why this module exists (owner-approved 2026-09-17, from live telemetry):
// 13 session starts by the first retained user → 0 recorded completions.
// People do the workout and never tap "Finish session", so streaks and the
// Progress tab stay empty. Recording is therefore automatic; these gates keep
// it honest — a real completion records itself, a decent partial asks once,
// a drive-by exit stays silent — and un-doubled: recordSession is idempotent
// per (user, date) server-side, but the CLIENT still refuses re-entry here
// rather than leaning on the server to absorb double fires.

import type { SessionPlan } from './session-view';

/** A partial worth asking about — fewer than this and Exit just exits. */
export const MIN_PARTIAL_EXERCISES = 3;

export type CompletionAction = 'auto_record' | 'prompt' | 'none';

/**
 * The one decision table, both trigger points ask it:
 *   already recorded (or attempt begun)      → none   (the double-record guard)
 *   empty plan                                → none   (nothing was done)
 *   done ≥ plan length                        → auto_record (they did the work)
 *   done ≥ MIN_PARTIAL_EXERCISES              → prompt ("save this session?")
 *   otherwise                                 → none   (exit exactly as before)
 */
export function completionAction(
  exercisesDoneCount: number,
  planLength: number,
  alreadyRecorded: boolean,
): CompletionAction {
  if (alreadyRecorded) return 'none';
  if (planLength <= 0) return 'none';
  if (exercisesDoneCount >= planLength) return 'auto_record';
  if (exercisesDoneCount >= MIN_PARTIAL_EXERCISES) return 'prompt';
  return 'none';
}

/** What actually got done — the first `doneCount` names in plan order.
 *  The recorded list is real exercises, never a guess past the counter. */
export function exercisesDone(plan: SessionPlan, doneCount: number): string[] {
  return plan.exercises.slice(0, Math.max(0, doneCount)).map((x) => x.name);
}

// ── the exit prompt's little machine ───────────────────────────────────────
//
//   open ──save_tap──▶ saving ──save_ok──▶ saved      (terminal)
//     │                  │
//     │                  └──save_fail──▶ open         (retry stays possible)
//     └──discard_tap──▶ discarded                     (terminal)
//
// Any other (phase, event) pair returns null: the tap is ILLEGAL and the
// screen ignores it. That is the double-tap guard — a second Save while
// saving, a Discard mid-save, anything after a terminal phase, all null.

export type PromptPhase = 'open' | 'saving' | 'saved' | 'discarded';
export type PromptEvent = 'save_tap' | 'save_ok' | 'save_fail' | 'discard_tap';

export function promptNext(phase: PromptPhase, event: PromptEvent): PromptPhase | null {
  switch (phase) {
    case 'open':
      if (event === 'save_tap') return 'saving';
      if (event === 'discard_tap') return 'discarded';
      return null;
    case 'saving':
      if (event === 'save_ok') return 'saved';
      if (event === 'save_fail') return 'open';
      return null;
    default:
      return null; // saved / discarded are terminal
  }
}

/** Anonymous = what the settings screen calls a guest: Firebase's own
 *  `isAnonymous` flag (Account.anonymous), NOT an empty providers list — a
 *  custom-token sign-in (the platform's /auth/otp/verify email path) yields a
 *  signed-in user with EMPTY providerData, and a signed-in user must never be
 *  nudged to "save progress". The providers check stays as the belt: were an
 *  account ever anonymous-with-a-provider, no-nudge is the cheaper error.
 *  An account not yet known (auth still loading) shows NO nudge — never nag a
 *  maybe-linked user; missing one impression on a guest is the cheaper error. */
export function isAnonymous(
  account: { anonymous: boolean; providers: string[] } | null | undefined,
): boolean {
  return account != null && account.anonymous && account.providers.length === 0;
}
