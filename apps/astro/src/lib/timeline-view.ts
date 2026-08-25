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

import type {
  TimelineArtifact,
  TimelinePeriod,
  TimelineReady,
  TimelineResponse,
  TimelineWindow,
} from './people-shapes';

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
        body: 'Your birth details changed after this chart was cast, and every date on a timeline moves with them. Your details are already on file — one tap updates the chart.',
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
