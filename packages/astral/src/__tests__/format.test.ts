import {
  formatDegrees,
  formatFraction,
  formatIsoDate,
  formatPoints,
  formatScore,
  splitIsoInstant,
  titleCase,
} from '../format';
import { placementRows } from '../view/natal';
import { natalTimedPayload, muhurtaPayload } from '../fixtures/payloads';

describe('formatDegrees — notation, never a different quantity', () => {
  it('renders the arcminute form docs/49 ASTRAL-15 asks for', () => {
    expect(formatDegrees(23.61)).toBe('23°37′');
    expect(formatDegrees(85.25)).toBe('85°15′');
    expect(formatDegrees(0)).toBe('0°00′');
  });

  it('pads the arcminutes so 85.05 does not read as 85°3′', () => {
    expect(formatDegrees(85.05)).toBe('85°03′');
  });

  it('carries 60 arcminutes into the degree rather than printing 0°60′', () => {
    expect(formatDegrees(0.999)).toBe('1°00′');
  });

  it('returns null — an absent cell — for anything that is not a number', () => {
    expect(formatDegrees(null)).toBeNull();
    expect(formatDegrees(undefined)).toBeNull();
    expect(formatDegrees('23.61')).toBeNull();
    expect(formatDegrees(NaN)).toBeNull();
    expect(formatDegrees(Infinity)).toBeNull();
  });

  it('re-notates whatever it is given, and does not derive one from the other', () => {
    // The Moon on the captured chart is Gemini, absolute longitude 73.42,
    // which is 13.42 INTO Gemini. The engine supplies BOTH (natal_chart v4);
    // this helper only changes notation and never subtracts a sign boundary,
    // which would be the new claim ASTRAL-19 bans.
    const moon = natalTimedPayload.planets.find((p) => p.planet === 'Moon')!;
    expect(moon.sign).toBe('Gemini');
    expect(formatDegrees(moon.degree)).toBe('73°25′');
    expect(formatDegrees(moon.sign_degree)).toBe('13°25′');
  });

  // A6#13. "Gemini 73°25′" is impossible — a sign spans 30° — and it was on
  // every chart. What renders beside a sign name must be the within-sign
  // degree, and a chart too old to carry one must show nothing rather than
  // falling back to the longitude.
  it('renders the within-sign degree beside the sign, never the longitude', () => {
    const moon = natalTimedPayload.planets.find((p) => p.planet === 'Moon')!;
    const row = placementRows(natalTimedPayload as never)
      .find((r) => r.planet === 'Moon')!;
    expect(row.sign).toBe('Gemini');
    expect(row.degree).toBe(formatDegrees(moon.sign_degree));
    expect(row.degree).not.toBe(formatDegrees(moon.degree));
    // The within-sign value must be a possible position in a 30° sign.
    expect(moon.sign_degree).toBeGreaterThanOrEqual(0);
    expect(moon.sign_degree).toBeLessThan(30);
  });

  it('shows no degree at all on a chart that predates sign_degree', () => {
    const legacy = {
      ...natalTimedPayload,
      planets: natalTimedPayload.planets.map((p) => ({ ...p, sign_degree: null })),
    };
    const row = placementRows(legacy as never).find((r) => r.planet === 'Moon')!;
    expect(row.sign).toBe('Gemini');
    expect(row.degree).toBeNull();
  });
});

describe('formatPoints / formatFraction — concatenation, never division', () => {
  it('drops a trailing .0 and keeps a real half point', () => {
    expect(formatPoints(0)).toBe('0');
    expect(formatPoints(8)).toBe('8');
    expect(formatPoints(21.5)).toBe('21.5');
  });

  it('builds "21.5 / 36" from two payload values', () => {
    expect(formatFraction(21.5, 36)).toBe('21.5 / 36');
    expect(formatFraction(4, 4)).toBe('4 / 4');
  });

  it('never produces a percentage', () => {
    expect(formatFraction(21.5, 36)).not.toContain('%');
    expect(formatFraction(28, 36)).not.toMatch(/\d+\s*%/);
  });

  it('returns null when either half is missing — a pending koota has no fraction', () => {
    expect(formatFraction(null, 4)).toBeNull();
    expect(formatFraction(4, null)).toBeNull();
  });
});

describe('formatScore — the muhurta 0..1 float, verbatim', () => {
  it('does not rescale into a percentage', () => {
    expect(formatScore(0.88)).toBe('0.88');
    expect(formatScore(0.88)).not.toBe('88');
    expect(formatScore(0.88)).not.toContain('%');
  });

  it('is null for a missing score', () => {
    expect(formatScore(null)).toBeNull();
  });
});

describe('splitIsoInstant — the payload wall clock, not the viewer timezone', () => {
  it('reads the characters in the payload', () => {
    expect(splitIsoInstant('2026-09-01T14:15:00+05:30')).toEqual({
      date: '1 Sep 2026',
      time: '14:15',
    });
  });

  it('does not shift a +05:30 instant into the test runner timezone', () => {
    // If this were `new Date(...)`, a UTC runner would render 08:45 and a
    // Pune muhurta would be shown at the wrong time to everyone outside IST.
    const first = muhurtaPayload.windows[0];
    expect(first.start).toContain('+05:30');
    expect(splitIsoInstant(first.start)!.time).toBe('14:15');
  });

  it('is null for junk', () => {
    expect(splitIsoInstant('tomorrow')).toBeNull();
    expect(splitIsoInstant(null)).toBeNull();
  });
});

describe('formatIsoDate / titleCase', () => {
  it('renders a birth date', () => {
    expect(formatIsoDate('1994-05-14')).toBe('14 May 1994');
  });

  it('title-cases the engine band without changing its words', () => {
    expect(titleCase('very good')).toBe('Very Good');
    expect(titleCase('below the traditional threshold')).toBe(
      'Below The Traditional Threshold',
    );
    expect(titleCase('')).toBeNull();
  });
});
