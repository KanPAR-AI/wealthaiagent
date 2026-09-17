/**
 * best_days -> display rows (docs/64 W-3).
 *
 * The engine ranked the days, folded the purpose, banded each one and wrote
 * the verdict. Nothing here re-orders, re-scores or re-bands: the rows are
 * the payload's `ranked` in the payload's order, the top N of them, with
 * the engine's own sentences beside each. A tap on a row asks the host to
 * open that day's card — navigation is the host's, never the block's.
 */

import { formatIsoDate } from '../format';
import type { BestDay, BestDaysPayload } from '../payloads';

/** how many ranked days a chat bubble shows — the rest is the verdict */
export const BEST_DAYS_SHOWN = 5;

export interface BestDayRow {
  date: string;
  /** "Sat 19 Sep" — the engine's weekday, the date formatted like every other */
  when: string;
  band: string | null;
  bandLabel: string;
  /** "09:40–11:05" from the first golden window, or null */
  window: string | null;
  rahuKaal: string | null;
  /** the engine's purpose reasons first, then the day's own — bounded */
  why: string[];
  /** "You: Green · Nisha: Amber" */
  people: string | null;
  capped: boolean;
}

export const BAND_LABEL: Record<string, string> = {
  green: 'Green', amber: 'Amber', red: 'Red',
};

function bandLabel(band: string | null): string {
  return band ? (BAND_LABEL[band] ?? band) : 'Not scored';
}

function personLine(d: BestDay): string | null {
  const parts: string[] = [];
  for (const [name, p] of Object.entries(d.per_person)) {
    const who = name === 'you' ? 'You' : name;
    parts.push(`${who}: ${p.band ? bandLabel(p.band) : (p.absent ?? 'not scored')}`);
  }
  return parts.length > 1 ? parts.join(' · ') : null;
}

export function bestDayRows(payload: BestDaysPayload, shown = BEST_DAYS_SHOWN): BestDayRow[] {
  return payload.ranked.slice(0, shown).map((d) => ({
    date: d.date,
    when: `${d.weekday} ${formatIsoDate(d.date) ?? d.date}`,
    band: d.purpose_band,
    bandLabel: bandLabel(d.purpose_band),
    window: d.golden.length ? `${d.golden[0].start}–${d.golden[0].end}` : null,
    rahuKaal: d.rahu_kaal ? `${d.rahu_kaal.start}–${d.rahu_kaal.end}` : null,
    why: [...d.purpose_reasons, ...d.reasons].slice(0, 3),
    people: personLine(d),
    capped: d.caps.length > 0,
  }));
}

export function bestDaysTitle(payload: BestDaysPayload): string {
  const label = payload.label ? payload.label.toLowerCase() : 'anything important';
  const partner = payload.needs_partner ? payload.people.find((q) => q.has_chart) : undefined;
  return partner ? `Best days to ${label} — for you and ${partner.name}` : `Best days to ${label}`;
}

export function bestDaysSubtitle(payload: BestDaysPayload): string {
  const days = payload.horizon.days;
  const span = days ? `the next ${days} days` : 'the days ahead';
  return payload.personalized ? `${span}, from your Moon` : `${span} — the day's own score, not yet yours`;
}
