/**
 * The improvement question's two dates and its answers, on this device.
 * Plumbing, so what is pinned here is the plumbing's promises: firstSeen is
 * written ONCE, "Not now" stamps today (which is what defers the question),
 * every answer reaches telemetry with its day number, and no storage failure
 * can throw on a completion screen.
 */
const mockTrack = jest.fn();
jest.mock('../telemetry', () => ({ track: (...a: unknown[]) => mockTrack(...a) }));

import { initCore, type PlatformAdapter } from '@wealthai/core';

import {
  askIfDue,
  loadRatingState,
  markAsked,
  noteAppOpen,
  recordRating,
  seedFirstSeen,
} from '../rating-store';

let store: Map<string, string>;
let failing = false;

function installStorage(): void {
  store = new Map();
  failing = false;
  initCore({
    fetch: (() => { throw new Error('unused'); }) as unknown as typeof globalThis.fetch,
    getApiUrl: (e: string) => e,
    storage: {
      getItem: async (k) => {
        if (failing) throw new Error('storage unavailable');
        return store.get(k) ?? null;
      },
      setItem: async (k, v) => {
        if (failing) throw new Error('storage unavailable');
        store.set(k, v);
      },
      removeItem: async (k) => { store.delete(k); },
    },
    events: { emit: () => {}, on: () => () => {} },
  } as PlatformAdapter);
}

beforeEach(() => {
  mockTrack.mockReset();
  installStorage();
});

describe('noteAppOpen — day 1 is written once, ever', () => {
  it('stamps the first open', async () => {
    expect(await noteAppOpen('2026-09-01')).toBe('2026-09-01');
    expect((await loadRatingState()).firstSeen).toBe('2026-09-01');
  });

  it('a later open NEVER moves day 1 forward', async () => {
    // Re-stamping would push the first ask three days out on every launch —
    // the question would never fire.
    await noteAppOpen('2026-09-01');
    expect(await noteAppOpen('2026-09-20')).toBe('2026-09-01');
    expect((await loadRatingState()).firstSeen).toBe('2026-09-01');
  });
});

describe('loadRatingState — a blank or broken slate reads as "nothing known"', () => {
  it('empty storage', async () => {
    expect(await loadRatingState()).toEqual(
      { firstSeen: null, lastAsked: null, answers: [] });
  });

  it('a corrupt answers blob does not crash the completion screen', async () => {
    store.set('knee.rating.answers', '{not json');
    expect((await loadRatingState()).answers).toEqual([]);
  });

  it('a storage failure reads as nothing known — shouldAsk then says no', async () => {
    failing = true;
    expect(await loadRatingState()).toEqual(
      { firstSeen: null, lastAsked: null, answers: [] });
  });
});

describe('markAsked — what makes "Not now" a deferral', () => {
  it('stamps today', async () => {
    await markAsked('2026-09-08');
    expect((await loadRatingState()).lastAsked).toBe('2026-09-08');
  });

  it('never throws when storage is gone', async () => {
    failing = true;
    await expect(markAsked('2026-09-08')).resolves.toBeUndefined();
  });
});

describe('recordRating — the answer, and where it goes', () => {
  it('sends {score, day_n} to telemetry and keeps a local copy', async () => {
    await noteAppOpen('2026-09-01');
    await recordRating('better', '2026-09-08', '2026-09-01');
    expect(mockTrack).toHaveBeenCalledWith('improvement_rating',
      { score: 'better', day_n: 8 });
    const st = await loadRatingState();
    expect(st.answers).toEqual([{ date: '2026-09-08', score: 'better', dayN: 8 }]);
    expect(st.lastAsked).toBe('2026-09-08');   // answering also closes the window
  });

  it('appends across windows, keeping the order', async () => {
    await recordRating('same', '2026-09-08', '2026-09-01');
    await recordRating('much_better', '2026-09-13', '2026-09-01');
    const st = await loadRatingState();
    expect(st.answers.map((a) => a.score)).toEqual(['same', 'much_better']);
    expect(st.answers.map((a) => a.dayN)).toEqual([8, 13]);
  });

  it('an unknown firstSeen still answers — day 1, never a crash', async () => {
    await recordRating('worse', '2026-09-08', null);
    expect(mockTrack).toHaveBeenCalledWith('improvement_rating',
      { score: 'worse', day_n: 1 });
  });

  it('telemetry still gets the answer when storage is dead', async () => {
    failing = true;
    await expect(recordRating('worse', '2026-09-08', '2026-09-01'))
      .resolves.toBeUndefined();
    expect(mockTrack).toHaveBeenCalledWith('improvement_rating',
      { score: 'worse', day_n: 8 });
  });

  it('the local list is capped — the trend, not the archive', async () => {
    for (let i = 1; i <= 30; i++) {
      const day = String(i).padStart(2, '0');
      await recordRating('same', `2026-09-${day}`, '2026-09-01');
    }
    const st = await loadRatingState();
    expect(st.answers).toHaveLength(24);
    expect(st.answers[st.answers.length - 1].date).toBe('2026-09-30');
  });
});


