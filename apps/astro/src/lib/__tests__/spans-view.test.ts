/**
 * docs/49 PH-27 — the DRAWN timelines (ASTRAL-239 · ASTRAL-240).
 *
 * ASTRAL-239 is a regression row before it is a feature row: `sade_sati`
 * shipped a two-and-a-half-year `window` that every consumer read as a
 * seven-and-a-half-year passage (F71), so a bar drawn from it was wrong by up
 * to five years in the direction that makes the product look precise. The
 * tests below therefore check what is REFUSED at least as hard as what is
 * drawn.
 *
 * The fixture is a real capture of `GET /people/self/timeline` over a chart
 * with a LIVE passage (natal Moon in Aries, Saturn in Pisces in 2026).
 */

import fs from 'fs';
import path from 'path';

import {
  SADE_SATI_NOT_FOUND,
  antardashaBands,
  dashaAxis,
  sadeSatiBar,
} from '../timeline-view';
import { daysBetween, daysFromCivil, segmentOf } from '../spans';
import type { TimelineArtifact, TimelineReady } from '../people-shapes';

const codeOf = (file: string) =>
  fs
    .readFileSync(path.join(__dirname, '..', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const load = (name: string) =>
  JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures', `${name}.json`), 'utf8'),
  ) as TimelineReady;

const READY = load('timeline');
const ARTIFACT = READY.timeline;
const TIMELESS = load('timeline_timeless').timeline;

const clone = (a: TimelineArtifact): TimelineArtifact =>
  JSON.parse(JSON.stringify(a)) as TimelineArtifact;

// ══════════════════════════════════════════════════════════════════════════
// the day maths — clock-free, and exact
// ══════════════════════════════════════════════════════════════════════════

describe('spans.ts', () => {
  it('counts days between two ISO dates', () => {
    expect(daysBetween('2026-01-01', '2026-01-02')).toBe(1);
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);   // leap year
    expect(daysBetween('2025-02-28', '2025-03-01')).toBe(1);
    expect(daysBetween('2025-03-30', '2032-05-30')).toBe(2618);
  });

  it('agrees with the epoch on a date everybody knows', () => {
    expect(daysFromCivil('1970-01-01')).toBe(0);
    expect(daysFromCivil('2000-01-01')).toBe(10957);
  });

  it('returns null rather than a plausible number', () => {
    expect(daysFromCivil('not a date')).toBeNull();
    expect(daysFromCivil('2026-13-01')).toBeNull();
    expect(daysBetween('2026-01-01', undefined)).toBeNull();
  });

  it('places a segment inside its span', () => {
    const seg = segmentOf('2026-01-01', '2026-01-11', '2026-01-06', '2026-01-11');
    expect(seg).toEqual({ offset: 0.5, fraction: 0.5 });
  });

  it('refuses a segment that does not fit its span', () => {
    // Drawn at a guessed offset, a seven-year bar is years of wrong.
    expect(segmentOf('2026-01-01', '2026-01-11', '2025-12-01', '2026-01-05')).toBeNull();
    expect(segmentOf('2026-01-01', '2026-01-11', '2026-01-06', '2027-01-06')).toBeNull();
    expect(segmentOf('2026-01-01', '2026-01-01', '2026-01-01', '2026-01-01')).toBeNull();
  });

  it('constructs no Date and reads no clock', () => {
    const code = codeOf('spans.ts');
    expect(code).not.toContain('new Date(');
    expect(code).not.toContain('Date.now');
    expect(code).not.toContain('toISOString');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ASTRAL-239 — Sade Sati is drawn, with its true span and its three legs
// ══════════════════════════════════════════════════════════════════════════

describe('the Sade Sati bar', () => {
  const BAR = sadeSatiBar(ARTIFACT)!;

  it('is drawn at all', () => {
    expect(BAR).not.toBeNull();
    expect(BAR.legs).toHaveLength(3);
  });

  it('spans the true passage, not the current sign occupancy', () => {
    // The defect, as a length: a Sade Sati is ~7.5 years and the key that
    // shipped was ~2.5.
    const days = daysBetween(BAR.start, BAR.end)!;
    expect(days / 365).toBeGreaterThan(6.5);
    expect(days / 365).toBeLessThan(8.5);
  });

  it('its three legs exactly cover the bar, in order', () => {
    expect(BAR.legs[0].offset).toBe(0);
    const last = BAR.legs[BAR.legs.length - 1];
    expect(last.offset + last.fraction).toBeCloseTo(1, 6);
    for (let i = 1; i < BAR.legs.length; i += 1) {
      expect(BAR.legs[i].offset)
        .toBeCloseTo(BAR.legs[i - 1].offset + BAR.legs[i - 1].fraction, 3);
    }
  });

  it('every width comes from the payload dates', () => {
    const total = daysBetween(BAR.start, BAR.end)!;
    const raw = (ARTIFACT.transit!.windows!
      .find((w) => w.rule === 'sade_sati') as unknown as {
        sub_phases: { start: string; end: string }[] }).sub_phases;
    BAR.legs.forEach((leg, i) => {
      expect(leg.fraction)
        .toBeCloseTo(daysBetween(raw[i].start, raw[i].end)! / total, 6);
    });
  });

  it('marks exactly one leg current, and does not decide which', () => {
    const current = BAR.legs.filter((l) => l.current);
    expect(current).toHaveLength(1);
    const raw = (ARTIFACT.transit!.windows!
      .find((w) => w.rule === 'sade_sati') as unknown as {
        sub_phases: { current: boolean; phase: string }[] }).sub_phases;
    expect(current[0].phase).toBe(raw.find((p) => p.current)!.phase);
  });

  it('labels each leg with its Saturn sign and dates', () => {
    for (const leg of BAR.legs) {
      expect(leg.sign).toBeTruthy();
      expect(leg.range).toMatch(/\d{4}/);
      expect(leg.phase).toBeTruthy();
    }
  });

  it('carries the retrograde re-entry counts, which is why legs differ', () => {
    expect(BAR.legs.some((l) => l.reEntries > 0)).toBe(true);
    const widths = BAR.legs.map((l) => Number(l.fraction.toFixed(3)));
    expect(new Set(widths).size).toBeGreaterThan(1);
  });

  it('REFUSES the pre-fix shape rather than drawing it', () => {
    // The exact regression the row names: a window with no legs is the
    // ~2.5-year occupancy, and it must not become a bar.
    const stale = clone(ARTIFACT);
    const w = stale.transit!.windows!.find((x) => x.rule === 'sade_sati') as
      Record<string, unknown>;
    delete w.sub_phases;
    w.end_date = '2027-06-02';        // what `window` used to say
    expect(sadeSatiBar(stale)).toBeNull();
  });

  it('drops the WHOLE bar when one leg cannot be placed', () => {
    const broken = clone(ARTIFACT);
    const w = broken.transit!.windows!.find((x) => x.rule === 'sade_sati') as
      unknown as { sub_phases: { start: string }[] };
    w.sub_phases[1].start = '2019-01-01';   // outside the span
    expect(sadeSatiBar(broken)).toBeNull();
  });

  it('a chart with no passage says NOT FOUND rather than drawing one', () => {
    const none = clone(ARTIFACT);
    none.transit!.windows = (none.transit!.windows ?? [])
      .filter((w) => w.rule !== 'sade_sati');
    expect(sadeSatiBar(none)).toBeNull();
    expect(SADE_SATI_NOT_FOUND).toContain('No Sade Sati passage');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ASTRAL-240 — the dashas, drawn
// ══════════════════════════════════════════════════════════════════════════

describe('the dasha axis', () => {
  const AXIS = dashaAxis(ARTIFACT)!;

  it('draws the artifact’s periods, one for one', () => {
    expect(AXIS.bands).toHaveLength(ARTIFACT.dasha!.periods.length);
    expect(AXIS.bands.map((b) => b.planet))
      .toEqual(ARTIFACT.dasha!.periods.map((p) => p.planet));
  });

  it('splits and merges nothing — the bands tile the axis exactly', () => {
    expect(AXIS.bands[0].offset).toBe(0);
    const last = AXIS.bands[AXIS.bands.length - 1];
    expect(last.offset + last.fraction).toBeCloseTo(1, 6);
    for (let i = 1; i < AXIS.bands.length; i += 1) {
      expect(AXIS.bands[i].offset)
        .toBeCloseTo(AXIS.bands[i - 1].offset + AXIS.bands[i - 1].fraction, 6);
    }
  });

  it('marks current from the ENGINE cursor, not from a flag or a clock', () => {
    expect(AXIS.currentIndex).toBe(ARTIFACT.cursor.mahadasha_index);
    const marked = AXIS.bands.filter((b) => b.current);
    expect(marked).toHaveLength(1);
    expect(marked[0].index).toBe(ARTIFACT.cursor.mahadasha_index);
  });

  it('a chart cast months ago still marks the right period', () => {
    // The `is_current` trap, pinned: the cursor is recomputed per read from
    // the dates, so an artifact assembled in March marks September's period
    // in September. Moving the cursor moves the mark; nothing else does.
    const later = clone(ARTIFACT);
    later.cursor.mahadasha_index = 5;
    expect(dashaAxis(later)!.bands.filter((b) => b.current)[0].index).toBe(5);
  });

  it('carries the engine’s categories AND the basis it derived them from', () => {
    for (const band of AXIS.bands) {
      const period = ARTIFACT.dasha!.periods[band.index];
      expect(band.categories).toEqual(period.categories ?? []);
      // the view prettifies the engine's snake_case key for the screen —
      // words for humans, same words (a label map, not a derivation)
      expect(band.basis).toBe((period.category_basis ?? '').replace(/_/g, ' '));
      expect(['lordship', 'occupied house']).toContain(band.basis);
    }
  });

  it('nests the antardashas of the SELECTED mahadasha, inside its own span', () => {
    const index = ARTIFACT.cursor.mahadasha_index!;
    const nested = antardashaBands(ARTIFACT, index);
    const expected = ARTIFACT.dasha!.sub_periods
      .filter((p) => p.parent_index === index);
    expect(nested).toHaveLength(expected.length);
    expect(nested.map((b) => b.planet)).toEqual(expected.map((p) => p.planet));
    expect(nested[0].offset).toBeCloseTo(0, 6);
    const last = nested[nested.length - 1];
    expect(last.offset + last.fraction).toBeCloseTo(1, 6);
  });

  it('nests by parent INDEX, never by the lord’s name', () => {
    // Nine lords, twelve periods: "the Venus mahadasha" names two different
    // centuries, so a name-matched nesting would draw the wrong decade.
    const venus = ARTIFACT.dasha!.periods
      .map((p, i) => ({ p, i })).filter(({ p }) => p.planet === 'Venus');
    if (venus.length < 2) return;      // fixture-dependent; assert when real
    const a = antardashaBands(ARTIFACT, venus[0].i);
    const b = antardashaBands(ARTIFACT, venus[1].i);
    expect(a[0].range).not.toBe(b[0].range);
  });

  it('a time-less artifact draws NO dasha axis at all', () => {
    expect(dashaAxis(TIMELESS)).toBeNull();
    expect(antardashaBands(TIMELESS, 0)).toEqual([]);
  });

  it('the view module does no date arithmetic of its own', () => {
    const code = codeOf('timeline-view.ts');
    expect(code).not.toContain('365.25');
    expect(code).not.toMatch(/\/\s*120\b/);
    expect(code).not.toContain('new Date(');
    expect(code).not.toContain('Date.now');
  });
});
