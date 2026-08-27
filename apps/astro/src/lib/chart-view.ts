// Screen 5's view model — Chart · Grahas · Dasha (docs/49 ASTRAL-120,
// ASTRAL-233..238).
//
// PURE, like every other `*-view.ts` in this folder: no React, no
// react-native, no expo, no clock. The screen renders what these functions
// return and decides nothing, which is what lets the rules below be tested in
// the root jest project instead of read off a screenshot.
//
// ── the four rules this file exists to keep ──────────────────────────────
//
//  1. NOTHING IS DERIVED (ASTRAL-19/183/230). Not a rashi number, not a
//     navamsa sign, not a house from a longitude, not a dasha length. Every
//     label on this screen is a field of the artifact: the engine gained
//     `sign`, `rashi_number`, `ascendant_sign`, `ascendant_rashi_number` and
//     the twelve `cells` per model precisely so this file has nothing to
//     compute (F83). The one temptation the old greps did NOT catch is
//     `sign_index + 1`, and it does not appear here.
//
//  2. WHAT IS WITHHELD IS WITHHELD, NOT DASHED (ASTRAL-137). The register
//     drives it server-side: a time-less chart's response simply has no
//     `ascendant`, no `houses`, no `dasha_periods` and no
//     `divisional_charts`. So the house column is ABSENT rather than blank,
//     and the register's own sentence stands where the value would have
//     been. There is no `—` in this file.
//
//  3. A CHART WITHOUT ITS FRAME IS NOT A CHART (ASTRAL-118/237). Five stamp
//     values, including the node model and the engine version, or the honest
//     error state — never a chart with a shorter footer.
//
//  4. THE ENGINE'S OWN WORDS (ASTRAL-166/172/236). A yoga card prints the
//     engine's string character for character; a dignity prints the engine's
//     word, including "enemy's sign". Nothing here parses a basis out of
//     prose, and nothing here prettifies one.

import { formatDegrees, formatIsoDate, modelCells } from '@wealthai/astral';
import type { DiamondCell } from '@wealthai/astral';

import { staleSentence } from './staleness';
import type {
  ChartModel,
  ChartResponse,
  FullChart,
  Undetermined,
} from './people-shapes';

// ── the state, before anything is drawn ───────────────────────────────────

export type ChartSurfaceState =
  | 'ready'
  | 'stale'
  | 'absent'
  | 'unstamped'
  | 'unprovable'
  | 'withdrawn';

export interface SurfaceState {
  state: ChartSurfaceState;
  /** the sentence under the heading — the engine's cause, in our words */
  sentence: string;
  /** whether the chart's CONTENTS may be drawn at all */
  drawable: boolean;
}

const READABLE = new Set(['fresh', 'stale', 'corrected_stale']);

/**
 * Which of the five states this response is in.
 *
 * A STALE chart is still drawn — it is a real chart that was really cast, and
 * hiding it would leave the user with nothing while telling them their
 * details changed — but it is drawn UNDER its cause (ASTRAL-238). An
 * UNSTAMPED one is not drawn at all: a sidereal reading of a chart that
 * cannot say it was cast sidereally is three signs of wrong (ASTRAL-118).
 *
 * …and a WITHDRAWN-time chart is not drawn either. PH-27 Role-4 BLOCKER 3,
 * measured on the device: after withdrawing the birth time from Profile,
 * this screen still printed "Time 10:30" and drew the lagna, the houses and
 * D9 behind a staleness banner, while Profile said the time was not known.
 * ASTRAL-243's gate is that the lagna disappears from EVERY surface, and a
 * banner over a full chart is not a disappearance: every value on it stands
 * on the very time the user just told us they do not have. The read carries
 * both facts — `tob_known` from the store, `time_known` from the artifact —
 * so the disagreement is visible here and needs no new endpoint.
 */
