/**
 * Compare up to five stored matches (docs/73 ASTRAL-340, F151, F39, F47).
 *
 * PURE — no React, no `chrome.*`. The worker reads
 * `GET /people/matches/{pair_key}` once per column; this module lays the
 * columns out and computes NOTHING.
 *
 * ── the whole row, in four sentences ──────────────────────────────────────
 *
 * 1. **No rank, no winner, no composite, no percentage.** A `/36` and a
 *    firm-only `/15` are not on one scale — `matching.py:471-473` refuses the
 *    rescale and says why — so an ordering across the set would perform
 *    exactly the rescale the engine refuses, in the one place a user reads as
 *    a verdict. There is no `sort` in this file. There is no `Math.max`.
 *    Nothing adds two kootas together (F47's subset sum), and nothing adds a
 *    column's numbers up.
 * 2. **The columns are in the order the user picked them**, and the screen
 *    says so — `ORDER_NOTE` is printed above the table, so the arrangement is
 *    a fact the reader can check rather than an implied ranking.
 * 3. **Every time-dependent row is marked.** docs/48 §B6 screen 7 names
 *    comparing a firm 30/36 against a 28/36 from an assumed noon as "the
 *    single most misleading thing this product could do". The marking is what
 *    stops it: the flag comes off the ENGINE's own `time_dependent` field,
 *    through `@wealthai/astral`'s `kootaRows`, and a koota that was not
 *    scored renders as `pending` and never as a zero.
 * 4. **A refused match keeps its column.** With its reason, with no numbers,
 *    and never dropped for being unscored — a person missing from their own
 *    comparison is the silent-success failure in its most visible form
 *    (ASTRAL-144).
 *
 * ── where the numbers come from ───────────────────────────────────────────
 *
 * `headline` and `kootaRows` are `@wealthai/astral`'s OWN view models — the
 * same two functions the scorecard renders from. A second derivation here
 * would be a second scorecard contract with the renderer between them
 * (ASTRAL-18), so the columns are built from those and from nothing else.
 */

import {
  headline,
  kootaRows,
  matchStaleSentence,
  type KootaRow,
  type MatchReportPayload,
} from '@wealthai/astral';
import { parseMatchReport } from '@wealthai/astral';

import { failureSentence, readApiFailure } from './errors';

/** ASTRAL-340's bound. Five columns at 380 px is already a scroll. */
export const MAX_COMPARE = 5;

export const ORDER_NOTE =
  'These are in the order you picked them. They are not ranked: a score out of ' +
  '36 and a partly-scored one out of 15 are not on the same scale, so there is ' +
  'no overall winner here.';

export const TIME_DEPENDENT_NOTE =
  'Marked rows need an exact birth time. Where one match has a birth time and ' +
  'another does not, those rows are not comparable — the unscored ones are ' +
  'shown as pending, never as a zero.';

export const FULL_NOTE = `You can compare ${MAX_COMPARE} at a time. Remove one to add another.`;

/**
 * The pick list — pair keys, with the engine's own group LABEL carried along.
 *
 * The label is carried rather than looked up because the one-match read does
 * not send one: it sends the group KEY, and a client-side key → sentence map
 * would be this panel writing the scale's meaning itself. The list view has
 * the engine's label; it travels with the pick.
 */
export interface ComparePick {
  pairKey: string;
  name: string;
  /** the engine's own group label, verbatim ("Scored out of 36") */
  scale: string;
}

/**
 * Add or remove a column, in the order the user picked.
 *
 * Appends — never inserts by score, never re-orders. A full set REFUSES with
 * a sentence rather than silently dropping the oldest pick, which would be a
 * column disappearing without anybody saying so.
 */
export function togglePick(
  picked: ComparePick[],
  pick: ComparePick,
): { picked: ComparePick[]; note: string } {
  const at = picked.findIndex((p) => p.pairKey === pick.pairKey);
  if (at >= 0) {
    return { picked: [...picked.slice(0, at), ...picked.slice(at + 1)], note: '' };
  }
  if (picked.length >= MAX_COMPARE) return { picked, note: FULL_NOTE };
  return { picked: [...picked, pick], note: '' };
}

// ── the one-match read, as the engine sends it ─────────────────────────────

export interface MatchDetailWire {
  pair_key: string;
  display_name: string;
  favourite?: boolean;
  freshness?: string;
  computed_at?: string | null;
  group?: string;
  refusal?: { reason?: string; ask?: string } | null;
  report?: unknown;
}

export interface CompareColumn {
  pairKey: string;
  name: string;
  /** the engine's own group label, carried from the list */
  scale: string;
  /** "26 / 36" on a complete match; null on every other kind */
  total: string | null;
  /** "9.5 / 15" plus the pending count, on a firm-only match; null otherwise */
  firm: { text: string; pending: string } | null;
  /** the engine's own verdict word, verbatim and never re-banded */
  verdict: string | null;
  /** ASTRAL-144: the whole answer, when there is no scorecard */
  refusal: { reason: string; ask: string | null } | null;
  /** null when there is nothing to say about the record's age */
  freshness: string | null;
  /** the package's own koota view models, in the engine's own order */
  rows: KootaRow[];
}

export type ColumnOutcome =
  | { kind: 'column'; column: CompareColumn }
  | { kind: 'signed-out'; note: string }
  | { kind: 'failed'; note: string };

