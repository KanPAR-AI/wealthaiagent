/**
 * The shortlist (docs/73 ASTRAL-339, from docs/49 ASTRAL-142/143/144, F39).
 *
 * PURE — no React, no `chrome.*`. The worker reads `GET /people/matches`; this
 * module decides what the screen says about what came back, and the screen
 * draws it.
 *
 * ── the rule this file exists to hold ─────────────────────────────────────
 *
 * THE PANEL IS A VIEW OF THE PEOPLE STORE AND NEVER A SECOND STORE
 * (ASTRAL-37). Nothing here caches a match, a person or a score; there is no
 * local list to go stale, and the extension has no storage for one. What the
 * engine sent is what is drawn, in the order it was sent.
 *
 * ── and the rule underneath it ────────────────────────────────────────────
 *
 * TWO SCALES ARE NEVER INTERLEAVED. A time-less match has `total = null` and
 * keeps its firm points out of 15 with 21 genuinely unknown, and
 * `matching.py:471-473` refuses to rescale that — its own comment says why
 * ("12/15 is not '80% compatible'"). AN ORDERING IS A COMPARISON, so a
 * single list would perform exactly the rescale the engine refuses, in the
 * place a user reads as a verdict. The server therefore sends three groups,
 * already ordered, already labelled, each with the SORT RULE it applied — and
 * this module keeps them apart, prints the rule, and sorts nothing itself.
 *
 * Every number on screen is a concatenation of two payload fields through
 * `formatFraction` (the shared package's, which divides nothing). There is no
 * arithmetic in this file at all.
 */

import { formatFraction, matchStaleSentence } from '@wealthai/astral';

import { failureSentence, readApiFailure } from './errors';

// ── the wire, as the engine sends it ───────────────────────────────────────
//
// `people.py:195` → `matches.grouped_view`. Typed here so the panel reads
// fields rather than guessing at an object, and read defensively: a payload
// from a newer engine must degrade to "I cannot show this" rather than to a
// half-drawn row.

export interface MatchScoreWire {
  /** a complete match: points out of 36 */
  points?: number | null;
  out_of?: number | null;
  /** a firm-only match: the firm points, out of the firm maximum */
  firm_points?: number | null;
  /** how many gunas could not be scored at all */
  pending?: number | null;
  pending_reasons?: string[];
}

export interface MatchRowWire {
  pair_key: string;
  person_id: string | null;
  display_name: string;
  favourite: boolean;
  relation: string | null;
  tob_known: boolean;
  freshness: string;
  computed_at?: string | null;
  verdict?: string | null;
  doshas?: Array<{ name?: string; detail?: string; provisional?: boolean }>;
  dosha_count?: number;
  refusal?: { reason?: string; ask?: string } | null;
  score?: MatchScoreWire | null;
}

export interface MatchGroupWire {
  key: string;
  label: string;
  rows: MatchRowWire[];
  sort_rule?: string;
  sort_note?: string;
}

export interface MatchesWire {
  groups: MatchGroupWire[];
  total: number;
}

// ── what the screen draws ──────────────────────────────────────────────────

export interface ScoreView {
  /** "28 / 36" or "9.5 / 15" — a concatenation, never a quotient */
  text: string;
  /** what that scale MEANS, so the number cannot be misread. '' when the
   *  number says it itself. */
  scale: string;
  /** the engine's own sentences about what it could not score */
  pending: string[];
}

