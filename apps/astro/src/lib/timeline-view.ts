// Screen 9's view model — dasha-first (docs/49 ASTRAL-127).
//
// PURE, like `daily-view.ts` next door, and for the same reason: the rules
// below are properties of a list and are enforced in the root jest project.
//
// ── the three rules ───────────────────────────────────────────────────────
//
//  1. THE CURRENT PERIOD IS THE HEADLINE. In the Vedic frame the dasha
//     periods are what a timeline is FOR, so `rows()` puts the period
//     containing today first — and when there is no dasha layer, the NAMED
//     ABSENCE stands in that slot rather than the page quietly starting at
//     the transit windows (AMB-16(b): a prominent absence, honestly
//     rendered).
//
//  2. THE YEAR PILLS FILTER ONE SET (ASTRAL-52). `years()` and `rows()` read
//     the artifact the screen already holds. There is no fetch in this file,
//     and a year change must never cause one — the dasha half is a pure
//     function of birth data and is byte-identical in 2035, so asking the
//     server for a year would be asking it to recompute what cannot change.
//
//  3. NO CATEGORY IS DECIDED HERE (ASTRAL-127's negative space). `categories`
//     arrives on every period, computed from the chart's own house lordships
//     (`timeline.py:categorise`). This file formats them and never maps a
//     planet, a house or a period to a life area.

import { formatIsoDate } from '@wealthai/astral';

import { titleFromKey } from './daily-view';
import { staleSentence } from './staleness';

import type {
  TimelineArtifact,
  TimelinePeriod,
  TimelineReady,
  TimelineResponse,
  TimelineWindow,
} from './people-shapes';

/** Engine basis keys are snake_case ("occupied_house"); a consumer screen
 * prints words. A label map at the view boundary, not a derivation. */
function prettyBasis(basis: string | null | undefined): string {
  if (!basis) return '';
  return basis.replace(/_/g, ' ');
}

export function isReady(res: TimelineResponse | null): res is TimelineReady {
  return !!res && res.state === 'ready';
}

export type RowKind = 'dasha' | 'antardasha' | 'transit' | 'absence';

export interface TimelineRow {
  id: string;
  kind: RowKind;
  /** the period's lord and level, or the transit's own description */
  title: string;
  /** the engine's categories, joined — never a category this file chose */
  subtitle: string;
  range: string;
  startYear: number | null;
  endYear: number | null;
  /** true for the period containing the artifact's `as_of` */
  current: boolean;
  categories: string[];
}

/** The year set the pills are drawn from — the artifact's own, never a
 *  range this file invented from a start date. */
export function years(artifact: TimelineArtifact): number[] {
  return [...(artifact.years ?? [])].sort((a, b) => a - b);
}

/**
 * The years worth OFFERING, which is not the same list.
 *
 * A Vimshottari table spans 120 years, so the raw set runs from birth to
 * long after; the board draws four pills around now. This returns a window
 * centred on the artifact's own `as_of` year, clamped to what the artifact
 * actually covers — a pill for a year the set has nothing in would be a
 * control that filters to an empty screen.
 */
export function yearPills(artifact: TimelineArtifact, span = 4): number[] {
  const all = years(artifact);
  if (!all.length) return [];
  const now = Number((artifact.as_of ?? '').slice(0, 4));
  const start = Number.isFinite(now) ? now : all[0];
  return all.filter((y) => y >= start && y < start + span);
}

/** The absence standing where the headline would be, or null when the dasha
 *  layer is present. */
export function namedAbsence(artifact: TimelineArtifact): { layer: string; reason: string } | null {
  const head = artifact.headline;
  if (head && head.kind === 'absent_layer') {
    return { layer: head.layer, reason: head.reason };
  }
  return null;
}

/**
 * Every row for `year`, or for the whole set when `year` is null — CURRENT
 * FIRST.
 *
 * The ordering is the row: ASTRAL-127 asks for a layout test asserting the
 * current dasha period is the first element, and the only way that can be
 * true regardless of which year is selected is for the decision to live
 * here rather than in a screen's JSX.
 */