/**
 * One column, from one read.
 *
 * A 404 is a match that is not there any more — said as such, because the
 * alternative is a column that silently never appears and a user counting
 * four where they picked five.
 */
export function readColumn(
  status: number,
  body: unknown,
  pick: ComparePick,
): ColumnOutcome {
  if (status === 401 || status === 403) {
    return { kind: 'signed-out', note: 'Your sign-in has expired. Sign in again to compare.' };
  }
  if (status === 404) {
    return {
      kind: 'failed',
      note: `${pick.name} is no longer in your matches, so there is nothing to compare.`,
    };
  }
  if (status !== 200 || !body || typeof body !== 'object') {
    const failure = readApiFailure(status, body, null);
    return {
      kind: 'failed',
      note: failureSentence(failure, `I couldn't read the match with ${pick.name}.`),
    };
  }
  return { kind: 'column', column: columnFor(body as MatchDetailWire, pick) };
}

export function columnFor(detail: MatchDetailWire, pick: ComparePick): CompareColumn {
  const report: MatchReportPayload | null = parseMatchReport(detail.report);
  const refusal = detail.refusal?.reason
    ? { reason: String(detail.refusal.reason), ask: detail.refusal.ask ? String(detail.refusal.ask) : null }
    : null;
  const base: CompareColumn = {
    pairKey: String(detail.pair_key ?? pick.pairKey),
    name: String(detail.display_name ?? '').trim() || pick.name,
    scale: pick.scale,
    total: null,
    firm: null,
    verdict: null,
    refusal,
    freshness: freshnessSentence(detail),
    rows: [],
  };
  if (!report) return base;

  // The package's own headline — the ONE place a `/36` is decided to exist
  // or not. On a time-less match `score` is null by construction and the
  // firm split is what there is; nothing here invents a denominator.
  const head = headline(report);
  return {
    ...base,
    total: head.score,
    firm: head.split
      ? {
          text: `${head.split.firm} / ${head.split.firmMax}`,
          pending: head.split.pending,
        }
      : null,
    // `verdict` verbatim off the payload. On a firm-only match the engine's
    // own word is `incomplete` — a STATE, not a band — and it is shown as it
    // was sent (ASTRAL-143).
    verdict: report.verdict,
    rows: kootaRows(report),
  };
}

/** The shared sentence, exactly as the list uses it (FLAG-2). */
function freshnessSentence(detail: MatchDetailWire): string | null {
  return matchStaleSentence({
    freshness: detail.freshness,
    computedAt: detail.computed_at,
    scored: Boolean(detail.report),
  });
}

// ── the table ──────────────────────────────────────────────────────────────

export interface CompareCell {
  /** "4 / 4", or null when this column has no number for this row */
  text: string | null;
  /** the koota needs a birth time this match does not have */
  pending: boolean;
  /** this column carries no scorecard at all (a refusal) */
  absent: boolean;
}

export interface CompareRow {
  /** the koota's name, from the payload — never from a list in this client */
  name: string;
  /** the ENGINE's own flag, carried through the package's view model */
  timeDependent: boolean;
  /** what it measures, in the engine's words */
  meaning: string;
  cells: CompareCell[];
}

/**
 * The rows, in FIRST-SEEN order across the columns.
 *
 * Not sorted — not by name, not by points, not by anything. The first column
 * that has a scorecard sets the order and it is the ENGINE's order (or the
 * user's own priority order, which the engine applied when it sent the
 * report). A later column contributes only rows the earlier ones did not
 * have, appended where they first appear.
 *
 * A column with no scorecard contributes no rows and gets an `absent` cell in
 * every row — its column is still there, carrying its refusal.
 */
export function compareRows(columns: CompareColumn[]): CompareRow[] {
  const order: string[] = [];
  const meanings = new Map<string, { meaning: string; timeDependent: boolean }>();
  for (const column of columns) {
    for (const row of column.rows) {
      if (!meanings.has(row.name)) {
        order.push(row.name);
        meanings.set(row.name, { meaning: row.meaning, timeDependent: row.timeDependent });
      }
    }
  }
  return order.map((name) => {
    const about = meanings.get(name) as { meaning: string; timeDependent: boolean };
    return {
      name,
      meaning: about.meaning,
      timeDependent: about.timeDependent,
      cells: columns.map((column) => {
        if (!column.rows.length) return { text: null, pending: false, absent: true };
        const row = column.rows.find((r) => r.name === name);
        if (!row) return { text: null, pending: false, absent: true };
        return { text: row.fraction, pending: row.pending, absent: false };
      }),
    };
  });
}

/**
 * Is any row in this set comparable-but-not-really?
 *
 * True when a time-dependent row has a number in one column and a pending
 * cell in another — the exact arrangement docs/48 §B6 calls the most
 * misleading thing the product could do. The screen prints
 * `TIME_DEPENDENT_NOTE` when this is true, above the table rather than as a
 * footnote under it.
 */
export function mixedTimeKnowledge(rows: CompareRow[]): boolean {
  return rows.some(
    (row) =>
      row.timeDependent &&
      row.cells.some((cell) => cell.pending) &&
      row.cells.some((cell) => !cell.pending && !cell.absent && cell.text !== null),
  );
}