export interface ShortlistRow {
  pairKey: string;
  personId: string | null;
  name: string;
  favourite: boolean;
  /** null on a refusal — there is no score, and none is invented */
  score: ScoreView | null;
  /** the engine's own verdict word, verbatim. `incomplete` is a STATE. */
  verdict: string | null;
  doshaCount: number;
  /** ASTRAL-144: the refusal is the whole answer, never a zero */
  refusal: { reason: string; ask: string | null } | null;
  /** null when there is nothing to say about how old this record is */
  freshness: string | null;
  /**
   * The engine's own word — `fresh` | `stale` | `unprovable` — verbatim.
   *
   * Carried beside the SENTENCE because a decision depends on it: the chat
   * about this match may promise "answers from the stored scorecard" only on
   * a FRESH row, because `_rehydrate_stored_match` declines on anything else
   * and the turn then scores the match again (FLAG-1). A view model that
   * kept only the prose would have made that decision unavailable, which is
   * how the false promise got printed in the first place.
   */
  freshnessState: string;
  /** for the compare screen: a match with no scorecard has no columns to
   *  compare, and says so rather than being silently dropped */
  scored: boolean;
}

export interface ShortlistGroup {
  key: string;
  /** the server's own label, verbatim */
  label: string;
  /** the server's own sort rule, verbatim — printed, so the ordering is
   *  falsifiable by whoever is reading it */
  rule: string;
  /** the honest note when a group could not use the user's priorities */
  note: string;
  rows: ShortlistRow[];
}

export type ShortlistOutcome =
  | { kind: 'groups'; groups: ShortlistGroup[]; total: number }
  /** the account has no saved matches — a sentence, not an empty screen */
  | { kind: 'empty'; note: string }
  | { kind: 'signed-out'; note: string }
  | { kind: 'failed'; note: string };

/**
 * The sentence over the three groups, for the same reason compare has one.
 *
 * A screen that shows `28 / 36` above `9.5 / 15` above a refusal, one after
 * another, reads as a ranking unless it says otherwise — and the engine
 * refuses to put those on one scale (`matching.py:471-473`). The groups carry
 * their own labels and their own printed sort rules; this says the thing the
 * labels cannot: they are not ranked against each other.
 */
export const SHORTLIST_SCALE_NOTE =
  'These groups are on different scales and are not ranked against each ' +
  'other — only the rows inside a group are ordered, by the rule printed above it.';

export const SHORTLIST_EMPTY_NOTE =
  'No saved matches yet. Read a match and choose "Add to my matches", and it ' +
  'will be here and in the Astral app.';

export const SHORTLIST_SIGNED_OUT_NOTE =
  'Your sign-in has expired. Sign in again to see your matches.';

/**
 * The reply → a state. Parse, don't trust: the same rule the fences get.
 *
 * A body that is not the shape this build knows is a FAILURE with a sentence,
 * never a half-drawn list: a group whose rows silently became `[]` would read
 * as "you have no matches", which is the most alarming lie this screen could
 * tell.
 */
export function readShortlist(status: number, body: unknown): ShortlistOutcome {
  if (status === 401 || status === 403) {
    return { kind: 'signed-out', note: SHORTLIST_SIGNED_OUT_NOTE };
  }
  if (status !== 200) {
    const failure = readApiFailure(status, body, null);
    return { kind: 'failed', note: failureSentence(failure, "I couldn't reach your matches.") };
  }
  const wire = body as MatchesWire | null;
  if (!wire || !Array.isArray(wire.groups)) {
    return { kind: 'failed', note: "I couldn't read the answer from Astral." };
  }
  const groups = wire.groups.map(groupView);
  const total = groups.reduce((n, group) => n + group.rows.length, 0);
  if (total === 0) return { kind: 'empty', note: SHORTLIST_EMPTY_NOTE };
  return { kind: 'groups', groups, total };
}

/**
 * One group, in the order the server sent it.
 *
 * `rows.map` and nothing else — no `sort`, no `filter`, no `reverse`. The
 * ordering is the engine's, it is printed above the rows as `rule`, and the
 * only honest thing a client can do with it is show it.
 */
export function groupView(group: MatchGroupWire): ShortlistGroup {
  return {
    key: String(group.key ?? ''),
    label: String(group.label ?? ''),
    rule: String(group.sort_rule ?? ''),
    note: String(group.sort_note ?? ''),
    rows: (group.rows ?? []).map(rowView),
  };
}

