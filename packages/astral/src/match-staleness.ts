/**
 * What a surface may say about a stale MATCH — one owner, no cause named
 * (docs/49 ASTRAL-238, docs/73 PH-41 FLAG-2).
 *
 * ── the false sentence this replaces ──────────────────────────────────────
 *
 * Four surfaces said some version of "a birth detail has changed since this
 * was scored". The match payload does not support that claim: `freshness` is
 * `fresh | stale | unprovable` and nothing else — it is the answer to "does
 * the stamp still match?", and the stamp covers the inputs hash, the FUNCTION
 * VERSION and the calculation settings (`services/derived_state.py`). A
 * version bump or a settings change therefore turns every stored match stale
 * with nobody's details touched, which is the state of a real account today
 * (gun milan is at v4). Telling a user their own data changed when it did not
 * is the most literal way to spend trust, and ASTRAL-238 exists because that
 * exact blame was once said falsely on the chart surfaces.
 *
 * The chart payloads carry `stale.causes` and can name them
 * (`apps/astro/src/lib/staleness.ts`). **Match payloads carry no causes at
 * all**, so until the engine sends them this module says the unattributed
 * thing and the DATE — which is the actionable half — and attributes nothing.
 *
 * ── why it lives in the package ───────────────────────────────────────────
 *
 * Five call sites across two apps: the extension's shortlist, its compare
 * columns, its refused-row variant, and the Astral app's matches list and
 * match detail. One sentence, one place. A second copy is how the first one
 * drifted into four wordings of the same fact.
 *
 * Pure: no React, no clock, no network. The date is formatted by the shared
 * `formatIsoDate`, which is the only date formatter in this workspace.
 */

import { formatIsoDate } from './format';

/** The engine's own three states, as the match payloads carry them. */
export type MatchFreshness = 'fresh' | 'stale' | 'unprovable' | string;

export interface MatchStaleInput {
  freshness: MatchFreshness | null | undefined;
  /** `computed_at`, as the payload sent it (a date or a full instant) */
  computedAt?: string | null;
  /**
   * Does this record HAVE numbers?
   *
   * A refused match has none, so it may not be told that "these numbers may
   * be out of date" — a sentence about numbers, printed under a sentence
   * saying there is no score, is the same class of falsehood one step
   * smaller.
   */
  scored: boolean;
}

/**
 * The clause that names no cause, because none was sent.
 *
 * Deliberately close in shape to `apps/astro/src/lib/staleness.ts`'s
 * `UNATTRIBUTED_CLAUSE` ("something this chart was computed from changed") —
 * same family, different artifact, and neither one guesses.
 */
export const UNATTRIBUTED_MATCH_CLAUSE =
  'something they depend on has moved since';

export const UNATTRIBUTED_RECORD_CLAUSE = 'something it depends on has moved since';

/**
 * The sentence, or null when there is nothing to say.
 *
 * `fresh` says nothing: a surface that prints a reassurance on every row
 * trains people to stop reading the row that matters.
 */
export function matchStaleSentence(input: MatchStaleInput): string | null {
  const when = formatIsoDate(String(input.computedAt ?? '').slice(0, 10));
  const on = when ? ` on ${when}` : '';

  if (input.freshness === 'stale') {
    return input.scored
      ? `These numbers were scored${on}, and ${UNATTRIBUTED_MATCH_CLAUSE} — so they may be out of date.`
      : `This was recorded${on}, and ${UNATTRIBUTED_RECORD_CLAUSE} — so it may be out of date.`;
  }

  if (input.freshness === 'unprovable') {
    // A different fact, and it is not staleness: nobody wrote down what this
    // record was made from, so it cannot be checked either way. Named rather
    // than folded into the sentence above, which would claim a change that
    // nothing observed.
    return input.scored
      ? `These numbers were scored${on}, before we recorded which details they were scored from — so we cannot prove they still match the details on file.`
      : `This was recorded${on}, before we kept a note of which details it was made from — so we cannot prove it still matches the details on file.`;
  }

  return null;
}
