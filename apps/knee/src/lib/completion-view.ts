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
//   open ──keep_going_tap──▶ resumed                  (terminal — back to work)
//     │
//     ├──save_tap──▶ saving ──save_ok──▶ saved        (terminal)
//     │                │
//     │                └──save_fail──▶ open           (retry stays possible)
//     └──discard_tap──▶ discarded                     (terminal)
//
// Any other (phase, event) pair returns null: the tap is ILLEGAL and the
// screen ignores it. That is the double-tap guard — a second Save while
// saving, a Discard mid-save, a Keep going mid-save, anything after a
// terminal phase, all null.
//
// `resumed` exists because of the owner's 2026-09-27 ask ("if user are
// exiting before completing the full exercise remind them again"): the card
// now leads with CONTINUING, so "leave the card" became a third outcome
// alongside save and discard, and it has to be as un-doubleable as they are.
// The screen maps it back to no-card-and-resume; nothing is recorded.

export type PromptPhase = 'open' | 'saving' | 'saved' | 'discarded' | 'resumed';
export type PromptEvent =
  | 'save_tap' | 'save_ok' | 'save_fail' | 'discard_tap' | 'keep_going_tap';

export function promptNext(phase: PromptPhase, event: PromptEvent): PromptPhase | null {
  switch (phase) {
    case 'open':
      if (event === 'save_tap') return 'saving';
      if (event === 'discard_tap') return 'discarded';
      if (event === 'keep_going_tap') return 'resumed';
      return null;
    case 'saving':
      if (event === 'save_ok') return 'saved';
      if (event === 'save_fail') return 'open';
      return null;
    default:
      return null; // saved / discarded / resumed are terminal
  }
}

/**
 * WHICH exit card to show — reminder only, or reminder plus a save offer.
 *
 * Why this is a SECOND function and not `completionAction` (review 2026-09-27,
 * B2): `MIN_PARTIAL_EXERCISES` was written to answer "is this partial worth
 * SAVING", and it was then also answering "should we remind them to finish".
 * Those have different answers. The owner's ask names no threshold — "if user
 * are exiting before completing the full exercise remind them again" — and the
 * largest drop-off is the earliest one: quitting at exercise 1 or 2 used to
 * close the screen in silence, which is the behaviour the ask exists to end.
 *
 *   already recorded                 → none             (nothing left to ask)
 *   empty plan                       → none
 *   nothing done yet (done ≤ 0)      → none             (opened and left; there
 *                                                        is no set to return to)
 *   the whole plan done              → none             (auto_record owns it)
 *   done ≥ MIN_PARTIAL_EXERCISES     → remind_and_save  (worth keeping)
 *   otherwise                        → remind_only      (remind, offer NO save:
 *                                                        a 1-exercise "session"
 *                                                        is not a day's work and
 *                                                        MIN_PARTIAL_EXERCISES
 *                                                        still says so)
 *
 * The save half asks `completionAction`, so MIN_PARTIAL_EXERCISES keeps
 * exactly one owner.
 */
export type ExitPrompt = 'remind_and_save' | 'remind_only' | 'none';

export function exitPromptKind(
  exercisesDoneCount: number,
  planLength: number,
  alreadyRecorded: boolean,
): ExitPrompt {
  if (alreadyRecorded) return 'none';
  if (planLength <= 0) return 'none';
  if (exercisesDoneCount <= 0) return 'none';
  if (exercisesDoneCount >= planLength) return 'none';
  return completionAction(exercisesDoneCount, planLength, alreadyRecorded) === 'prompt'
    ? 'remind_and_save'
    : 'remind_only';
}

/** The quiet "leave anyway" label for each card. With no save on offer,
 *  "Discard" implies a choice the card is not making — there is nothing to
 *  discard, they are simply leaving. */
export function exitQuietKey(kind: ExitPrompt): 'session.discard' | 'session.exitAnyway' {
  return kind === 'remind_and_save' ? 'session.discard' : 'session.exitAnyway';
}

/**
 * Which headline the early-exit card leads with.
 *
 * The old card asked one thing — "save this session?" — which treats leaving
 * as settled. With a real minutes-left figure in hand the card leads with
 * FINISHING instead, and only falls back to the save question when there is
 * no honest number to show (a plan whose remainder somehow estimates to
 * nothing). Never guess a time here: `remainingMinutes` returns 0 rather than
 * inventing one, and 0 chooses the old headline.
 */
export function exitHeadlineKey(minutesLeft: number): 'session.keepGoingQ' | 'session.partialQ' {
  return minutesLeft > 0 ? 'session.keepGoingQ' : 'session.partialQ';
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