export function rowView(row: MatchRowWire): ShortlistRow {
  const refusal = refusalView(row);
  return {
    pairKey: String(row.pair_key ?? ''),
    personId: row.person_id ?? null,
    name: String(row.display_name ?? '').trim() || 'This match',
    favourite: Boolean(row.favourite),
    score: scoreView(row.score ?? null),
    verdict: row.verdict ?? null,
    doshaCount: Number.isFinite(row.dosha_count) ? (row.dosha_count as number) : 0,
    refusal,
    freshness: freshnessSentence(row),
    freshnessState: String(row.freshness ?? ''),
    scored: Boolean(row.score),
  };
}

/**
 * The score, in the engine's own numbers.
 *
 * The two shapes are different TYPES on the wire (`points` vs `firm_points`),
 * which is what makes "render 9.5 / 15 as if it were out of 36" a mistake
 * this function cannot make quietly. The firm-only scale carries the engine's
 * own pending COUNT; adding it to the firm points to claim a denominator
 * would be the client inventing one.
 */
export function scoreView(score: MatchScoreWire | null): ScoreView | null {
  if (!score) return null;
  if (score.firm_points !== undefined && score.firm_points !== null) {
    const text = formatFraction(score.firm_points, score.out_of);
    if (text === null) return null;
    return {
      text,
      scale: `firm points · ${score.pending ?? 0} more gunas need a birth time`,
      pending: (score.pending_reasons ?? []).map(String),
    };
  }
  const text = formatFraction(score.points, score.out_of);
  if (text === null) return null;
  return { text, scale: '', pending: [] };
}

/** ASTRAL-144 — a refusal is a first-class row: the reason, and the ask that
 *  would change it. Never a zero, never an empty ring, never an omission. */
export function refusalView(row: MatchRowWire): { reason: string; ask: string | null } | null {
  const raw = row.refusal;
  if (!raw) return null;
  const reason = String(raw.reason ?? '').trim();
  if (!reason) {
    return {
      reason: 'This match has no score, and the record does not say why.',
      ask: raw.ask ? String(raw.ask) : null,
    };
  }
  return { reason, ask: raw.ask ? String(raw.ask) : null };
}

/**
 * How old this record is — the ONE sentence, from the shared package
 * (FLAG-2).
 *
 * It said "a birth detail has changed since this was scored", and the wire
 * cannot support that: `freshness` answers "does the stamp still match?", and
 * the stamp covers the function version and the calculation settings as well
 * as the inputs. On the account this was walked, every match is stale because
 * gun milan is at v4 — nobody's details moved. So the sentence names no cause
 * and carries the date, and it is `@wealthai/astral`'s, shared with compare,
 * with the app's matches list and with the app's match detail.
 *
 * A stale match is still REPORTED stale and served as it was computed
 * (ASTRAL-33/182): re-scoring on a read would make the number on the screen
 * differ from the number the user was told, with no event in between.
 */
export function freshnessSentence(row: MatchRowWire): string | null {
  return matchStaleSentence({
    freshness: row.freshness,
    computedAt: row.computed_at,
    // A REFUSED row has no numbers, so it is never told that ITS NUMBERS may
    // be out of date — caught by looking at the walk's own screenshot.
    scored: Boolean(row.score),
  });
}

/**
 * Every row on the screen, in group order — for the COUNT and for compare's
 * picker, and for nothing else.
 *
 * It deliberately returns the rows WITH their group, because a flat list of
 * rows with the group dropped is the shape an ordering is written against,
 * and F47's whole finding is that a cross-group ordinal claims all of them
 * were measured the same way.
 */
export function rowsWithGroup(
  groups: ShortlistGroup[],
): Array<{ group: ShortlistGroup; row: ShortlistRow }> {
  const out: Array<{ group: ShortlistGroup; row: ShortlistRow }> = [];
  for (const group of groups) {
    for (const row of group.rows) out.push({ group, row });
  }
  return out;
}
