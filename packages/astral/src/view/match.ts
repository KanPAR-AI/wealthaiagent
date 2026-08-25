/**
 * match_report -> display rows (docs/49 ASTRAL-16).
 *
 * The three rules this module exists to hold:
 *
 *  1. THE RING IS FILLED BY GUNA OUT OF 36 AND LABELLED WITH THE ENGINE'S OWN
 *     BAND. `verdict` comes off the payload verbatim; nothing here maps points
 *     to a band, because `matching.py:427-436` already did and a second
 *     banding rule in the client is a second source of truth.
 *  2. NO PERCENTAGE, EVER. §5b-2: the concept board's "87% Strong Match" is
 *     ruled out by FR-011 and §15.4, and the adjudicator is built so it cannot
 *     be produced. Nothing in this file divides.
 *  3. A PENDING KOOTA IS NOT A ZERO. `points === null` means "not scored";
 *     it renders as a marked, empty row with the engine's reason.
 */

import { formatFraction, formatPoints, titleCase } from '../format';
import type { MatchKoota, MatchReportPayload } from '../payloads';

export interface KootaRow {
  name: string;
  /** "4 / 4" — a concatenation of two payload values, never a quotient */
  fraction: string | null;
  meaning: string;
  note: string;
  timeDependent: boolean;
  pending: boolean;
  provisional: boolean;
}

/**
 * The koota rows, IN DISPLAY ORDER (docs/49 ASTRAL-148/149/150).
 *
 * With no `emphasis` this is the engine's own order, unchanged. With one, the
 * user's prioritised kootas lead — and that is the ONLY thing a priority may
 * do here: no row is dropped, no fraction changes, and nothing is summed. The
 * reordering is applied from the payload's own `koota_order`, computed by the
 * engine, so the client is not deciding what matters either.
 */
export function kootaRows(report: MatchReportPayload): KootaRow[] {
  const order = report.emphasis?.koota_order ?? [];
  const rank = new Map(order.map((name, i) => [name, i]));
  const ordered = order.length
    ? [...report.kootas].sort(
        (a, b) => (rank.get(a.name) ?? order.length) - (rank.get(b.name) ?? order.length),
      )
    : report.kootas;
  return ordered.map((k: MatchKoota) => ({
    name: k.name,
    fraction: k.pending ? null : formatFraction(k.points, k.max),
    meaning: k.meaning,
    note: k.note,
    timeDependent: k.time_dependent,
    pending: k.pending,
    provisional: k.provisional,
  }));
}

/**
 * The four dimension rows, driven from the kootas exactly as docs/48 §6 says:
 *
 *   Chemistry      <- Yoni (physical & instinctive harmony) + Vashya (mutual influence)
 *   Communication  <- Graha Maitri (mental connection & friendship)
 *   Emotional      <- Gana (temperament match)
 *   Long-term      <- Bhakoot (prosperity & family welfare) + Nadi (health & progeny)
 *
 * A two-koota dimension shows BOTH fractions side by side ("Yoni 4 / 4 ·
 * Vashya 1 / 2") and never their sum. Adding 4 and 1 to print "5 / 6" invents
 * a score with no published rule behind it, which is precisely the false
 * precision §5b-2 removes — the published rule exists per koota, not per
 * dimension.
 */
export const DIMENSIONS: ReadonlyArray<{ label: string; kootas: readonly string[] }> = [
  { label: 'Chemistry', kootas: ['Yoni', 'Vashya'] },
  { label: 'Communication', kootas: ['Graha Maitri'] },
  { label: 'Emotional', kootas: ['Gana'] },
  { label: 'Long-term', kootas: ['Bhakoot', 'Nadi'] },
];

export interface DimensionRow {
  label: string;
  parts: Array<{ name: string; fraction: string | null; pending: boolean; provisional: boolean }>;
  /** true when any constituent koota needs a birth time and did not get one */
  pending: boolean;
}

export function dimensionRows(report: MatchReportPayload): DimensionRow[] {
  const byName = new Map(report.kootas.map((k) => [k.name, k]));
  const rows: DimensionRow[] = [];
  for (const dim of DIMENSIONS) {
    const parts = dim.kootas
      .map((name) => byName.get(name))
      .filter((k): k is MatchKoota => k !== undefined)
      .map((k) => ({
        name: k.name,
        fraction: k.pending ? null : formatFraction(k.points, k.max),
        pending: k.pending,
        provisional: k.provisional,
      }));
    if (parts.length === 0) continue;
    rows.push({ label: dim.label, parts, pending: parts.some((p) => p.pending) });
  }
  return rows;
}

export interface Headline {
  /** "21.5 / 36" when the match is complete; null when it is not */
  score: string | null;
  /** the engine's band, title-cased for display and otherwise untouched */
  band: string;
  /** the firm/pending split, present only on a time-less match */
  split: { firm: string; firmMax: string; pending: string } | null;
  ringPoints: number | null;
  ringMax: number | null;
}

/**
 * The headline. On a time-less match there is deliberately NO `/36` and no
 * rescaled stand-in: `matching.py` sets `total` and `max_total` to null and
 * says why — "12/15 is not '80% compatible'". The ring then fills to the firm
 * points out of the firm maximum, which is a picture of what WAS computed.
 */
export function headline(report: MatchReportPayload): Headline {
  const complete = report.time_known && report.total !== null && report.max_total !== null;
  return {
    score: complete ? formatFraction(report.total, report.max_total) : null,
    band: titleCase(report.verdict) ?? report.verdict,
    split: complete
      ? null
      : {
          firm: formatPoints(report.firm_total) ?? '',
          firmMax: formatPoints(report.firm_max) ?? '',
          pending: formatPoints(report.pending_max) ?? '',
        },
    ringPoints: complete ? report.total : report.firm_total,
    ringMax: complete ? report.max_total : report.firm_max,
  };
}

/** The four nakshatra kootas, per ASTRAL-12 — used by tests and by the legend. */
export const TIME_DEPENDENT_KOOTAS = ['Tara', 'Yoni', 'Gana', 'Nadi'] as const;