export function surfaceState(res: ChartResponse | null): SurfaceState {
  const chart = res?.chart;
  const status = String(chart?.status ?? 'absent');
  if (status === 'absent') {
    return {
      state: 'absent',
      sentence: chart?.reason
        || 'No chart has been cast for you yet.',
      drawable: false,
    };
  }
  if (status === 'unstamped') {
    return {
      state: 'unstamped',
      sentence: chart?.reason
        || 'This chart does not record the frame it was cast in, so its '
           + 'values cannot be shown.',
      drawable: false,
    };
  }
  if (status === 'unprovable') {
    return {
      state: 'unprovable',
      sentence: 'This chart was stored without a derivation record, so we '
        + 'cannot prove it still matches your details.',
      drawable: false,
    };
  }
  if (!READABLE.has(status)) {
    return { state: 'absent', sentence: chart?.reason || '', drawable: false };
  }
  // ASTRAL-237's second half, enforced HERE and not only by the server's
  // three-field test: node_model and engine_version first exist at
  // natal_chart v6 (PH-20), so every chart cast before that reaches this
  // surface readable-but-unstampable — the entire pre-PH-20 user base on
  // the day this screen ships (Role-3 blocker). A chart that cannot name
  // its frame is not drawn with a shorter footer; it is not drawn.
  if (!stampIsComplete(chart)) {
    return {
      state: 'unstamped',
      sentence: 'This chart does not record the frame it was cast in, so '
        + 'its values cannot be shown. Missing from its record: '
        + missingStampFields(chart).join(', ')
        + '. Ask for any reading and it will be recast in full.',
      drawable: false,
    };
  }
  // BLOCKER 3. Placed AFTER the stamp test on purpose: ASTRAL-118 is an
  // invariant about what may be drawn at all, and this is a cause. Both
  // refuse; when both apply the invariant names itself first.
  if (res?.tob_known === false && chart?.time_known === true) {
    const cast = formatIsoDate(String(chart?.computed_at ?? '').slice(0, 10));
    return {
      state: 'withdrawn',
      sentence: 'Your birth time was removed after this chart was cast'
        + (cast ? ` on ${cast}` : '')
        + ', and every value on it — the lagna, the houses, the divisional '
        + 'charts and the dasha periods — was read from that time. The chart '
        + 'needs recasting: ask for any reading and it will be cast again '
        + 'without a birth time.',
      drawable: false,
    };
  }
  if (status === 'fresh') {
    return { state: 'ready', sentence: '', drawable: true };
  }
  return {
    state: 'stale',
    sentence: staleSentence(
      chart?.stale,
      'the positions below are the ones it was cast with.',
      chart?.computed_at),
    drawable: true,
  };
}

/**
 * The stamp, in full, and the second half of ASTRAL-237: a chart whose stamp
 * is INCOMPLETE renders the error state rather than a shorter footer.
 *
 * `stampIsComplete` in the shared package answers the same question for the
 * chat block's payload; this one answers it for the read's own shape.
 */
export const STAMP_FIELDS = [
  'zodiac_mode', 'ayanamsa', 'house_system', 'node_model', 'engine_version',
] as const;

export function stampIsComplete(chart: FullChart | undefined): boolean {
  return !!chart && STAMP_FIELDS.every((f) => !!chart[f]);
}

export function missingStampFields(chart: FullChart | undefined): string[] {
  return STAMP_FIELDS.filter((f) => !chart?.[f]);
}

export interface Stamp {
  /** "sidereal · Lahiri · whole_sign · mean node · kerykeion/5.12.9" */
  line: string;
  /** "Cast on 24 Aug 2026" — the date, formatted like every other date */
  computed: string | null;
}

export function stampLine(chart: FullChart | undefined): Stamp | null {
  if (!chart || !stampIsComplete(chart)) return null;
  const ZODIAC: Record<string, string> = { sidereal: 'Sidereal',
    tropical: 'Tropical' };
  const AYANAMSA: Record<string, string> = { LAHIRI: 'Lahiri' };
  const HOUSES: Record<string, string> = { W: 'Whole Sign' };
  const label = (m: Record<string, string>, v: string | undefined) =>
    (v && Object.prototype.hasOwnProperty.call(m, v) ? m[v] : (v ?? ''));
  return {
    line: [label(ZODIAC, chart.zodiac_mode),
           label(AYANAMSA, chart.ayanamsa),
           label(HOUSES, chart.house_system),
           `${chart.node_model} node`, chart.engine_version].join(' · '),
    computed: chart.computed_at
      ? formatIsoDate(chart.computed_at.slice(0, 10))
      : null,
  };
}

// ── the birth block (ASTRAL-245) ─────────────────────────────────────────

export interface BirthLine {
  key: string;
  label: string;
  value: string;
}

