/**
 * best_days (docs/64 W-3) — the block parses the engine's ranked days and
 * shows them in the engine's order; nothing is re-ranked, re-scored or
 * re-banded on the client.
 */
import { parseBestDays } from '../payloads';
import { BEST_DAYS_SHOWN, bestDayRows, bestDaysSubtitle, bestDaysTitle } from '../view/best-days';

const DAY = (date: string, weekday: string, band: string, score: number, extra: Record<string, unknown> = {}) => ({
  date, weekday, days_from_today: 0, rank: 1, band, purpose_band: band, purpose_score: score, day_score: score,
  caps: [], reasons: ['Tritiya tithi — a strong tithi'], purpose_reasons: [],
  windows: { golden: [{ start: '09:40', end: '11:05' }], silence: [] },
  rahu_kaal: { start: '13:30', end: '15:00' },
  per_person: { you: { band, score } },
  ...extra,
});

const PAYLOAD = {
  type: 'best_days', purpose: 'talk_partner', label: 'Talk with your partner', needs_partner: true,
  as_of: '2026-09-17', horizon: { start: '2026-09-17', end: '2026-09-30', days: 14 }, personalized: true,
  people: [{ name: 'Nisha', has_chart: true }],
  verdict: 'best day for both you and Nisha: Sat 19 Sep, 09:40–11:05 — a green day for talk with your partner',
  ranked: [
    DAY('2026-09-19', 'Sat', 'green', 0.71, { per_person: { you: { band: 'green', score: 0.71 }, Nisha: { band: 'amber', score: 0.5 } } }),
    DAY('2026-09-23', 'Wed', 'amber', 0.52),
    DAY('2026-09-17', 'Thu', 'red', 0.3, { caps: ['naidhana'], windows: { golden: [], silence: [] } }),
  ],
  absent: [{ date: '2026-09-18', reason: 'the day could not be scored for this chart' }],
};

describe('parseBestDays', () => {
  it('parses the engine result verbatim, in its order', () => {
    const p = parseBestDays(PAYLOAD)!;
    expect(p.ranked.map((d) => d.date)).toEqual(['2026-09-19', '2026-09-23', '2026-09-17']);
    expect(p.ranked[0].per_person.Nisha).toEqual({ band: 'amber', score: 0.5, absent: null });
    expect(p.absent).toEqual([{ date: '2026-09-18', reason: 'the day could not be scored for this chart' }]);
    expect(p.people).toEqual([{ name: 'Nisha', has_chart: true }]);
  });

  it('refuses an empty result and a foreign type', () => {
    expect(parseBestDays({ type: 'best_days', ranked: [], absent: [] })).toBeNull();
    expect(parseBestDays({ type: 'muhurta_results' })).toBeNull();
    expect(parseBestDays(null)).toBeNull();
  });

  it('accepts the fence-typed result without an explicit type', () => {
    const { type: _t, ...untyped } = PAYLOAD;
    expect(parseBestDays(untyped)?.purpose).toBe('talk_partner');
  });
});

describe('bestDayRows', () => {
  it('keeps the engine order, the band, the window and the people line', () => {
    const rows = bestDayRows(parseBestDays(PAYLOAD)!);
    expect(rows.map((r) => r.bandLabel)).toEqual(['Green', 'Amber', 'Red']);
    expect(rows[0].when).toMatch(/^Sat /);
    expect(rows[0].window).toBe('09:40–11:05');
    expect(rows[0].people).toBe('You: Green · Nisha: Amber');
    expect(rows[2].window).toBeNull();
    expect(rows[2].capped).toBe(true);
  });

  it('shows at most the declared number of days', () => {
    const many = { ...PAYLOAD, ranked: Array.from({ length: 9 }, (_, i) => DAY(`2026-09-${20 + i}`, 'Mon', 'amber', 0.5)) };
    expect(bestDayRows(parseBestDays(many)!)).toHaveLength(BEST_DAYS_SHOWN);
  });

  it('titles from the engine label and the partner on file', () => {
    const p = parseBestDays(PAYLOAD)!;
    expect(bestDaysTitle(p)).toBe('Best days to talk with your partner — for you and Nisha');
    expect(bestDaysSubtitle(p)).toBe('the next 14 days, from your Moon');
    expect(bestDaysSubtitle({ ...p, personalized: false })).toMatch(/not yet yours/);
  });
});

describe('the production payload (bug e3b2ab21, 2026-09-18)', () => {
  // Captured from the engine's own ```best_days``` fence on prod — the
  // fence carries no `type`; the registry's language names it.
  const prod = require('./fixtures/best-days.prod.json');
  it('parses and yields rows in the engine order', () => {
    const p = parseBestDays(prod)!;
    expect(p).not.toBeNull();
    expect(p.ranked.length).toBe(14);
    const rows = bestDayRows(p);
    expect(rows).toHaveLength(BEST_DAYS_SHOWN);
    expect(rows[0].when).toMatch(/^Wed /);
    expect(rows[0].bandLabel).toBe('Green');
    expect(rows[0].window).toBe('09:12–10:42');
  });
});