describe('seedFirstSeen — the server owns day 1 (review finding B4)', () => {
  // noteAppOpen alone stamped the day THIS BUILD first ran, so every user
  // already on the programme — including the only returning user, the one this
  // feature exists for — would have been treated as brand new on update day.

  it('a returning user\'s day 1 moves back to his first recorded session', async () => {
    await noteAppOpen('2026-09-27');                 // the day he took the OTA
    expect(await seedFirstSeen('2026-09-01')).toBe('2026-09-01');
    expect((await loadRatingState()).firstSeen).toBe('2026-09-01');
  });

  it('never moves day 1 forward, however often it runs', async () => {
    await noteAppOpen('2026-09-01');
    await seedFirstSeen('2026-09-20');
    expect((await loadRatingState()).firstSeen).toBe('2026-09-01');
  });

  it('is idempotent — it runs on every progress read', async () => {
    await noteAppOpen('2026-09-27');
    await seedFirstSeen('2026-09-01');
    await seedFirstSeen('2026-09-01');
    await seedFirstSeen('2026-09-01');
    expect((await loadRatingState()).firstSeen).toBe('2026-09-01');
  });

  it('a user who has recorded nothing (null) is left exactly as he was', async () => {
    await noteAppOpen('2026-09-27');
    expect(await seedFirstSeen(null)).toBe('2026-09-27');
    expect((await loadRatingState()).firstSeen).toBe('2026-09-27');
  });

  it('seeds a device that has stamped nothing yet', async () => {
    expect(await seedFirstSeen('2026-09-01')).toBe('2026-09-01');
    expect((await loadRatingState()).firstSeen).toBe('2026-09-01');
  });

  it('a malformed date is refused, not stored', async () => {
    await noteAppOpen('2026-09-27');
    await seedFirstSeen('not-a-date');
    expect((await loadRatingState()).firstSeen).toBe('2026-09-27');
  });

  it('never throws when storage is gone — it is on the Today read path', async () => {
    failing = true;
    await expect(seedFirstSeen('2026-09-01')).resolves.toBeNull();
  });
});


describe('askIfDue — a yes is ALWAYS also a stamp (review finding B3)', () => {
  // The shipped bug: the stamp was written by the screen's two answer handlers,
  // so reading the question and tapping Done (or backing out) left `lastAsked`
  // untouched and the next recorded session asked again — an hour later, the
  // same evening. "Never twice a day" was true of shouldAsk and false of the
  // feature. Here a yes cannot be obtained without the stamp.

  it('says yes on day 3 and RECORDS the ask in the same breath', async () => {
    await noteAppOpen('2026-09-01');
    expect(await askIfDue('2026-09-03')).toEqual(
      { ask: true, firstSeen: '2026-09-01' });
    expect((await loadRatingState()).lastAsked).toBe('2026-09-03');
  });

  it('A SECOND SESSION THE SAME EVENING IS SILENT — even with no answer given', async () => {
    // This is the B3 repro: ask, answer NOTHING, come back an hour later.
    await noteAppOpen('2026-09-01');
    expect((await askIfDue('2026-09-03')).ask).toBe(true);
    expect((await askIfDue('2026-09-03')).ask).toBe(false);
    expect((await askIfDue('2026-09-03')).ask).toBe(false);
  });

  it('and the window it opened is the real one — 5 days, not tomorrow', async () => {
    await noteAppOpen('2026-09-01');
    await askIfDue('2026-09-03');
    expect((await askIfDue('2026-09-04')).ask).toBe(false);
    expect((await askIfDue('2026-09-07')).ask).toBe(false);
    expect((await askIfDue('2026-09-08')).ask).toBe(true);
  });

  it('a NO stamps nothing — the question must still be due tomorrow', async () => {
    await noteAppOpen('2026-09-01');
    expect(await askIfDue('2026-09-02')).toEqual(
      { ask: false, firstSeen: '2026-09-01' });
    expect((await loadRatingState()).lastAsked).toBeNull();
    expect((await askIfDue('2026-09-03')).ask).toBe(true);
  });

  it('a device that knows no day 1 never asks', async () => {
    expect(await askIfDue('2026-09-30')).toEqual({ ask: false, firstSeen: null });
  });

  it('the corrected day 1 is the one it counts from (B3 x B4)', async () => {
    // A returning user takes the OTA today; the server says he started on the
    // 1st. He must be asked on THIS session, not two days from now.
    await noteAppOpen('2026-09-27');
    await seedFirstSeen('2026-09-01');
    const out = await askIfDue('2026-09-27');
    expect(out).toEqual({ ask: true, firstSeen: '2026-09-01' });
  });

  it('never throws when storage is dead — it runs on the completion screen', async () => {
    failing = true;
    await expect(askIfDue('2026-09-30')).resolves.toEqual(
      { ask: false, firstSeen: null });
  });
});