/**
 * The birth instant AS RECORDED, beside the zone it was pinned to.
 *
 * docs/49 ASTRAL-245 / F94: nothing here may say a time was rounded,
 * approximated or defaulted, because the record does not say so. `23:45` and
 * `16:00` are both printed exactly as the user gave them — the shape of a
 * number is not evidence about it. The zone and the offset ride alongside
 * because they are what turn a wall clock into a moment, and a user
 * comparing our chart with another astrologer's needs both.
 *
 * A chart with no birth time shows NO time row at all (the register's
 * sentence says why, elsewhere on the screen) rather than a placeholder.
 */
export function birthLines(chart: FullChart | undefined): BirthLine[] {
  const bd = chart?.birth_data;
  if (!bd) return [];
  const out: BirthLine[] = [];
  const date = formatIsoDate(bd.date_of_birth);
  if (date) out.push({ key: 'date', label: 'Born', value: date });
  if (chart?.time_known && bd.time_of_birth) {
    out.push({ key: 'time', label: 'Time', value: bd.time_of_birth });
  }
  if (bd.place_of_birth) {
    out.push({ key: 'place', label: 'Place', value: bd.place_of_birth });
  }
  if (bd.timezone) {
    const offset = formatOffset(bd.utc_offset_minutes);
    out.push({
      key: 'zone',
      label: 'Zone',
      value: offset ? `${bd.timezone} (${offset})` : bd.timezone,
    });
  }
  return out;
}

/**
 * `330` -> `"UTC+05:30"`. NOTATION, not arithmetic on a claim: the payload
 * states the offset the chart was pinned to and this writes it the way a
 * clock does. It is the one number this file re-notates, and it is here
 * rather than in a screen for that reason.
 */
export function formatOffset(minutes: number | null | undefined): string | null {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return null;
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `UTC${sign}${hh}:${mm}`;
}

// ── the calculated charts (ASTRAL-234) ───────────────────────────────────

export interface DrawnChart {
  key: string;
  /** the ENGINE's title, verbatim — the same words the PDF prints */
  title: string;
  /** "Cancer · rashi 4" — both labels come off the model */
  ascendant: string;
  /** the twelve cells, through the workspace's ONE cell builder */
  cells: DiamondCell[];
}

/**
 * The models this chart carries, in the declared order, each with the twelve
 * cells the engine drew for it.
 *
 * A model the artifact does not carry is NOT here — it is in
 * `absentModels()` with the register's own reason, because an empty diamond
 * and a greyed one are the same lie in different clothes (ASTRAL-185).
 */
export const MODEL_ORDER = ['D1', 'MOON', 'D9'] as const;

export function drawnCharts(chart: FullChart | undefined): DrawnChart[] {
  const models = chart?.divisional_charts ?? [];
  const byKey = new Map<string, ChartModel>(
    models.filter((m) => !!m?.key).map((m) => [String(m.key), m]));
  const out: DrawnChart[] = [];
  for (const key of MODEL_ORDER) {
    const model = byKey.get(key);
    // A model with no cells cannot be drawn — and is not drawn empty. The
    // cells come from the engine (`divisional_chart_cells`); a chart cast
    // before they travelled has none, and a diamond invented from the
    // placements would be this file deriving the rashi numbers.
    if (!model || !model.cells || model.cells.length !== 12) continue;
    // Parse-don't-trust, at the surface: a model that arrived without its
    // labels is drawn WITHOUT an ascendant line rather than with an
    // "undefined · rashi undefined" one. The engine labels every model it
    // serves (including a pre-v7 one, from the same cell table), so this is
    // the belt to that braces.
    if (!model.ascendant_sign || model.ascendant_rashi_number === undefined) {
      continue;
    }
    out.push({
      key,
      title: model.title,
      ascendant: `${model.ascendant_sign} · rashi ${model.ascendant_rashi_number}`,
      // `modelCells` is the shared builder — the same one the chat block's
      // diamond goes through — so the two surfaces cannot fill the same
      // geometry two different ways.
      cells: modelCells(model),
    });
  }
  return out;
}

export interface AbsentModel {
  key: string;
  /** the register's own sentence — never one composed here */
  reason: string;
  /** the fact that would unlock it, when one would */
  unlockedBy: string | null;
}

