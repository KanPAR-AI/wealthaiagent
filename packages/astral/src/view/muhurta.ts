/**
 * muhurta_results -> display rows (docs/49 ASTRAL-17).
 *
 * "the medical-window rule is a render concern only — no client-side scoring."
 * Nothing here ranks, filters or re-scores a window: the engine already
 * ordered them and already applied `min_score`. The client shows what it was
 * given, in the order it was given.
 */

import { formatScore, splitIsoInstant } from '../format';
import type { MuhurtaResultsPayload, MuhurtaWindow } from '../payloads';

export interface WindowRow {
  /** "1 Sep 2026" — from the payload's own local wall clock, not the viewer's */
  date: string | null;
  /** "14:15 – 14:30" */
  time: string | null;
  /** the raw 0..1 score, verbatim. NOT a percentage (ASTRAL-19). */
  score: string | null;
  lagna: string | null;
  lagnaLord: string | null;
  moonSign: string | null;
  panchang: Array<{ label: string; value: string }>;
  rahuKaal: boolean;
  benefics: string[];
  malefics: string[];
  namingLetter: string | null;
}

export function windowRows(payload: MuhurtaResultsPayload): WindowRow[] {
  return payload.windows.map((w: MuhurtaWindow) => {
    const start = splitIsoInstant(w.start);
    const end = splitIsoInstant(w.end);
    const panchang: Array<{ label: string; value: string }> = [];
    if (w.tithi) panchang.push({ label: 'Tithi', value: w.tithi });
    if (w.nakshatra) {
      panchang.push({
        label: 'Nakshatra',
        // The pada is concatenated, not computed: both values are on the
        // window as the engine emitted them.
        value: w.pada === null ? w.nakshatra : `${w.nakshatra} (pada ${w.pada})`,
      });
    }
    if (w.yoga) panchang.push({ label: 'Yoga', value: w.yoga });
    if (w.karana) panchang.push({ label: 'Karana', value: w.karana });
    if (w.vara) panchang.push({ label: 'Vara', value: w.vara });
    return {
      date: start?.date ?? null,
      time: start && end ? `${start.time} – ${end.time}` : (start?.time ?? null),
      score: formatScore(w.score),
      lagna: w.lagna,
      lagnaLord: w.lagna_lord,
      moonSign: w.moon_sign,
      panchang,
      rahuKaal: w.rahu_kaal,
      benefics: w.benefics,
      malefics: w.malefics,
      namingLetter: w.naming_letter,
    };
  });
}

/**
 * The rahu-kaal flag's copy. The engine sets `rahu_kaal` per window and can
 * be configured to keep overlapping windows (`avoid_rahu_kaal=False`), so the
 * flag is shown rather than the window hidden — hiding it would be a
 * client-side filtering decision the row explicitly does not want.
 */
export const RAHU_KAAL_LABEL = 'Overlaps Rahu Kaal';
