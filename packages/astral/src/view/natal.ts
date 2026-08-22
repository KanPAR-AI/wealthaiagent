/**
 * natal_chart -> display rows. No arithmetic: every number here arrives from
 * `format.ts` or is a string the payload already carried (ASTRAL-19).
 */

import { formatDegrees, formatIsoDate } from '../format';
import type { NatalChartPayload, NatalPlanet } from '../payloads';

/** Same abbreviations as the Kundli PDF (`export_pdf.py:_PLANET_ABBR`). */
const PLANET_ABBR: Record<string, string> = {
  Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju',
  Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke',
};

export function planetAbbr(name: string): string {
  return PLANET_ABBR[name] ?? name.slice(0, 2);
}

export interface PlacementRow {
  planet: string;
  sign: string;
  /** absolute ecliptic longitude, formatted to the arcminute; see format.ts */
  longitude: string | null;
  /** null on a time-less chart — rendered as an absent cell, not a dash-zero */
  house: string | null;
  nakshatra: string | null;
  pada: string | null;
  dignity: string | null;
  retrograde: boolean;
}

export function placementRows(chart: NatalChartPayload): PlacementRow[] {
  return chart.planets.map((p: NatalPlanet) => ({
    planet: p.planet,
    sign: p.sign,
    longitude: formatDegrees(p.degree),
    house: p.house === null ? null : String(p.house),
    nakshatra: p.nakshatra,
    pada: p.nakshatra_pada === null ? null : String(p.nakshatra_pada),
    dignity: p.dignity,
    retrograde: p.retrograde,
  }));
}

/** house number -> the graha abbreviations that sit in it, for the diamond. */
export function houseOccupants(chart: NatalChartPayload): Map<number, string[]> {
  const byHouse = new Map<number, string[]>();
  for (const p of chart.planets) {
    if (p.house === null) continue;
    const abbr = planetAbbr(p.planet) + (p.retrograde ? '(R)' : '');
    const bucket = byHouse.get(p.house);
    if (bucket) bucket.push(abbr);
    else byHouse.set(p.house, [abbr]);
  }
  return byHouse;
}

/**
 * The calculation stamp, read off the artifact (INV-3 / ASTRAL-5-6).
 *
 * Returns null when the chart carries no `zodiac_mode`. A chart that cannot
 * say what frame produced its degrees gets NO stamp line rather than a
 * plausible one — the same posture `export_pdf.calculation_stamp_line` takes
 * when it raises.
 */
export function calculationStamp(chart: NatalChartPayload): string | null {
  if (!chart.zodiac_mode) return null;
  const parts = [chart.zodiac_mode];
  if (chart.ayanamsa) parts.push(chart.ayanamsa);
  if (chart.house_system) parts.push(chart.house_system);
  return parts.join(' · ');
}

export interface BirthLine {
  label: string;
  value: string;
}

/**
 * The birth block. NOTE for ASTRAL-63: latitude/longitude are deliberately
 * NOT surfaced here even though the payload ships them — this view model is
 * reused by the share card work, and coordinates must never reach it.
 */
export function birthLines(chart: NatalChartPayload): BirthLine[] {
  const bd = chart.birth_data;
  if (!bd) return [];
  const lines: BirthLine[] = [];
  const date = formatIsoDate(bd.date_of_birth);
  if (date) lines.push({ label: 'Born', value: date });
  if (bd.time_of_birth && chart.time_known) {
    lines.push({ label: 'Time', value: bd.time_of_birth });
  }
  if (bd.place_of_birth) lines.push({ label: 'Place', value: bd.place_of_birth });
  return lines;
}

/**
 * Why the house ring and the ascendant marker are missing.
 *
 * ASTRAL-15: "When time_known=false the house ring and the ascendant marker
 * are ABSENT, replaced by a stated reason — never drawn faintly or greyed."
 *
 * The wording is the PDF's (`export_pdf.py`, ASTRAL-9), minus its
 * divisional-chart promise: no varga is computed anywhere in the package, so
 * only the two real unlocks are named.
 */
export const NO_BIRTH_TIME_REASON =
  'Bhavas (houses) and the Lagna are not shown: they are counted from the ' +
  'Lagna, and the Lagna moves a full sign every two hours. With a birth ' +
  'time this chart gains the Lagna, the house chart, and 21 of the 36 ' +
  'gunas in matching.';

/**
 * The Moon may be elsewhere. Built only from `moon_sign_alternatives` /
 * `moon_nakshatra_alternatives`, which the engine carries precisely so a
 * renderer does not have to guess (ASTRAL-9).
 */
export function moonAmbiguityNote(chart: NatalChartPayload): string | null {
  if (chart.time_known) return null;
  const signs = chart.moon_sign_alternatives;
  const naks = chart.moon_nakshatra_alternatives;
  if (signs.length === 0 && naks.length === 0) return null;
  const parts: string[] = [];
  if (signs.length) parts.push(`its sign may instead be ${signs.join(' / ')}`);
  if (naks.length) parts.push(`its nakshatra may be ${naks.join(' / ')}`);
  return `No birth time: the Moon moves about 13 degrees a day, so ${parts.join(', and ')}.`;
}

export interface DashaRow {
  planet: string;
  start: string | null;
  end: string | null;
  isCurrent: boolean;
}

/**
 * The Vimshottari table, bounded the same way the PDF bounds it
 * (`export_pdf.DASHA_PERIODS_SHOWN = 4`, ASTRAL-14): the current period plus
 * the next three. A 120-year cycle running to 2142 beside interpretive
 * language about health is the thing that row removed; it is not reintroduced
 * here.
 */
export const DASHA_PERIODS_SHOWN = 4;

export function dashaRows(chart: NatalChartPayload): DashaRow[] {
  const periods = chart.dasha_periods;
  const currentIndex = periods.findIndex((d) => d.is_current);
  const from = currentIndex === -1 ? 0 : currentIndex;
  return periods.slice(from, from + DASHA_PERIODS_SHOWN).map((d) => ({
    planet: d.planet,
    start: formatIsoDate(d.start_date),
    end: formatIsoDate(d.end_date),
    isCurrent: d.is_current,
  }));
}
