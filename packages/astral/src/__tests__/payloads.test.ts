import {
  parseMatchReport,
  parseMuhurtaResults,
  parseNatalChart,
} from '../payloads';
import {
  matchTimedPayload,
  matchTimelessPayload,
  muhurtaPayload,
  natalTimedPayload,
  natalTimelessPayload,
} from '../fixtures/payloads';

describe('parseNatalChart — the timed chart from the live engine', () => {
  const chart = parseNatalChart(natalTimedPayload)!;

  it('parses', () => {
    expect(chart).not.toBeNull();
  });

  it('carries the calculation stamp INV-3 requires', () => {
    expect(chart.zodiac_mode).toBe('sidereal');
    expect(chart.ayanamsa).toBeTruthy();
    expect(chart.house_system).toBeTruthy();
  });

  it('carries nine grahas, houses and an ascendant', () => {
    expect(chart.planets).toHaveLength(9);
    expect(chart.planets.map((p) => p.planet)).toEqual(
      expect.arrayContaining(['Rahu', 'Ketu']),
    );
    expect(chart.houses).toHaveLength(12);
    expect(chart.ascendant).toBe('Gemini');
    expect(chart.ascendant_degree).toBe(85.25);
  });
});

describe('parseNatalChart — time_known=false (docs/49 ASTRAL-9 / INV-6)', () => {
  const chart = parseNatalChart(natalTimelessPayload)!;

  it('has no ascendant and no houses', () => {
    expect(chart.time_known).toBe(false);
    expect(chart.ascendant).toBeNull();
    expect(chart.ascendant_degree).toBeNull();
    expect(chart.houses).toEqual([]);
  });

  it('gives every graha a null house and a null pada', () => {
    expect(chart.planets).toHaveLength(9);
    for (const p of chart.planets) {
      expect(p.house).toBeNull();
      expect(p.nakshatra_pada).toBeNull();
    }
  });

  it('still carries the time-independent work — Moon sign, Sun sign, signs', () => {
    expect(chart.moon_sign).toBe('Gemini');
    expect(chart.sun_sign).toBe('Aries');
    expect(chart.planets.every((p) => p.sign.length > 0)).toBe(true);
  });

  it('carries the alternative nakshatra the engine refused to drop', () => {
    expect(chart.moon_nakshatra_alternatives).toEqual(['Punarvasu']);
  });

  it('SABOTAGE: strips an ascendant a time-less chart has no business carrying', () => {
    // If a future engine regression ships an ascendant on a time_known=false
    // chart, the renderer must still not draw one. The parser is the gate.
    const sabotaged = {
      ...natalTimelessPayload,
      ascendant: 'Leo',
      ascendant_degree: 130.5,
      houses: natalTimedPayload.houses,
      planets: natalTimedPayload.planets,
    };
    const parsed = parseNatalChart(sabotaged)!;
    expect(parsed.ascendant).toBeNull();
    expect(parsed.ascendant_degree).toBeNull();
    expect(parsed.houses).toEqual([]);
    expect(parsed.planets.every((p) => p.house === null)).toBe(true);
  });
});

describe('parseNatalChart — refusals', () => {
  it.each([
    ['null', null],
    ['a string', 'natal_chart'],
    ['an array', []],
    ['the wrong type', { type: 'match_report' }],
    ['no planets', { type: 'natal_chart', planets: [] }],
    ['planets that are not planets', { type: 'natal_chart', planets: [{ foo: 1 }] }],
  ])('returns null for %s', (_label, value) => {
    expect(parseNatalChart(value)).toBeNull();
  });
});

describe('parseMatchReport', () => {
  it('parses the timed match with its /36 total and the engine band', () => {
    const r = parseMatchReport(matchTimedPayload)!;
    expect(r.total).toBe(21.5);
    expect(r.max_total).toBe(36);
    expect(r.verdict).toBe('acceptable');
    expect(r.kootas).toHaveLength(8);
    expect(r.kootas.every((k) => !k.pending)).toBe(true);
  });

  it('parses the time-less match with NO total and four pending kootas', () => {
    const r = parseMatchReport(matchTimelessPayload)!;
    expect(r.total).toBeNull();
    expect(r.max_total).toBeNull();
    expect(r.firm_total).toBe(5);
    expect(r.firm_max).toBe(15);
    expect(r.pending_max).toBe(21);
    expect(r.verdict).toBe('incomplete');
    const pending = r.kootas.filter((k) => k.pending).map((k) => k.name);
    expect(pending.sort()).toEqual(['Gana', 'Nadi', 'Tara', 'Yoni']);
  });

  it('keeps a pending koota distinguishable from a zero-scoring one', () => {
    const r = parseMatchReport(matchTimelessPayload)!;
    const varna = r.kootas.find((k) => k.name === 'Varna')!;
    const yoni = r.kootas.find((k) => k.name === 'Yoni')!;
    expect(varna.points).toBe(0);
    expect(varna.pending).toBe(false);
    expect(yoni.points).toBeNull();
    expect(yoni.pending).toBe(true);
  });

  it('refuses a report with no verdict rather than inventing a band', () => {
    expect(parseMatchReport({ ...matchTimedPayload, verdict: '' })).toBeNull();
  });

  it.each([
    ['null', null],
    ['the wrong type', { type: 'natal_chart' }],
    ['no kootas', { type: 'match_report', kootas: [], verdict: 'ok', firm_total: 1, firm_max: 2 }],
  ])('returns null for %s', (_label, value) => {
    expect(parseMatchReport(value)).toBeNull();
  });
});

