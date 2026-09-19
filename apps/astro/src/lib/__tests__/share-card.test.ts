import { daySeal, sealMessage, sealStance, SEAL_KEYS } from '../share-card';
import type { DayView } from '../daily-view';

const VIEW: DayView = {
  band: 'green',
  label: 'Green day',
  line: 'a green day — lean in: start the thing, make the ask, say yes to the meeting.',
  reasons: ['Sampat tara — today’s Moon in Uttara Ashadha, counted from your Moon in Bharani'],
  notYours: null,
  strip: [
    { date: '2026-09-21', weekday: 'Mon', band: 'green', isToday: true, absent: null },
    { date: '2026-09-22', weekday: 'Tue', band: 'red', isToday: false, absent: null },
    { date: '2026-09-23', weekday: 'Wed', band: null, isToday: false, absent: 'no ephemeris' },
    { date: '2026-09-24', weekday: 'Thu', band: 'green', isToday: false, absent: null },
  ],
  rahuKaal: '07:39–09:10', rahuKaalAbsent: null,
  golden: ['06:08–10:38', '12:08–13:38'], silence: ['15:08–16:38'],
  momentsAbsent: null,
  place: 'Bengaluru, Karnataka, India',
  // Added 2026-09-19 with the birth-details lock: `DayView` now carries WHY
  // the place is the place ("birth_place" vs a city the user set), because
  // a birth place named in clear is a locked fact. This literal is a
  // current-city day, so the basis is not the birth place — and the seal
  // carries no place either way, which is what the cases below assert.
  placeBasis: 'current_place',
};

describe('the Day Seal carries the verdict and nothing about the person (ASTRAL-63)', () => {
  it('has exactly the allowlisted keys', () => {
    const seal = daySeal(VIEW, '21 Sep 2026', 'Brand')!;
    expect(Object.keys(seal).sort()).toEqual([...SEAL_KEYS].sort());
  });

  it('never carries the cited reasons, the natal Moon, the place or the clock of Rahu Kaal', () => {
    const seal = daySeal(VIEW, '21 Sep 2026', 'Brand')!;
    const wire = JSON.stringify(seal) + sealMessage(seal);
    for (const leak of ['Bharani', 'Bengaluru', 'tara', 'Uttara Ashadha', '07:39', 'your Moon']) {
      expect(wire).not.toContain(leak);
    }
  });

  it('every word is the engine’s: the band word, the stance inside its line, its window', () => {
    const seal = daySeal(VIEW, '21 Sep 2026', 'Brand')!;
    expect(seal.label).toBe('Green day');
    expect(seal.stance).toBe('lean in');
    expect([seal.windowLabel, seal.window]).toEqual(['Golden window', '06:08–10:38']);
    expect(seal.dots).toEqual(['green', 'red', null, 'green']);
    expect(seal.todayIndex).toBe(0);
  });

  it('a red day points at the next green one instead of a window', () => {
    const seal = daySeal({ ...VIEW, band: 'red', label: 'Red day',
      line: 'a red day — go gentle: protect your energy.' }, '21 Sep 2026', 'Brand')!;
    expect(seal.stance).toBe('go gentle');
    expect([seal.windowLabel, seal.window]).toEqual(['Next green day', 'Thu']);
  });

  it('no golden window and no green day ahead is simply absent, not invented', () => {
    const seal = daySeal({ ...VIEW, golden: [], strip: VIEW.strip.slice(0, 2) }, 'x', 'Brand')!;
    expect([seal.windowLabel, seal.window]).toEqual([null, null]);
    expect(sealMessage(seal)).toBe('Green day — lean in. What colour is your day? Brand');
  });

  it('a line without the shape is kept whole, never paraphrased', () => {
    expect(sealStance('steady as you go')).toBe('steady as you go');
  });

  it('no day layer, no seal', () => {
    expect(daySeal(null, 'x', 'Brand')).toBeNull();
  });
});