/** Which calculated charts are missing, and the register's reason for each.
 *  `divisional_charts` covers D1 and D9 (both rotations of the lagna);
 *  `moon_chart` covers the Moon chart on a boundary date. */
const MODEL_REGISTER: Record<string, string[]> = {
  D1: ['divisional_charts'],
  D9: ['divisional_charts'],
  MOON: ['moon_chart', 'divisional_charts'],
};

export function absentModels(chart: FullChart | undefined): AbsentModel[] {
  const present = new Set(drawnCharts(chart).map((d) => d.key));
  const register = chart?.undetermined ?? [];
  const out: AbsentModel[] = [];
  for (const key of MODEL_ORDER) {
    if (present.has(key)) continue;
    const entry = register.find(
      (e) => (MODEL_REGISTER[key] ?? []).includes(String(e.field)));
    if (!entry) continue;   // absent with no stated reason is said nowhere
    out.push({
      key,
      reason: entry.reason,
      unlockedBy: entry.unlocked_by || null,
    });
  }
  return out;
}

// ── the planet table (ASTRAL-235) ────────────────────────────────────────

export interface PlanetRow {
  planet: string;
  /** the rashi NAME the engine stored */
  sign: string;
  /** the degree WITHIN the sign, formatted; null on a pre-v4 chart, and then
   *  no degree is shown AT ALL — never the absolute longitude, which is
   *  three signs of wrong beside a sign name */
  degree: string | null;
  /** null on a time-less chart, and the column is then absent entirely */
  house: string | null;
  nakshatra: string | null;
  pada: string | null;
  /** the ENGINE's word, including "enemy's sign" (ASTRAL-172) */
  dignity: string | null;
  retrograde: boolean;
}

export function planetRows(chart: FullChart | undefined): PlanetRow[] {
  return (chart?.planets ?? []).map((p) => ({
    planet: p.planet,
    sign: p.sign,
    degree: formatDegrees(p.sign_degree),
    house: p.house === null || p.house === undefined ? null : String(p.house),
    nakshatra: p.nakshatra ?? null,
    pada: p.nakshatra_pada === null || p.nakshatra_pada === undefined
      ? null : String(p.nakshatra_pada),
    dignity: p.dignity ?? null,
    retrograde: !!p.retrograde,
  }));
}

/** Which columns this chart HAS. A time-less chart has no house column and
 *  no pada column — absent, not blank (ASTRAL-79/137). */
export function columns(chart: FullChart | undefined): {
  house: boolean; pada: boolean; degree: boolean;
} {
  const rows = planetRows(chart);
  return {
    house: rows.some((r) => r.house !== null),
    pada: rows.some((r) => r.pada !== null),
    degree: rows.some((r) => r.degree !== null),
  };
}

// ── the register (ASTRAL-79) ─────────────────────────────────────────────

export interface RegisterNote {
  field: string;
  title: string;
  reason: string;
  alternatives: string[];
}

/** Field key -> the heading a reader recognises. A closed table: a register
 *  entry this app has no title for keeps the engine's own field name rather
 *  than being dropped, because dropping it would hide the absence. */
const REGISTER_TITLES: Record<string, string> = {
  lagna: 'Lagna (Ascendant)',
  houses: 'The bhavas',
  nakshatra_pada: 'Nakshatra pada',
  dasha: 'The dasha periods',
  divisional_charts: 'The calculated charts',
  moon_chart: 'The Moon chart',
  moon_rashi: 'The Moon’s rashi',
  moon_nakshatra: 'The Moon’s nakshatra',
};

export function registerNotes(chart: FullChart | undefined): RegisterNote[] {
  return (chart?.undetermined ?? []).map((e: Undetermined) => ({
    field: e.field,
    title: REGISTER_TITLES[e.field] ?? e.field,
    reason: e.reason,
    alternatives: e.alternatives ?? [],
  }));
}

/** The ONE sentence that stands where the house column would be. Taken from
 *  the register rather than written here, and rendered once. */
export function timelessNote(chart: FullChart | undefined): string | null {
  if (chart?.time_known !== false) return null;
  const entry = (chart.undetermined ?? []).find((e) => e.field === 'houses');
  return entry?.reason ?? null;
}

// ── yogas (ASTRAL-236) ───────────────────────────────────────────────────