export function rows(artifact: TimelineArtifact, year: number | null = null): TimelineRow[] {
  const dasha = artifact.dasha;
  const cursor = artifact.cursor ?? { mahadasha_index: null, antardasha_index: null, as_of: '' };
  const out: TimelineRow[] = [];

  if (!dasha) {
    const absence = namedAbsence(artifact);
    if (absence) {
      out.push({
        id: 'absence-dasha',
        kind: 'absence',
        title: 'Your dasha periods are not shown',
        subtitle: absence.reason,
        range: '',
        startYear: null,
        endYear: null,
        current: true,
        categories: [],
      });
    }
  } else {
    (dasha.periods ?? []).forEach((p, i) => {
      out.push(periodRow(p, 'dasha', `md-${i}`, i === cursor.mahadasha_index));
    });
    (dasha.sub_periods ?? []).forEach((p, i) => {
      out.push(periodRow(p, 'antardasha', `ad-${i}`, i === cursor.antardasha_index));
    });
  }

  (artifact.transit?.windows ?? []).forEach((w, i) => {
    out.push(windowRow(w, `tw-${i}`));
  });

  const filtered = year === null ? out : out.filter((r) => overlapsYear(r, year));
  // Current first, then by start year, then by kind so a mahadasha reads
  // above the antardashas inside it.
  const rank: Record<RowKind, number> = { absence: 0, dasha: 1, antardasha: 2, transit: 3 };
  return filtered.sort((a, b) => {
    if (a.current !== b.current) return a.current ? -1 : 1;
    if ((a.startYear ?? 0) !== (b.startYear ?? 0)) return (a.startYear ?? 0) - (b.startYear ?? 0);
    return rank[a.kind] - rank[b.kind];
  });
}

/** The rows a YEAR pill selects — the same one set, filtered in memory.
 *  Exported separately so a test can assert the filter is a filter. */
export function rowsInYear(artifact: TimelineArtifact, year: number): TimelineRow[] {
  return rows(artifact, year);
}

function overlapsYear(row: TimelineRow, year: number): boolean {
  // An absence has no dates and is never filtered away: the reason the
  // dasha layer is missing is true in every year, and a year pill that hid
  // it would produce the quiet decade ASTRAL-127 forbids.
  if (row.kind === 'absence') return true;
  if (row.startYear === null || row.endYear === null) return false;
  return row.startYear <= year && row.endYear >= year;
}

function periodRow(p: TimelinePeriod, kind: 'dasha' | 'antardasha', id: string,
                   current: boolean): TimelineRow {
  const level = kind === 'dasha' ? 'Mahadasha' : 'Antardasha';
  return {
    id,
    kind,
    title: `${p.planet} ${level.toLowerCase()}`,
    subtitle: (p.categories ?? []).map(capitalise).join(' · '),
    range: range(p.start_date, p.end_date),
    startYear: yearOf(p.start_date),
    endYear: yearOf(p.end_date),
    current,
    categories: p.categories ?? [],
  };
}

function windowRow(w: TimelineWindow, id: string): TimelineRow {
  // A classical-rule window carries no sign, so it is titled from the rule's
  // own key — TITLE-CASED, not renamed. The first sim run printed
  // "saturn_return" as a heading, which is a database column showing through
  // to a reader; `titleFromKey` is formatting and decides nothing.
  const title = w.planet && w.sign
    ? `${w.planet} in ${w.sign}`
    : (w.rule ? titleFromKey(w.rule) : (w.planet ?? 'Transit'));
  return {
    id,
    kind: 'transit',
    title,
    subtitle: w.description ?? (w.categories ?? []).map(capitalise).join(' · '),
    range: range(w.start_date, w.end_date),
    startYear: yearOf(w.start_date),
    endYear: yearOf(w.end_date),
    current: false,
    categories: w.categories ?? [],
  };
}

function yearOf(iso?: string): number | null {
  const y = Number((iso ?? '').slice(0, 4));
  return Number.isFinite(y) && y > 0 ? y : null;
}

function range(start?: string, end?: string): string {
  const a = formatIsoDate(start) ?? start ?? '';
  const b = formatIsoDate(end) ?? end ?? '';
  return a && b ? `${a} → ${b}` : a || b;
}

