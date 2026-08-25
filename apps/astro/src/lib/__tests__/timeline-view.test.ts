/**
 * docs/49 ASTRAL-127 — the timeline is dasha-first, and the year pills
 * filter ONE computed set.
 *
 * The fixtures are REAL captures of `artifacts.py:self_timeline` over a
 * chart `compute_natal_chart` cast: twelve mahadashas, their antardashas and
 * the slow-mover windows, exactly as the wire carries them.
 */

import fs from 'fs';
import path from 'path';

import {
  absentView,
  isReady,
  namedAbsence,
  rows,
  rowsInYear,
  yearPills,
  years,
} from '../timeline-view';
import type { TimelineReady, TimelineResponse } from '../people-shapes';

/**
 * A module's CODE, with comments removed.
 *
 * The source greps below are about what the file DOES, and a comment that
 * names the thing being forbidden ("there is no recompute endpoint", "a
 * `new Date()` here would…") is the file explaining itself, not doing it.
 * Grepping raw source made those two sentences unwritable, which is a test
 * shaping prose rather than behaviour. Stripping comments first also makes
 * the grep stricter in the direction that matters: a real call cannot hide
 * inside a comment either.
 */
const codeOf = (file: string) =>
  fs
    .readFileSync(path.join(__dirname, '..', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const load = (name: string) =>
  JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures', `${name}.json`), 'utf8'),
  ) as TimelineResponse;

const READY = load('timeline') as TimelineReady;
const TIMELESS = load('timeline_timeless') as TimelineReady;

describe('dasha-first (ASTRAL-127)', () => {
  it('the CURRENT period is the first element', () => {
    // The layout-order test the row asks for. In the Vedic frame the dasha
    // period IS the headline — this is what an Indian user opens a timeline
    // for — so it cannot be an ordering a screen happens to apply.
    const first = rows(READY.timeline)[0];
    expect(first.current).toBe(true);
    expect(first.kind).toBe('dasha');
    const head = READY.timeline.headline;
    if (head.kind !== 'dasha_period') throw new Error('fixture lost its headline');
    expect(first.title).toContain(head.mahadasha.planet);
  });

  it('the current period carries its dates', () => {
    const first = rows(READY.timeline)[0];
    expect(first.range).toMatch(/→/);
    expect(first.startYear).toBeLessThanOrEqual(2026);
    expect(first.endYear).toBeGreaterThanOrEqual(2026);
  });

  it('the antardasha inside it is flagged too', () => {
    const current = rows(READY.timeline).filter((r) => r.current);
    expect(current.map((r) => r.kind)).toEqual(['dasha', 'antardasha']);
  });

  it('no quiet decade — every mahadasha on the artifact has a row', () => {
    const all = rows(READY.timeline).filter((r) => r.kind === 'dasha');
    expect(all).toHaveLength(READY.timeline.dasha!.periods.length);
  });
});

describe('the year pills filter ONE set (ASTRAL-52)', () => {
  it('the year set is the artifact’s own', () => {
    expect(years(READY.timeline)).toEqual([...READY.timeline.years].sort((a, b) => a - b));
    expect(READY.years).toEqual(READY.timeline.years);
  });

  it('the pills are a window on it, starting at the artifact’s own year', () => {
    const pills = yearPills(READY.timeline);
    expect(pills).toEqual([2026, 2027, 2028, 2029]);
    // …and every pill is a year the set actually covers, so no control
    // filters to an empty screen.
    const all = new Set(years(READY.timeline));
    for (const y of pills) expect(all.has(y)).toBe(true);
  });

  it('a year change is a filter over what is already in memory', () => {
    // The property the row states — "a year change issues NO network
    // request" — expressed where it can be enforced: this module cannot
    // make one.
    const src = codeOf('timeline-view.ts');
    expect(src).not.toMatch(/fetch\(/);
    expect(src).not.toMatch(/from '\.\/people'/);
  });

  it('filtering a year returns only rows that overlap it', () => {
    for (const year of yearPills(READY.timeline)) {
      for (const row of rowsInYear(READY.timeline, year)) {
        if (row.kind === 'absence') continue;
        expect(row.startYear!).toBeLessThanOrEqual(year);
        expect(row.endYear!).toBeGreaterThanOrEqual(year);
      }
    }
  });

  it('every filtered row is one of the unfiltered rows — nothing is made up', () => {
    const all = new Set(rows(READY.timeline).map((r) => r.id));
    for (const year of yearPills(READY.timeline)) {
      for (const row of rowsInYear(READY.timeline, year)) {
        expect(all.has(row.id)).toBe(true);
      }
    }
  });

  it('the current period still leads inside a filtered year', () => {
    const inYear = rowsInYear(READY.timeline, 2026);
    expect(inYear[0].current).toBe(true);
  });
});

describe('no category is decided on the client (ASTRAL-127’s negative space)', () => {
  it('a period’s categories are the ENGINE’s, verbatim', () => {
    const period = READY.timeline.dasha!.periods[4];
    const row = rows(READY.timeline).find((r) => r.id === 'md-4')!;
    expect(row.categories).toEqual(period.categories);
    for (const c of period.categories ?? []) {
      expect(row.subtitle.toLowerCase()).toContain(c.toLowerCase());
    }
  });

  it('this module maps no planet and no house to a life area', () => {
    const src = codeOf('timeline-view.ts');
    for (const word of ['Venus', 'Saturn', 'Jupiter', 'marriage', 'career']) {
      expect(src).not.toContain(word);
    }
  });

  it('a transit window renders the engine’s own description', () => {
    const windows = READY.timeline.transit?.windows ?? [];
    expect(windows.length).toBeGreaterThan(0);
    const transitRows = rows(READY.timeline).filter((r) => r.kind === 'transit');
    expect(transitRows).toHaveLength(windows.length);
    for (const w of windows) {
      const match = transitRows.find((r) => r.subtitle === w.description);
      expect(match).toBeDefined();
    }
  });
});

describe('a time-less chart names the absence where the headline would be (AMB-16(b))', () => {
  it('the headline slot IS the absence', () => {
    expect(TIMELESS.timeline.headline.kind).toBe('absent_layer');
    const absence = namedAbsence(TIMELESS.timeline)!;
    expect(absence.layer).toBe('dasha');
    expect(absence.reason).toMatch(/birth time/);
  });

  it('the absence is the FIRST row, above the transit windows', () => {
    // A dasha-first design whose dasha layer is missing must say so where
    // the periods would have been. A page that quietly started at the
    // transit windows is the quiet decade the row forbids.
    const first = rows(TIMELESS.timeline)[0];
    expect(first.kind).toBe('absence');
    expect(first.subtitle).toMatch(/birth time/);
  });

  it('a year pill never hides the absence', () => {
    // The reason the dasha layer is missing is true in every year; a filter
    // that dropped it would produce exactly the silent timeline AMB-16
    // lists option (c) only so nobody arrives at it by omission.
    for (const year of yearPills(TIMELESS.timeline)) {
      expect(rowsInYear(TIMELESS.timeline, year)[0].kind).toBe('absence');
    }
  });

  it('there are no dasha rows at all — not empty ones', () => {
    expect(rows(TIMELESS.timeline).filter((r) => r.kind === 'dasha')).toEqual([]);
    expect(rows(TIMELESS.timeline).filter((r) => r.kind === 'antardasha')).toEqual([]);
  });
});

describe('the honest states', () => {
  const state = (s: string) =>
    ({ state: s, reason: 'because' }) as Exclude<TimelineResponse, TimelineReady>;

  it('each state says something true about THIS screen', () => {
    expect(absentView(state('not_established')).body).toMatch(/dasha|Moon/i);
    expect(absentView(state('chart_stale')).body).toMatch(/timeline|dates/i);
  });

  it('a refusal offers no control', () => {
    expect(absentView(state('refused')).action).toBeNull();
  });

  it('§11.2 — nothing this module writes is shaped as a warning', () => {
    const src = codeOf('timeline-view.ts');
    for (const word of ['danger', 'beware', 'curse', 'doom', 'misfortune', 'unlucky']) {
      expect(src.toLowerCase()).not.toContain(word);
    }
  });

  it('isReady separates a timeline from an absence', () => {
    expect(isReady(READY)).toBe(true);
    expect(isReady({ state: 'chart_absent', reason: 'x' } as TimelineResponse)).toBe(false);
  });
});
