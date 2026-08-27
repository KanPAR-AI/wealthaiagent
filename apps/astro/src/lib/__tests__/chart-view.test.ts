/**
 * docs/49 PH-27 — screen 5's view model (ASTRAL-233..238, ASTRAL-245..248).
 *
 * The fixtures are REAL captures of `GET /people/{id}/chart` over a chart
 * `compute_natal_chart` cast — the timed one and the time-less one — taken by
 * `chatservice/scripts/capture_astral_fixtures.py` against the running
 * engine. Nothing here is hand-written, and the capture stamp is asserted
 * before a single view is read (ASTRAL-248).
 */

import fs from 'fs';
import path from 'path';

import {
  absentModels,
  birthLines,
  columns,
  currentPeriod,
  dashaRows,
  drawnCharts,
  formatOffset,
  headerPeriod,
  missingStampFields,
  planetRows,
  registerNotes,
  stampIsComplete,
  stampLine,
  surfaceState,
  tabs,
  timelessNote,
  yogaCards,
} from '../chart-view';
import { causeClause, staleSentence, UNATTRIBUTED_CLAUSE } from '../staleness';
import type { ChartResponse, FullChart } from '../people-shapes';

/** A module's CODE, with comments removed — see `timeline-view.test.ts` for
 *  why the greps below strip them first. */