describe('parseMuhurtaResults', () => {
  it('parses the captured windows', () => {
    const r = parseMuhurtaResults(muhurtaPayload)!;
    expect(r.windows).toHaveLength(10);
    expect(r.location).toBe('Pune, Maharashtra, India');
    expect(r.total_evaluated).toBe(320);
    expect(r.windows[0].rahu_kaal).toBe(true);
  });

  it.each([
    ['null', null],
    ['no windows', { type: 'muhurta_results', windows: [] }],
    ['windows with no times', { type: 'muhurta_results', windows: [{ score: 1 }] }],
  ])('returns null for %s', (_label, value) => {
    expect(parseMuhurtaResults(value)).toBeNull();
  });
});

describe('both client shapes reach the same parser', () => {
  /**
   * Web passes the parsed fence body straight in. Mobile splits the fence into
   * a `Widget` whose fields ARE the payload (`message-bubble.splitFencedWidgets`)
   * and then reads `widget.data ?? widget` — so the payload arrives at the top
   * level, with no `data` wrapper. Both must land on the same chart.
   *
   * This is a contract test for the mobile host, which has no test runner of
   * its own (`apps/mobile` ships no jest config). It is the shape check, not a
   * render check — noted honestly rather than implied.
   */
  it('parses the mobile widget shape (payload at the top level)', () => {
    const widget: any = { ...natalTimedPayload };
    expect(widget.data).toBeUndefined();
    const parsed = parseNatalChart(widget.data ?? widget);
    expect(parsed).not.toBeNull();
    expect(parsed!.ascendant).toBe('Gemini');
  });

  it('parses the web shape (the fence body itself)', () => {
    const parsed = parseNatalChart(JSON.parse(JSON.stringify(natalTimedPayload)));
    expect(parsed!.ascendant).toBe('Gemini');
  });

  it('does not mistake a wrapper object for a chart', () => {
    expect(parseNatalChart({ data: natalTimedPayload })).toBeNull();
  });
});

/**
 * docs/49 PH-20 · ASTRAL-183 — a payload with CORRECTED houses renders
 * corrected placements with no code change.
 *
 * The engine's house field moved from equal-house to whole-sign, and the
 * claim this phase makes is that fixing the engine fixes every surface at
 * once with zero client releases. The client is what makes that claim true
 * or false: it must carry the number through, never derive it. Two payloads
 * that differ ONLY in `house` must parse to placements that differ only in
 * `house`.
 */
describe('ASTRAL-183 — the client carries the house it is given', () => {
  const beforeFix: any = JSON.parse(JSON.stringify(natalTimedPayload));
  const afterFix: any = JSON.parse(JSON.stringify(natalTimedPayload));
  // The defect's own shape: a graha earlier in the rising sign than the
  // lagna degree landed in house 12 of its own sign instead of house 1.
  beforeFix.planets[0].house = 12;
  afterFix.planets[0].house = 1;

  it('renders whatever house the engine sends, unmodified', () => {
    expect(parseNatalChart(beforeFix)!.planets[0].house).toBe(12);
    expect(parseNatalChart(afterFix)!.planets[0].house).toBe(1);
  });

  it('changes nothing else about the placement', () => {
    const b = parseNatalChart(beforeFix)!.planets[0];
    const a = parseNatalChart(afterFix)!.planets[0];
    expect({ ...b, house: null }).toEqual({ ...a, house: null });
  });

  it('an unknown key on the payload is ignored rather than fatal', () => {
    // The engine now also ships `divisional_charts` (ASTRAL-173). A shipped
    // client build that predates it must keep parsing — that is what "no
    // client release required" means in practice.
    const withCharts: any = JSON.parse(JSON.stringify(natalTimedPayload));
    withCharts.divisional_charts = [
      {
        key: 'D9',
        title: 'Navamsa Chart (D9)',
        ascendant_sign_index: 4,
        placements: [{ body: 'Moon', sign_index: 4, house: 1 }],
      },
    ];
    const parsed = parseNatalChart(withCharts);
    expect(parsed).not.toBeNull();
    expect(parsed!.planets).toHaveLength(9);
  });
});
