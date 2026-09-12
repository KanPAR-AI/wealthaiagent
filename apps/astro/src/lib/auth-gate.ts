// Sign-in is mandatory for any reading (owner ruling, 2026-09-12).
//
// PURE: the one rule every reading surface consults, tested at the root.
// "Reading" means anything the engine computes or serves for this person —
// a chart cast, a chat turn, the daily card, the timeline, a match, a palm.
// The shell (onboarding, settings, help, about) stays open to a guest; the
// moment a reading would happen, the gate stands in front of it.
//
// WHY (the product reason, so the copy can say it honestly): readings are
// cast for a PERSON and kept on their record — birth facts with provenance,
// charts, matches, palms. An anonymous uid is a device, not a person: lose
// the phone and everything is orphaned, and the authority ladder protects
// facts nobody can ever claim again. Signing in first is what makes "your
// reading" a sentence with a referent.
//
// The gate never signs anyone OUT and never blocks the SHELL — a guest can
// look around; they cannot cast.

import type { Account } from './auth';

/** True when a reading may not proceed for this account state.
 *  `null` (auth still resolving on a cold start) blocks too — a gate that
 *  fails open during the auth race is not a gate; the sign-in screen
 *  resolves instantly for an already-signed-in user, so the cost of
 *  blocking the race window is one redirect nobody sees. */
export function readingBlocked(account: Account | null): boolean {
  return !account || account.anonymous;
}

export const GATE_TITLE = 'Sign in to receive your readings';

export const GATE_BODY =
  'Your chart, your matches and your palm are kept on your own record — '
  + 'signing in is what lets them survive a lost phone or a new one. '
  + 'A guest can look around, but a reading needs someone to be cast for.';

export const GATE_CTA = 'Sign in or create account';