const codeOf = (file: string) =>
  fs
    .readFileSync(path.join(__dirname, '..', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

interface Captured {
  _capture: {
    captured_at: string;
    fn: string;
    fn_version: number;
    fn_identity: string;
    engine_version: string | null;
  };
}

const load = <T,>(name: string): T & Captured =>
  JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures', `${name}.json`), 'utf8'),
  ) as T & Captured;

const TIMED = load<ChartResponse>('chart');
const TIMELESS = load<ChartResponse>('chart_timeless');

// ══════════════════════════════════════════════════════════════════════════
// ASTRAL-248 — the fixtures are captured, and they say what from
// ══════════════════════════════════════════════════════════════════════════

/**
 * The engine's `FN_VERSIONS`, mirrored — deliberately, and this comment is
 * the mechanism.
 *
 * The app cannot import a Python dict, so the only way a fixture can be
 * caught going stale is for the expected version to be written down HERE and
 * for a re-capture to move both. The rule the row states: a fixture whose
 * recorded version predates this table FAILS rather than quietly passing,
 * which is exactly what `daily.json` did for three weeks while it carried a
 * Sade-Sati window the engine had already replaced (F85).
 */
const EXPECTED_FN_VERSIONS: Record<string, number> = {
  natal_chart: 7,     // ASTRAL-230 — placements carry their labels
  daily_card: 2,      // PH-20
  timeline: 3,        // ASTRAL-239 — the Sade Sati legs travel
  gun_milan: 4,       // PH-20's Manglik verdict
};

const FIXTURES = ['chart', 'chart_timeless', 'daily', 'daily_timeless',
                  'timeline', 'timeline_timeless', 'match', 'matches_list'];

describe('ASTRAL-248 — every fixture is a capture, and it is not stale', () => {
  it.each(FIXTURES)('%s carries a capture stamp', (name) => {
    const fx = load<Record<string, unknown>>(name);
    expect(fx._capture).toBeDefined();
    expect(fx._capture.captured_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fx._capture.fn).toBeTruthy();
    expect(typeof fx._capture.fn_version).toBe('number');
  });

  it.each(FIXTURES)('%s was captured against the CURRENT engine', (name) => {
    const stamp = load<Record<string, unknown>>(name)._capture;
    const expected = EXPECTED_FN_VERSIONS[stamp.fn];
    expect(expected).toBeDefined();
    // Strictly equal, not ">=": a fixture captured against a FUTURE version
    // is as unreviewable as one captured against a past one.
    expect(stamp.fn_version).toBe(expected);
    expect(stamp.fn_identity.startsWith(`${stamp.fn}/${expected}`)).toBe(true);
  });

  it('the re-captured daily fixture has the SPAN and its three legs', () => {
    // The specific staleness that motivated the row. The shipped fixture
    // carried `window` — the ~2.5-year occupancy of the sign Saturn is in
    // now — and a Sade-Sati bar drawn from it is wrong by up to five years.
    const daily = load<{ card: { transit: { rules: Record<string, any> } } }>('daily');
    const sade = daily.card.transit.rules.sade_sati;
    expect(sade.window).toBeUndefined();
    expect(sade.span.start).toBeTruthy();
    expect(sade.span.end).toBeTruthy();
    expect(sade.sub_phases).toHaveLength(3);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ASTRAL-237 — the stamp, in full, or the honest error state
// ══════════════════════════════════════════════════════════════════════════

describe('the calculation stamp', () => {
  it('carries all five values', () => {
    const stamp = stampLine(TIMED.chart);
    expect(stamp).not.toBeNull();
    for (const value of [TIMED.chart.zodiac_mode, TIMED.chart.ayanamsa,
                         TIMED.chart.house_system, TIMED.chart.node_model,
                         TIMED.chart.engine_version]) {
      // enums render as labels (W → Whole Sign); every value is still
      // REPRESENTED — case-insensitive containment or its declared label
      const labels: Record<string, string> = {
        sidereal: 'Sidereal', LAHIRI: 'Lahiri', W: 'Whole Sign' };
      const shown = labels[String(value)] ?? String(value);
      expect(stamp!.line).toContain(shown);
    }
  });

  it('names the node model, which is the ~1° question users ask', () => {
    expect(stampLine(TIMED.chart)!.line).toMatch(/(mean|true) node/);
  });

  it('says when the chart was cast', () => {
    expect(stampLine(TIMED.chart)!.computed).toBeTruthy();
  });

  it('a chart missing ANY stamp field gets NO stamp and no chart', () => {
    for (const field of ['zodiac_mode', 'ayanamsa', 'house_system',
                         'node_model', 'engine_version'] as const) {
      const chart: FullChart = { ...TIMED.chart };
      delete chart[field];
      expect(stampIsComplete(chart)).toBe(false);
      expect(stampLine(chart)).toBeNull();
      expect(missingStampFields(chart)).toContain(field);
      // …AND NO CHART — the half this test's title always claimed
      // (Role-3 blocker: pre-v6 artifacts are readable-but-unstampable,
      // and drew nine grahas with no frame). The surface refuses.
      const state = surfaceState({ ...TIMED, chart } as ChartResponse);
      expect(state.drawable).toBe(false);
      expect(state.state).toBe('unstamped');
      expect(state.sentence).toContain(field);
      expect(state.sentence).toContain('recast');
    }
  });

  it('the pre-v6 artifact — real stamp, no node_model/engine_version — '
     + 'refuses to draw and names both fields', () => {
    const chart: FullChart = { ...TIMED.chart };
    delete chart.node_model;
    delete chart.engine_version;
    const state = surfaceState({ ...TIMED, chart } as ChartResponse);
    expect(state.drawable).toBe(false);
    expect(state.sentence).toContain('node_model');
    expect(state.sentence).toContain('engine_version');
  });

  it('the stamp line speaks labels, not enums', () => {
    const line = stampLine(TIMED.chart)!.line;
    expect(line).toContain('Whole Sign');
    expect(line).not.toMatch(/ · W · /);
    expect(line).toContain('Lahiri');
    expect(line).toContain('Sidereal');
  });

  it('an unstamped response renders the error state, not a chart', () => {
    const res = { ...TIMED, chart: { status: 'unstamped', missing_stamp: ['ayanamsa'],
                                     reason: 'no frame recorded' } } as ChartResponse;
    const state = surfaceState(res);
    expect(state.state).toBe('unstamped');
    expect(state.drawable).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ASTRAL-234 — three charts, one renderer, and cells that came from the engine
// ══════════════════════════════════════════════════════════════════════════

describe('the three calculated charts', () => {
  it('draws D1, the Moon chart and D9, each with the ENGINE title', () => {
    const drawn = drawnCharts(TIMED.chart);
    expect(drawn.map((d) => d.key)).toEqual(['D1', 'MOON', 'D9']);
    const titles = drawn.map((d) => d.title);
    expect(titles).toEqual(['Lagna Chart (D1)', 'Moon Chart (Chandra Lagna)',
                            'Navamsa Chart (D9)']);
  });

  it('each drawing has twelve cells labelled with the ENGINE rashi number', () => {
    for (const model of drawnCharts(TIMED.chart)) {
      expect(model.cells).toHaveLength(12);
      const stored = TIMED.chart.divisional_charts!
        .find((m) => m.key === model.key)!;
      model.cells.forEach((cell, i) => {
        expect(cell.label).toBe(String(stored.cells![i].rashi_number));
        expect(cell.tokens).toEqual(stored.cells![i].tokens);
      });
    }
  });

  it('D9 differs from D1 — a fixture whose D9 matched would prove nothing', () => {
    const [d1, , d9] = drawnCharts(TIMED.chart);
    expect(d9.cells).not.toEqual(d1.cells);
    expect(d9.ascendant).not.toBe(d1.ascendant);
  });

  it('names each chart with the ascendant the MODEL carries', () => {
    for (const model of drawnCharts(TIMED.chart)) {
      const stored = TIMED.chart.divisional_charts!
        .find((m) => m.key === model.key)!;
      expect(model.ascendant)
        .toBe(`${stored.ascendant_sign} · rashi ${stored.ascendant_rashi_number}`);
    }
  });

  it('a time-less chart draws NO chart at all, with the register reason', () => {
    expect(drawnCharts(TIMELESS.chart)).toEqual([]);
    const absent = absentModels(TIMELESS.chart);
    expect(absent.map((a) => a.key).sort()).toEqual(['D1', 'D9', 'MOON']);
    for (const entry of absent) {
      expect(entry.reason).toBeTruthy();
      expect(entry.unlockedBy).toBe('time_of_birth');
    }
  });

  it('an absent model with no stated reason is not listed at all', () => {
    // Never an empty diamond, and never a heading over nothing: a model
    // missing with no register entry behind it says nothing rather than
    // inventing a sentence.
    const chart = { ...TIMELESS.chart, undetermined: [] };
    expect(absentModels(chart)).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ASTRAL-235 — the planet table
// ══════════════════════════════════════════════════════════════════════════

describe('the planet table', () => {
  it('every cell is a payload field', () => {
    const rows = planetRows(TIMED.chart);
    expect(rows).toHaveLength(TIMED.chart.planets!.length);
    rows.forEach((row, i) => {
      const p = TIMED.chart.planets![i];
      expect(row.planet).toBe(p.planet);
      expect(row.sign).toBe(p.sign);
      expect(row.house).toBe(String(p.house));
      expect(row.nakshatra).toBe(p.nakshatra);
      expect(row.pada).toBe(String(p.nakshatra_pada));
      expect(row.dignity).toBe(p.dignity);
      expect(row.retrograde).toBe(!!p.retrograde);
    });
  });

  it('shows the WITHIN-SIGN degree and never the absolute longitude', () => {
    const row = planetRows(TIMED.chart)[0];
    const p = TIMED.chart.planets![0];
    // The absolute longitude runs to 360 and is three signs of wrong beside
    // a sign name; the shown degree is under 30.
    const shown = Number(row.degree!.split('°')[0]);
    expect(shown).toBeLessThan(30);
    expect(Math.floor(p.sign_degree!)).toBe(shown);
  });

  it('a pre-v4 chart with no sign_degree shows NO degree at all', () => {
    const chart: FullChart = {
      ...TIMED.chart,
      planets: TIMED.chart.planets!.map((p) => ({ ...p, sign_degree: null })),
    };
    expect(planetRows(chart).every((r) => r.degree === null)).toBe(true);
    expect(columns(chart).degree).toBe(false);
  });

  it('a time-less chart has NO house column and NO pada column', () => {
    const cols = columns(TIMELESS.chart);
    expect(cols.house).toBe(false);
    expect(cols.pada).toBe(false);
    expect(planetRows(TIMELESS.chart).every((r) => r.house === null)).toBe(true);
    expect(planetRows(TIMELESS.chart).every((r) => r.pada === null)).toBe(true);
  });

  it('…and ONE sentence from the register says why', () => {
    const note = timelessNote(TIMELESS.chart);
    expect(note).toBeTruthy();
    const fromRegister = TIMELESS.chart.undetermined!
      .find((e) => e.field === 'houses')!.reason;
    expect(note).toBe(fromRegister);
    expect(timelessNote(TIMED.chart)).toBeNull();
  });

  it('prints the dignity string the engine wrote', () => {
    const dignities = new Set(planetRows(TIMED.chart).map((r) => r.dignity));
    const engine = new Set(TIMED.chart.planets!.map((p) => p.dignity));
    expect(dignities).toEqual(engine);
  });

  it('there is no em-dash standing in for a withheld value', () => {
    const rows = [...planetRows(TIMED.chart), ...planetRows(TIMELESS.chart)];
    for (const row of rows) {
      for (const value of [row.house, row.pada, row.degree, row.dignity]) {
        expect(value === null || !String(value).includes('—')).toBe(true);
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ASTRAL-236 — yoga cards
// ══════════════════════════════════════════════════════════════════════════

describe('yoga cards', () => {
  it('render the engine string character for character', () => {
    expect(yogaCards(TIMED.chart)).toEqual(TIMED.chart.yogas);
  });

  it('an empty list renders NO section', () => {
    expect(yogaCards({ ...TIMED.chart, yogas: [] })).toEqual([]);
  });

  it('the view module parses nothing out of a yoga string', () => {
    const code = codeOf('chart-view.ts');
    // No regex, no split, no planet-name list in the yoga path.
    expect(code).not.toMatch(/yoga[\s\S]{0,200}\.split\(/i);
    expect(code).not.toMatch(/yoga[\s\S]{0,200}\.match\(/i);
    expect(code).not.toMatch(/\bvia\b/);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ASTRAL-245 — the birth instant, as recorded
// ══════════════════════════════════════════════════════════════════════════

describe('the birth block', () => {
  it('prints the time exactly as the record carries it', () => {
    const time = birthLines(TIMED.chart).find((l) => l.key === 'time');
    expect(time!.value).toBe(TIMED.chart.birth_data!.time_of_birth);
  });

  it('names the zone and the offset the chart was pinned to', () => {
    const zone = birthLines(TIMED.chart).find((l) => l.key === 'zone');
    expect(zone!.value).toContain(TIMED.chart.birth_data!.timezone!);
    expect(zone!.value).toContain('UTC+05:30');
  });

  it('claims no precision the record does not carry', () => {
    const text = birthLines(TIMED.chart).map((l) => `${l.label} ${l.value}`)
      .join(' ').toLowerCase();
    for (const forbidden of ['rounded', 'approximate', 'estimated',
                             'assumed', 'default']) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('a time-less chart shows no time row rather than a placeholder', () => {
    expect(birthLines(TIMELESS.chart).some((l) => l.key === 'time')).toBe(false);
  });

  it('formats an offset as a clock does, both directions', () => {
    expect(formatOffset(330)).toBe('UTC+05:30');
    expect(formatOffset(-300)).toBe('UTC-05:00');
    expect(formatOffset(0)).toBe('UTC+00:00');
    expect(formatOffset(null)).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ASTRAL-238 — staleness names WHICH cause
// ══════════════════════════════════════════════════════════════════════════

describe('staleness', () => {
  const stale = (causes: string[]): ChartResponse => ({
    ...TIMED,
    chart: { ...TIMED.chart, status: 'stale',
             stale: { causes, reason: 'engine sentence' } },
  });

  it('an engine bump does NOT say the user changed anything', () => {
    const state = surfaceState(stale(['engine_updated']));
    expect(state.state).toBe('stale');
    expect(state.drawable).toBe(true);
    expect(state.sentence.toLowerCase()).not.toContain('birth details');
    expect(state.sentence).toContain('improved the engine');
  });

  it('a corrected fact says the details changed', () => {
    expect(surfaceState(stale(['inputs_changed'])).sentence)
      .toContain('Your birth details changed');
  });

  it('two causes are BOTH named rather than one picked', () => {
    const sentence = surfaceState(stale(['inputs_changed', 'engine_updated']))
      .sentence;
    expect(sentence).toContain('birth details');
    expect(sentence).toContain('engine');
  });

  it('an unattributable staleness claims nothing', () => {
    expect(causeClause({ causes: [], reason: '' }))
      .toBe('something this chart was computed from changed');
    expect(causeClause(undefined)).toBe(causeClause({ causes: [], reason: '' }));
  });

  it('the sentences come from ONE table', () => {
    // Every surface's sentence is `staleSentence(cause, tail)` — the clause
    // is shared and only the consequence is local, so three screens cannot
    // drift into three claims.
    const a = staleSentence({ causes: ['engine_updated'], reason: '' }, 'x.');
    const b = surfaceState(stale(['engine_updated'])).sentence;
    expect(a.split(' after this chart')[0]).toBe(b.split(' after this chart')[0]);
  });

  it('a stale chart is still DRAWN — under its cause', () => {
    expect(surfaceState(stale(['inputs_changed'])).drawable).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// PH-27 Role-4 BLOCKER 3 — a WITHDRAWN birth time is not a banner
// ══════════════════════════════════════════════════════════════════════════

describe('a chart cast on a birth time the user has withdrawn', () => {
  /** The measured shape: the store says the time is not known (Profile
   *  shows so), the stored artifact was cast WITH one. Before this, the
   *  screen printed "Time 10:30" and drew the lagna, the houses and D9
   *  behind a staleness banner. */
  const withdrawn = (chart: Partial<FullChart> = {}): ChartResponse => ({
    ...TIMED,
    tob_known: false,
    chart: { ...TIMED.chart, status: 'stale',
             stale: { causes: ['inputs_changed'], reason: 'engine sentence' },
             ...chart },
  });

  it('refuses to draw at all', () => {
    const state = surfaceState(withdrawn());
    expect(state.state).toBe('withdrawn');
    expect(state.drawable).toBe(false);
  });

  it('names the cause — the removed time — and what to do', () => {
    const sentence = surfaceState(withdrawn()).sentence;
    expect(sentence).toContain('Your birth time was removed');
    expect(sentence).toContain('recasting');
    expect(sentence).toMatch(/ask for any reading/i);
    // and it names what stood on the time, rather than saying "some values"
    for (const named of ['lagna', 'houses', 'divisional', 'dasha']) {
      expect(sentence.toLowerCase()).toContain(named);
    }
  });

  it('refuses a FRESH artifact just the same — freshness is not the question',
     () => {
       const state = surfaceState(withdrawn({ status: 'fresh', stale: undefined }));
       expect(state.drawable).toBe(false);
       expect(state.state).toBe('withdrawn');
     });

  it('leaves the ordinary time-less chart alone', () => {
    // `tob_known` false AND `time_known` false is not a withdrawal — it is a
    // chart honestly cast without a time, and PH-27 draws it (ASTRAL-185).
    expect(surfaceState(TIMELESS).drawable).toBe(true);
    expect(TIMELESS.tob_known).toBe(false);
    expect(TIMELESS.chart.time_known).toBe(false);
  });

  it('leaves a timed chart with a known time alone', () => {
    expect(surfaceState(TIMED).drawable).toBe(true);
  });

  it('the header dasha chip goes silent with the chart', () => {
    // A dasha pair is a chart-derived claim; it was rendered ABOVE the
    // drawable branch and survived every refusal.
    expect(headerPeriod(TIMED)).not.toBeNull();
    expect(headerPeriod(withdrawn())).toBeNull();
    const unstamped = { ...TIMED,
                        chart: { ...TIMED.chart, node_model: undefined } } as ChartResponse;
    expect(headerPeriod(unstamped)).toBeNull();
    expect(headerPeriod({ ...TIMED,
                          chart: { status: 'absent' } } as ChartResponse)).toBeNull();
    expect(headerPeriod(null)).toBeNull();
  });

  it('the screen reads the chip through headerPeriod, not currentPeriod',
     () => {
       // The rule has to live where it can be tested. If the screen goes
       // back to calling `currentPeriod` directly, the pill returns.
       const screen = fs
         .readFileSync(path.join(__dirname, '..', '..', 'app', 'chart.tsx'), 'utf8')
         .replace(/\/\*[\s\S]*?\*\//g, '')
         .replace(/^\s*\/\/.*$/gm, '');
       expect(screen).toContain('headerPeriod(res)');
       expect(screen).not.toContain('currentPeriod(');
     });
});

// ══════════════════════════════════════════════════════════════════════════
// the dasha list, the tabs, and what a screen may not decide
// ══════════════════════════════════════════════════════════════════════════

describe('the dasha list', () => {
  it('is the artifact\u2019s periods, one for one', () => {
    const rows = dashaRows(TIMED.chart);
    expect(rows).toHaveLength(TIMED.chart.dasha_periods!.length);
    expect(rows.map((r) => r.planet))
      .toEqual(TIMED.chart.dasha_periods!.map((d) => d.planet));
  });

  it('marks the period the ENGINE says contains today', () => {
    const marked = dashaRows(TIMED.chart).filter((r) => r.current);
    expect(marked).toHaveLength(1);
    expect(marked[0].planet).toBe(TIMED.chart.mahadasha!.planet);
  });

  it('marks NOTHING from the `is_current` flag', () => {
    // The trap this pins: `is_current` records what was true when the chart
    // was CAST. A chart cast months ago still marks the right period here
    // because the engine decided it from the dates at READ time.
    const chart: FullChart = {
      ...TIMED.chart,
      dasha_periods: TIMED.chart.dasha_periods!.map((d) => ({ ...d, is_current: true })),
    };
    expect(dashaRows(chart).filter((r) => r.current)).toHaveLength(1);
  });

  it('a time-less chart draws no dasha axis at all', () => {
    expect(dashaRows(TIMELESS.chart)).toEqual([]);
    expect(currentPeriod(TIMELESS.chart)).toBeNull();
    expect(tabs(TIMELESS.chart).map((t) => t.id)).not.toContain('dasha');
  });

  it('names the current mahadasha and antardasha for the header', () => {
    const period = currentPeriod(TIMED.chart)!;
    expect(period.mahadasha).toBe(TIMED.chart.mahadasha!.planet);
    expect(period.antardasha).toBe(TIMED.chart.antardasha!.planet ?? null);
  });
});

describe('the tabs (ASTRAL-120)', () => {
  it('are Chart · Grahas · Dasha, and there is no Aspects tab', () => {
    expect(tabs(TIMED.chart).map((t) => t.id)).toEqual(['chart', 'grahas', 'dasha']);
    expect(tabs(TIMED.chart).map((t) => t.label)).not.toContain('Aspects');
  });

  it('a tab whose content the chart lacks is not offered', () => {
    expect(tabs(TIMELESS.chart).map((t) => t.id)).toEqual(['grahas']);
  });
});

describe('the register, and what this chart cannot say', () => {
  it('carries every entry the engine sent', () => {
    const notes = registerNotes(TIMELESS.chart);
    expect(notes.map((n) => n.field))
      .toEqual(TIMELESS.chart.undetermined!.map((e) => e.field));
    for (const note of notes) expect(note.reason).toBeTruthy();
  });

  it('a timed chart has nothing to withhold', () => {
    expect(registerNotes(TIMED.chart)).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ASTRAL-230 / ASTRAL-247 — the client derives NOTHING
// ══════════════════════════════════════════════════════════════════════════

describe('the view module derives nothing', () => {
  const MODULES = ['chart-view.ts', 'staleness.ts'];

  it.each(MODULES)('%s computes no rashi number', (file) => {
    const code = codeOf(file);
    // The derivation the old ASTRAL-19/183 greps did NOT catch (F83).
    expect(code).not.toMatch(/sign_index\s*[+\-*/]/);
    expect(code).not.toMatch(/[+\-*/]\s*\w*\.?sign_index/);
    expect(code).not.toMatch(/rashi_number\s*[+\-*/]/);
    // …and no second SIGNS table anywhere near it.
    expect(code).not.toMatch(/\bSIGNS\s*[[=]/);
    expect(code).not.toMatch(/'Aries'\s*,\s*'Taurus'/);
  });

  it.each(MODULES)('%s computes no house, navamsa or dasha length', (file) => {
    const code = codeOf(file);
    expect(code).not.toMatch(/%\s*12\s*\)?\s*\+\s*1/);
    expect(code).not.toMatch(/\/\s*30\b/);
    expect(code).not.toMatch(/%\s*30\b/);
    expect(code).not.toMatch(/30\s*\/\s*9/);
    expect(code).not.toContain('365.25');
    expect(code).not.toMatch(/navamsa\w*\s*[=(]/i);
  });

  it.each(MODULES)('%s reads no clock', (file) => {
    const code = codeOf(file);
    expect(code).not.toContain('new Date(');
    expect(code).not.toContain('Date.now');
  });

  it.each(MODULES)('%s imports no React and no react-native', (file) => {
    const code = codeOf(file);
    expect(code).not.toMatch(/from\s+'react/);
    expect(code).not.toMatch(/from\s+'expo/);
  });

  it('the grep would actually catch a client-side rashi number', () => {
    // A structural test that matches nothing proves nothing (ASTRAL-230's
    // anti-vacuity sample, verbatim from the row).
    const sample = 'const rashi = p.sign_index + 1;';
    expect(sample).toMatch(/sign_index\s*[+\-*/]/);
    expect("const SIGNS = ['Aries', 'Taurus'];").toMatch(/'Aries'\s*,\s*'Taurus'/);
  });
});


describe('unknown causes degrade the sentence, never the honesty (Role-3)', () => {
  it('an unrecognised cause is surfaced generically, not dropped', () => {
    const clause = causeClause({ causes: ['inputs_changed', 'ayanamsa_changed'], reason: '' });
    expect(clause).toContain('your birth details changed');
    expect(clause).toContain(UNATTRIBUTED_CLAUSE);
  });

  it('a prototype-chain key neither matches nor throws', () => {
    expect(() => causeClause({ causes: ['toString'], reason: '' })).not.toThrow();
    expect(causeClause({ causes: ['toString'], reason: '' })).toBe(UNATTRIBUTED_CLAUSE);
  });
});
