// The Matches screen's view model (docs/49 ASTRAL-142/143/144, F39, F47).
//
// PURE, so the rules below are enforced by the root jest project rather than
// by a reviewer looking at a screenshot.
//
// ── the rule the screen lives or dies on ──────────────────────────────────
//
// TWO SCALES ARE NEVER INTERLEAVED. A time-less match has `total = None` and
// keeps `firm_total` out of 15 with 21 points genuinely unknown, and
// `matching.py:471-473` refuses to rescale that — its own comment says why
// ("12/15 is not '80% compatible'"). AN ORDERING IS A COMPARISON, so a single
// list would perform exactly the rescale the engine refuses, in the one place
// a user reads as a verdict.
//
// The server therefore sends three groups, already ordered, already labelled,
// and this module keeps them apart. Nothing here sorts, nothing here divides,
// and nothing here can produce a number the engine did not compute: the two
// score shapes are different TYPES (`points` vs `firm_points`), so rendering
// 12/15 as if it were out of 36 is not a mistake this file can make quietly.
//
// ── F47, in one line ──────────────────────────────────────────────────────
//
// The owner asked for a leaderboard. A leaderboard's defining feature is the
// ordinal, and a cross-section ordinal is a composite with the digits removed
// — "#3 of 7" across complete, partly-scored and unscored matches claims all
// seven were measured the same way, and they were not. So an ordinal exists
// ONLY inside a section and is LABELLED with it.

import { formatFraction, splitIsoInstant } from '@wealthai/astral';
import type { MatchDosha } from '@wealthai/astral';

// The SHAPES module, not the client: this file must stay importable
// without pulling in a native module (see `people-shapes.ts`).
import { isFirmOnly, type MatchGroup, type MatchRow, type MatchesResponse } from './people-shapes';

export interface ScoreView {
  /** "28 / 36" or "12 / 15" — a concatenation, never a division */
  text: string;
  /** what that scale MEANS, on the row, so the number cannot be misread */
  scale: string;
  /** the engine's own sentences about what it could not score */
  pending: string[];
}

export interface MatchRowView {
  pairKey: string;
  personId: string | null;
  name: string;
  favourite: boolean;
  /** "#2 of 4 with complete scorecards" — within its section, or null */
  ordinal: string | null;
  score: ScoreView | null;
  /** the engine's own verdict string, verbatim. On a firm-only row it is the
   *  word `incomplete` — a state, not a band, and never a client-side band */
  verdict: string | null;
  doshas: MatchDosha[];
  /** null when there is nothing to say; a sentence when there is */
  freshness: string | null;
  /** ASTRAL-144: the refusal, stated. Never an empty ring and never a zero */
  refusal: string | null;
  /** the birth-time ask, on the rows where it is what would change the answer */
  ask: string | null;
}

export interface MatchSectionView {
  key: string;
  /** the server's own label, verbatim */
  label: string;
  rows: MatchRowView[];
}

/**
 * The noun an ordinal is labelled with, per section.
 *
 * A section this build has never heard of gets NO ordinal rather than a
 * bare "#2": a position with no stated scale is the composite F47 forbids,
 * and silence is the safe default when the scale is unknown.
 */
const ORDINAL_SCOPE: Record<string, string> = {
  complete: 'with complete scorecards',
  firm_only: 'among the partly scored',
};

/**
 * What each scale means, said on the row.
 *
 * The `complete` scale needs no sentence — 28 / 36 says it. The firm-only
 * scale needs one, and the engine's own `pending` count is what it is built
 * from, so a change in what the engine can score without a birth time moves
 * this sentence with it.
 */
function scoreView(row: MatchRow): ScoreView | null {
  const score = row.score;
  if (!score) return null;
  if (isFirmOnly(score)) {
    const text = formatFraction(score.firm_points, score.out_of);
    if (text === null) return null;
    return {
      text,
      // `pending` is the engine's own count, printed. Adding it to
      // `firm_points` to say "of 36" would be arithmetic on payload fields —
      // the client inventing a denominator (ASTRAL-19) — and the section's
      // own label, written by the engine, already carries that sentence.
      scale: `firm points · ${score.pending} more gunas need a birth time`,
      pending: (score.pending_reasons ?? []).map(String),
    };
  }
  const text = formatFraction(score.points, score.out_of);
  if (text === null) return null;
  return { text, scale: '', pending: [] };
}