function capitalise(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// ── the honest states, shared shape with `daily-view` ─────────────────────

/** The daily read's shape, IMPORTED and re-exported rather than restated:
 *  one condition must not be able to grow two different asks, and two copies
 *  of this interface is exactly how it would (see `daily-view.ts`). */
import type { AbsentView } from './daily-view';

export type { AbsentView };

/** The same five states the daily read has, said for this screen. Kept here
 *  rather than shared because the SENTENCES differ: "today's reading" and
 *  "your timeline" are not interchangeable, and a generic string is how a
 *  screen ends up telling a user about a card they did not open. */
export function absentView(res: Exclude<TimelineResponse, TimelineReady>): AbsentView {
  const establish = "I'd like my birth chart.";
  const recast =
    'Please update my chart using the birth details you already have on file.';
  switch (res.state) {
    case 'not_established':
      return {
        title: 'Your details first',
        body: 'Your dasha periods are measured from where the Moon stood when you were born, so we need your birth details to draw them.',
        action: 'Add my birth details',
        turn: establish,
        destination: 'details',
      };
    case 'chart_absent':
      return {
        title: 'Your chart is not cast yet',
        body: 'The periods below come from your chart, and there is not one on file yet.',
        action: 'Cast my chart',
        turn: establish,
        // See daily-view: a person with no chart still has birth facts.
        destination: 'reading',
      };
    case 'chart_stale':
      return {
        title: 'Your chart needs recasting',
        // docs/49 ASTRAL-238: the CAUSE, from the one declared table — the
        // clause is shared with Home and the chart surface, and only the
        // consequence ("every date on a timeline moves") is local.
        body: staleSentence(
          res.chart?.stale,
          'every date on a timeline moves with it. Your details are already '
            + 'on file — one tap updates the chart.',
          res.chart?.computed_at),
        action: 'Update my chart',
        turn: recast,
        destination: 'reading',
      };
    case 'chart_unstamped':
    case 'chart_unprovable':
      return {
        title: 'This chart cannot be used',
        body: res.reason || 'We cannot draw a timeline from a chart we cannot verify.',
        action: 'Update my chart',
        turn: recast,
        destination: 'reading',
      };
    case 'refused':
    default:
      return {
        title: 'Your timeline is not ready',
        body: 'The timeline did not agree with your chart, so we are not showing it. Nothing is wrong with your details.',
        action: null,
        turn: null,
        destination: 'reading',
      };
  }
}

// ══════════════════════════════════════════════════════════════════════════
// The DRAWN spans (docs/49 ASTRAL-239 / ASTRAL-240)
//
// Everything below turns payload dates into bar geometry through `spans.ts`,
// and decides nothing else. In particular:
//
//   · which Sade-Sati leg is CURRENT arrives on the leg (`current`);
//   · which mahadasha and antardasha contain today arrive on the artifact's
//     `cursor`, computed server-side from the dates;
//   · a leg boundary is never computed here — retrogrades put the real
//     boundary months away from "the sign Saturn is in now", which is why
//     `sade_sati_span` searches for it and this file only draws it.
// ══════════════════════════════════════════════════════════════════════════

import { segmentOf, type Segment } from './spans';

export interface SadeSatiLeg extends Segment {
  id: string;
  /** the engine's own phase label: "pre / Aroha" … */
  phase: string;
  /** the sign Saturn occupies during this leg */
  sign: string;
  range: string;
  current: boolean;
  /** how many times Saturn retrogrades back into this sign — a real fact
   *  about the passage, and the reason the legs are not just three equal
   *  thirds */
  reEntries: number;
}

export interface SadeSatiBar {
  start: string;
  end: string;
  /** "30 Mar 2025 – 30 May 2032", formatted like every other range */
  range: string;
  legs: SadeSatiLeg[];
  /** the engine's own sentence about where the passage stands today */
  description: string;
}

/**
 * The Sade Sati bar — the true ~7.5-year passage and its three legs.
 *
 * REFUSES anything that is not that (F71/F85). Until 3c4610f the wire carried
 * `sade_sati.window`: the occupancy of the sign Saturn is in NOW, about two
 * and a half years, which every consumer read as the start and end of the
 * whole passage — so the product answered the market's most-asked question
 * off by up to five years. A window with no legs is therefore not drawn
 * SHORTER; it is not drawn at all, and the surface says the passage could not
 * be stated. Drawing a plausible bar is the failure this refusal exists for.
 */
export function sadeSatiBar(artifact: TimelineArtifact): SadeSatiBar | null {
  const window = (artifact.transit?.windows ?? [])
    .find((w) => w.rule === 'sade_sati');
  if (!window?.start_date || !window.end_date) return null;
  const legs = (window as { sub_phases?: unknown[] }).sub_phases;
  if (!Array.isArray(legs) || legs.length === 0) return null;

  const drawn: SadeSatiLeg[] = [];
  for (const raw of legs) {
    const leg = raw as {
      phase?: string; saturn_sign?: string; start?: string; end?: string;
      current?: boolean; retrograde_re_entries?: number;
    };
    const seg = segmentOf(window.start_date, window.end_date,
                          leg.start, leg.end);
    // A leg whose geometry cannot be computed drops the WHOLE bar: two legs
    // drawn out of three read as a shorter passage, which is the same lie
    // the old window told.
    if (!seg || !leg.phase || !leg.saturn_sign) return null;
    drawn.push({
      ...seg,
      id: `${leg.phase}-${leg.start}`,
      phase: leg.phase,
      sign: leg.saturn_sign,
      range: range(leg.start, leg.end),
      current: !!leg.current,
      reEntries: Number(leg.retrograde_re_entries ?? 0),
    });
  }
  return {
    start: window.start_date,
    end: window.end_date,
    range: range(window.start_date, window.end_date),
    legs: drawn,
    description: window.description ?? '',
  };
}

/** Said where the bar would have been, when the search found no passage or
 *  the wire carried the old shape. Never a bar. */
export const SADE_SATI_NOT_FOUND =
  'No Sade Sati passage is stated for this chart right now. When one is '
  + 'running, its full seven-and-a-half years and its three legs are drawn '
  + 'here — nothing shorter stands in for it.';

export interface DashaBand extends Segment {
  id: string;
  index: number;
  planet: string;
  range: string;
  /** the ENGINE's categories, and the basis it derived them from — an
   *  unexplained category is an interpretation wearing a computation's
   *  clothes (ASTRAL-240) */
  categories: string[];
  basis: string;
  current: boolean;
}

export interface DashaAxis {
  start: string;
  end: string;
  bands: DashaBand[];
  /** index into `bands` of the period containing the artifact's `as_of`, as
   *  the ENGINE's cursor decided it — never a device clock */
  currentIndex: number | null;
}

/** The mahadasha band: every period on one axis, the current one marked. */
export function dashaAxis(artifact: TimelineArtifact): DashaAxis | null {
  const periods = artifact.dasha?.periods ?? [];
  if (periods.length === 0) return null;
  const start = periods[0].start_date;
  const end = periods[periods.length - 1].end_date;
  const cursor = artifact.cursor?.mahadasha_index ?? null;
  const bands: DashaBand[] = [];
  periods.forEach((p, i) => {
    const seg = segmentOf(start, end, p.start_date, p.end_date);
    if (!seg) return;
    bands.push({
      ...seg,
      id: `md-${i}-${p.planet}`,
      index: i,
      planet: p.planet,
      range: range(p.start_date, p.end_date),
      categories: p.categories ?? [],
      basis: prettyBasis(p.category_basis),
      current: cursor === i,
    });
  });
  if (bands.length !== periods.length) return null;   // whole axis or none
  return { start, end, bands, currentIndex: cursor };
}

/**
 * The antardashas NESTED inside one mahadasha.
 *
 * `parent_index` and not the lord's name: the Vimshottari cycle is nine lords
 * long and the table is twelve periods, so "the Venus mahadasha" names two
 * different centuries (`timeline.py` says the same thing where it builds
 * them).
 */
export function antardashaBands(
  artifact: TimelineArtifact,
  mahadashaIndex: number,
): DashaBand[] {
  const parent = (artifact.dasha?.periods ?? [])[mahadashaIndex];
  if (!parent) return [];
  const cursor = artifact.cursor?.antardasha_index ?? null;
  const subs = artifact.dasha?.sub_periods ?? [];
  const out: DashaBand[] = [];
  subs.forEach((p, i) => {
    if (p.parent_index !== mahadashaIndex) return;
    const seg = segmentOf(parent.start_date, parent.end_date,
                          p.start_date, p.end_date);
    if (!seg) return;
    out.push({
      ...seg,
      id: `ad-${i}-${p.planet}`,
      index: i,
      planet: p.planet,
      range: range(p.start_date, p.end_date),
      categories: p.categories ?? [],
      basis: prettyBasis(p.category_basis),
      current: cursor === i,
    });
  });
  return out;
}
