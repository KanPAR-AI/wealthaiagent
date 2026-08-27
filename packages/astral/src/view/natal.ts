/**
 * natal_chart -> display rows. No arithmetic: every number here arrives from
 * `format.ts` or is a string the payload already carried (ASTRAL-19).
 */

import { formatDegrees, formatIsoDate } from '../format';
import type { DivisionalChart, NatalChartPayload, NatalPlanet } from '../payloads';

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
  /**
   * The degree WITHIN the sign, formatted to the arcminute (see format.ts).
   * Named `degree` and not `longitude` since A6#13: it is not a longitude,
   * and calling it one is how the absolute value got rendered beside a sign.
   */
  degree: string | null;
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
    // A6#13: the within-sign degree is what sits beside a sign name. Null
    // on a pre-v4 chart, and then the cell is empty rather than showing the
    // absolute longitude, which reads as an impossible position.
    degree: formatDegrees(p.sign_degree),
    house: p.house === null ? null : String(p.house),
    nakshatra: p.nakshatra,
    pada: p.nakshatra_pada === null ? null : String(p.nakshatra_pada),
    dignity: p.dignity,
    retrograde: p.retrograde,
  }));
}

// ── one diamond, three ways to fill it (docs/49 ASTRAL-234) ───────────────
//
// The chart surface draws D1, the Moon chart and D9 from their own models;
// the chat block draws the rashi chart from the planet list. Both go through
// ONE component (`ChartDiamond`) and therefore need one cell shape. This is
// that shape, and the two builders below are the only places it is made.

export interface DiamondCell {
  house: number;
  /** what sits in the cell's corner: a rashi NUMBER when the engine sent
   *  cells (the convention the Kundli PDF prints, AMB-36(a)), a house number
   *  when it did not */
  label: string;
  /** graha abbreviations, in the model's own order */
  tokens: string[];
}

/**
 * The twelve cells of one calculated chart.
 *
 * When the engine sent `cells` — the chart READ does, `divisional_chart_cells`
 * built them, and the PDF prints the same ones — they are used verbatim,
 * rashi numbers and all. When it did not (the chat block carries the raw
 * artifact), the diamond falls back to HOUSE numbers built from the model's
 * own placements.
 *
 * What this function must never do is compute the missing rashi numbers.
 * `((ascendant + house - 1) % 12) + 1` is a rashi number derived by a
 * renderer, which is the whole of ASTRAL-230, and the fallback exists so it
 * never has to be written.
 */
export function modelCells(model: DivisionalChart): DiamondCell[] {
  if (model.cells && model.cells.length === 12) {
    return model.cells.map((c) => ({
      house: c.house,
      label: String(c.rashi_number),
      tokens: [...c.tokens],
    }));
  }
  const byHouse = new Map<number, string[]>();
  for (const p of model.placements) {
    const bucket = byHouse.get(p.house);
    if (bucket) bucket.push(planetAbbr(p.body));
    else byHouse.set(p.house, [planetAbbr(p.body)]);
  }
  return HOUSE_NUMBERS.map((house) => ({
    house,
    label: String(house),
    tokens: byHouse.get(house) ?? [],
  }));
}

const HOUSE_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** …and the rashi chart from a `natal_chart` payload's planet list, which is
 *  what the chat block has. House numbers, because the payload's planets
 *  carry no rashi number for an EMPTY house. */
export function payloadCells(chart: NatalChartPayload): DiamondCell[] {
  const occupants = houseOccupants(chart);
  return HOUSE_NUMBERS.map((house) => ({
    house,
    label: String(house),
    tokens: occupants.get(house) ?? [],
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
  // docs/49 ASTRAL-237 (F83). The node model and the engine version have
  // been on the wire since PH-20 and no client read either. They belong
  // here and not in a footnote: mean and true Rahu differ by about a
  // degree, which at a boundary moves a rashi, a nakshatra, a dasha
  // sequence and a koota — and "why does your Rahu differ from my family
  // astrologer's" is a question this line answers.
  if (chart.node_model) parts.push(`${chart.node_model} node`);
  if (chart.engine_version) parts.push(chart.engine_version);
  return parts.join(' · ');
}

/**
 * The five stamp fields a POST-PH-20 chart must carry, named.
 *
 * `calculationStamp` degrades for a legacy artifact — it prints what is
 * there — because the chat block has always drawn v3 charts and removing
 * them from a transcript retroactively would be its own dishonesty. The
 * chart SURFACE is stricter: `summarise`'s UNSTAMPED contract says a chart
 * that cannot name its frame is not rendered as a chart at all, and this is
 * the predicate that surface asks (ASTRAL-118/237).
 */
export function stampIsComplete(chart: NatalChartPayload): boolean {
  return Boolean(chart.zodiac_mode && chart.ayanamsa && chart.house_system
                 && chart.node_model && chart.engine_version);
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
