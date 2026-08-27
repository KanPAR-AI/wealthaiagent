// Why a stored artifact is stale — ONE table, ONE call site (docs/49
// ASTRAL-238).
//
// The defect this replaces was measured at the PH-20 gate: every stale chart
// said "your birth details changed", including on the day a function version
// bumped and nobody's details had moved. Telling a user their own data
// changed when it did not is the most literal way to spend trust.
//
// The engine now sends the CAUSES it can prove (`derived_state.stale_causes`)
// and its own sentence. This module is where the app's phrasing lives — one
// table, so Home, the Timeline and the chart surface cannot drift into three
// wordings of the same fact. When the engine sends no cause it can prove, the
// unattributed sentence is used: inventing `inputs_changed` here would
// reproduce the exact false sentence the row exists to remove.
//
// Pure: no React, no react-native, no clock.

import { formatIsoDate } from '@wealthai/astral';

import type { StaleBlock } from './people-shapes';

export const CAUSE_CLAUSES: Record<string, string> = {
  inputs_changed: 'your birth details changed',
  settings_changed: 'the calculation settings changed',
  engine_updated: 'we improved the engine that computes it',
};

export const UNATTRIBUTED_CLAUSE = 'something this chart was computed from changed';

/** The reason clause, with every proven cause named rather than one picked. */
export function causeClause(stale: StaleBlock | undefined | null): string {
  const causes = (stale?.causes ?? []).filter((c) => c in CAUSE_CLAUSES);
  if (causes.length === 0) return UNATTRIBUTED_CLAUSE;
  const named = causes.map((c) => CAUSE_CLAUSES[c]);
  if (named.length === 1) return named[0];
  return `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;
}

/**
 * The sentence a surface prints over a stale artifact.
 *
 * `tail` is what THIS surface loses by the staleness — a timeline loses its
 * dates, a chart loses its positions — so the clause is shared and the
 * consequence is local, rather than three whole sentences drifting apart.
 */
export function staleSentence(
  stale: StaleBlock | undefined | null,
  tail: string,
  computedAt?: string | null,
): string {
  // The DATE, formatted the way every other date in this app is: "stale"
  // alone is not actionable, and "cast on 3 March, before you corrected your
  // birth time" is (AMB-31 interim (a)).
  const cast = formatIsoDate(String(computedAt ?? '').slice(0, 10));
  const when = cast ? ` on ${cast}` : '';
  const clause = causeClause(stale);
  return `${clause[0].toUpperCase()}${clause.slice(1)} after this chart was cast${when}, so ${tail}`;
}