/**
 * The engine's yoga strings, verbatim.
 *
 * ASTRAL-166 made each string state its TESTED configuration ("Mars is
 * Yogakaraka for Cancer Lagna, as lord of the 5th and 10th houses"), so the
 * card renders the sentence and this file does not parse a basis out of it —
 * no regex for planet names, no splitting on "via", no inferred category.
 * When PH-22's yoga ids land the card binds to the id and gains grouping;
 * that is a planned second step, not an improvised parse now.
 *
 * An empty list renders NO section (the screen checks `length`), rather than
 * a heading over "no yogas found" — the engine simply computed none, which
 * is a different statement.
 */
export function yogaCards(chart: FullChart | undefined): string[] {
  return (chart?.yogas ?? []).filter((y) => typeof y === 'string' && y.trim());
}

// ── the dasha list (ASTRAL-240's rule, on this surface) ──────────────────

export interface DashaRow {
  id: string;
  planet: string;
  start: string | null;
  end: string | null;
  /** decided by the ENGINE from the stored dates, never from `is_current`
   *  and never from a device clock */
  current: boolean;
}

/**
 * The Vimshottari table, with the current period marked.
 *
 * "Current" comes from the read's own `mahadasha` block, which
 * `chart.py:current_mahadasha` decided by comparing today against the stored
 * dates — deliberately NOT the artifact's `is_current` flag, which records
 * what was true on the day the chart was cast and quietly goes false with the
 * calendar. This file reads no clock, so it could not make that decision even
 * if it wanted to.
 */
export function dashaRows(chart: FullChart | undefined): DashaRow[] {
  const current = chart?.mahadasha;
  return (chart?.dasha_periods ?? []).map((d) => ({
    id: `${d.planet}-${d.start_date}`,
    planet: d.planet,
    start: formatIsoDate(d.start_date),
    end: formatIsoDate(d.end_date),
    current: !!current && current.planet === d.planet
      && current.start_date === d.start_date,
  }));
}

/** The current mahadasha / antardasha pair, for the header. Absent — not
 *  hedged — on a chart with no birth time. */
export function currentPeriod(chart: FullChart | undefined): {
  mahadasha: string; antardasha: string | null;
} | null {
  const md = chart?.mahadasha;
  if (!md?.planet) return null;
  const ad = chart?.antardasha;
  return {
    mahadasha: md.planet,
    antardasha: ad?.planet ?? null,
  };
}

// ── the tabs (ASTRAL-120) ────────────────────────────────────────────────

export type ChartTabId = 'chart' | 'grahas' | 'dasha';

export interface ChartTab {
  id: ChartTabId;
  label: string;
}

/**
 * Chart · Grahas · Dasha — and there is NO Aspects tab in this frame.
 *
 * ASTRAL-120 supersedes the board's `Chart / Placements / Aspects`: drishti
 * is whole-sign and already adjudicated, and if a drishti view is ever drawn
 * it is a new decision rather than this tab renamed.
 *
 * A tab whose content the chart does not carry is NOT offered: a time-less
 * chart has no dasha table, so it has no Dasha tab — the register's sentence
 * says why on the Grahas tab instead.
 */
export function tabs(chart: FullChart | undefined): ChartTab[] {
  const out: ChartTab[] = [];
  if (drawnCharts(chart).length) out.push({ id: 'chart', label: 'Chart' });
  if (planetRows(chart).length) out.push({ id: 'grahas', label: 'Grahas' });
  if (dashaRows(chart).length) out.push({ id: 'dasha', label: 'Dasha' });
  return out;
}

/**
 * The header's mahadasha / antardasha chip, for a WHOLE response.
 *
 * PH-27 Role-4 (non-blocking finding, fixed with BLOCKER 3): the screen read
 * `currentPeriod(chart)` and drew the pill in the header, above and outside
 * the `state.drawable` branch — so a chart that had just refused to draw
 * still announced "Rahu / Jupiter" at the top. A dasha pair is a chart-
 * derived claim like any other: it stands on the same artifact, the same
 * time and the same stamp, and it goes silent when they do.
 */
export function headerPeriod(res: ChartResponse | null): {
  mahadasha: string; antardasha: string | null;
} | null {
  if (!surfaceState(res).drawable) return null;
  return currentPeriod(res?.chart);
}