const ASK_FIRM_ONLY = 'Add their birth time to score the rest';
const ASK_REFUSED = 'Add a birth time to score this match';

/** Freshness, said only when there is something to say. */
function freshnessSentence(row: MatchRow): string | null {
  if (row.freshness === 'stale') {
    const when = splitIsoInstant(row.computed_at);
    return when
      ? `Scored on ${when.date}, before a birth detail changed.`
      : 'A birth detail has changed since this was scored.';
  }
  if (row.freshness === 'unprovable') {
    return 'Scored before we recorded which details it was scored from.';
  }
  return null;
}

/**
 * ASTRAL-144 — the refusal is a first-class row.
 *
 * Whatever the server stored about WHY is rendered verbatim; when it stored
 * only the fact of a refusal, the row says that and does not invent a reason.
 * What it never becomes is a zero, an empty ring, or an omission — a person
 * missing from their own shortlist is the silent-success failure in the most
 * visible place in the product.
 */
function refusalSentence(row: MatchRow): string | null {
  if (row.score) return null;
  const refusal = row.refusal;
  const named = refusal
    ? [refusal.reason, refusal.detail, refusal.whose]
        .filter((v): v is string => typeof v === 'string' && !!v.trim())
        .join(' ')
    : '';
  if (named) return named;
  return 'No score could be computed for this match, so there is none to show.';
}

function rowView(row: MatchRow, index: number, section: MatchGroup): MatchRowView {
  const scope = ORDINAL_SCOPE[String(section.key)];
  const score = scoreView(row);
  const refusal = refusalSentence(row);
  return {
    pairKey: String(row.pair_key),
    personId: row.person_id ?? null,
    // ASTRAL-141: the name comes from the PERSON, joined at read. The
    // artifact carries none and must not grow one.
    name: row.display_name || 'Unnamed',
    favourite: !!row.favourite,
    // Within the section, labelled with it, and only when the section has
    // more than one row — "#1 of 1" is a ranking of nothing.
    ordinal: scope && section.rows.length > 1
      ? `#${index + 1} of ${section.rows.length} ${scope}`
      : null,
    score,
    verdict: row.verdict ?? null,
    doshas: Array.isArray(row.doshas) ? row.doshas : [],
    freshness: freshnessSentence(row),
    refusal,
    // The ask goes where a birth time is what would change the answer: on a
    // refusal, and on a partly-scored row. Never on a complete one, which
    // has nothing left to unlock.
    ask: refusal ? ASK_REFUSED : isFirmOnly(row.score) ? ASK_FIRM_ONLY : null,
  };
}

/**
 * The sections, in the server's order, EMPTY ONES DROPPED.
 *
 * Dropping an empty section is not hiding one: a heading over nothing is a
 * claim that something belongs there. Every section that HAS rows keeps its
 * label, and no row ever moves between them.
 */
export function sections(response: MatchesResponse | null): MatchSectionView[] {
  if (!response) return [];
  return (response.groups ?? [])
    .filter((group) => (group.rows ?? []).length > 0)
    .map((group) => ({
      key: String(group.key),
      label: String(group.label ?? ''),
      rows: (group.rows ?? []).map((row, i) => rowView(row, i, group)),
    }));
}

export function isEmpty(response: MatchesResponse | null): boolean {
  return !response || (response.total ?? 0) === 0;
}

/** The honest empty state: what a match IS, and how one gets here. Saving is
 *  the only thing that makes a match durable — there is no auto-save, so a
 *  user who ran three matches yesterday genuinely has none saved. */
export const EMPTY_TITLE = 'No saved matches yet';
export const EMPTY_BODY =
  'Ask for a match in chat — "check my match with Priya, born 4 July 1991 in Pune" — ' +
  'and tap Save on the scorecard. Nothing is saved unless you say so.';

/**
 * The turn that opens a conversation about one match (ASTRAL-146).
 *
 * The person's NAME and nothing else. A handoff that restates birth facts is
 * a second write path wearing a prompt's clothes, and the restated copy is
 * the one that goes stale — so no date, no time and no place travels here.
 */
export function askAboutTurn(name: string): string {
  return `Tell me more about my match with ${name}.`;
}
