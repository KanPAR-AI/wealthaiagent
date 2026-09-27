/**
 * The improvement question's cadence (owner ask 2026-09-27: "after every 3
 * days or 5 days pop up question asking to rate the overall improvement").
 *
 * Two failure modes this pins, both worse than never asking: a question that
 * fires on day 1 (the programme has said nothing yet, so the answer is noise)
 * and a question that returns the same evening (which is how an app gets
 * muted). Pure: no storage, no clock.
 */
import {
  FIRST_ASK_DAY,
  RATING_CHOICES,
  REPEAT_EVERY_DAYS,
  asISODate,
  dayNumber,
  daysBetween,
  firstSeenDay,
  ratingLabelKey,
  ratingNext,
  shouldAsk,
  type RatingEvent,
  type RatingPhase,
} from '../rating-view';

describe('daysBetween / dayNumber — the day boundary', () => {
  it('counts whole calendar days, signed', () => {
    expect(daysBetween('2026-09-01', '2026-09-04')).toBe(3);
    expect(daysBetween('2026-09-01', '2026-09-01')).toBe(0);
    expect(daysBetween('2026-09-04', '2026-09-01')).toBe(-3);
  });

  it('crosses a month and a DST change without losing a day', () => {
    expect(daysBetween('2026-08-30', '2026-09-02')).toBe(3);
    // US DST ends 2026-11-01; UTC-noon anchors keep this exact.
    expect(daysBetween('2026-10-30', '2026-11-03')).toBe(4);
  });

  it('first seen is DAY 1', () => {
    expect(dayNumber('2026-09-01', '2026-09-01')).toBe(1);
    expect(dayNumber('2026-09-01', '2026-09-03')).toBe(3);
  });

  it('a device clock sent backwards never reads below day 1', () => {
    expect(dayNumber('2026-09-10', '2026-09-01')).toBe(1);
  });

  it('an unparseable date reads as no time passed, never as a huge gap', () => {
    expect(daysBetween('nonsense', '2026-09-04')).toBe(0);
  });
});

describe('shouldAsk — the whole decision', () => {
  it('NEVER before day 3', () => {
    expect(shouldAsk(null, '2026-09-01', '2026-09-01')).toBe(false); // day 1
    expect(shouldAsk(null, '2026-09-01', '2026-09-02')).toBe(false); // day 2
    expect(FIRST_ASK_DAY).toBe(3);
  });

  it('the FIRST ask lands on day 3, right at the boundary', () => {
    expect(shouldAsk(null, '2026-09-01', '2026-09-03')).toBe(true);
    expect(shouldAsk(null, '2026-09-01', '2026-09-09')).toBe(true); // late starter
  });

  it('then every 5 days — not on day 4 of the window', () => {
    // asked on the 3rd; the next window opens on the 8th.
    expect(shouldAsk('2026-09-03', '2026-09-01', '2026-09-06')).toBe(false);
    expect(shouldAsk('2026-09-03', '2026-09-01', '2026-09-07')).toBe(false);
    expect(shouldAsk('2026-09-03', '2026-09-01', '2026-09-08')).toBe(true);
    expect(REPEAT_EVERY_DAYS).toBe(5);
  });

  it('NEVER twice a day — a second session tonight is silent', () => {
    expect(shouldAsk('2026-09-08', '2026-09-01', '2026-09-08')).toBe(false);
  });

  it('a long absence asks once on return, not once per missed window', () => {
    // shouldAsk is a yes/no for TODAY; the caller stamps today, so 40 idle
    // days produce exactly one question.
    expect(shouldAsk('2026-09-03', '2026-09-01', '2026-10-13')).toBe(true);
  });

  it('firstSeen unknown = do not ask (nothing to count from)', () => {
    // The cheaper error: a missed question beats one fired every session on a
    // blank slate, which is exactly what a storage read failure looks like.
    expect(shouldAsk(null, null, '2026-09-30')).toBe(false);
    expect(shouldAsk('2026-09-03', null, '2026-09-30')).toBe(false);
  });
});

describe('the scale', () => {
  it('offers a way to say WORSE — otherwise it is not a question', () => {
    expect(RATING_CHOICES).toContain('worse');
    expect(RATING_CHOICES).toHaveLength(4);
  });

  it('every choice has its own i18n key', () => {
    const keys = RATING_CHOICES.map(ratingLabelKey);
    expect(keys).toEqual(['rating.much_better', 'rating.better',
                          'rating.same', 'rating.worse']);
    expect(new Set(keys).size).toBe(4);
  });
});


describe('ratingNext — asked means ASKED (review finding B3)', () => {
  // The bug this table exists to end: the stamp that makes "we asked" true was
  // written by the ANSWER paths only, so reading the question and tapping Done
  // stamped nothing and the question came back on the next recorded session —
  // an hour later, the same evening. One transition into 'asking' = one place
  // for the screen to stamp it.

  it('the ask is the only way in', () => {
    expect(ratingNext('hidden', 'ask')).toBe('asking');
    expect(ratingNext('hidden', 'answer')).toBeNull();
    expect(ratingNext('hidden', 'defer')).toBeNull();
  });

  it('answering and declining are both terminal', () => {
    expect(ratingNext('asking', 'answer')).toBe('answered');
    expect(ratingNext('asking', 'defer')).toBe('closed');
  });

  it('DOUBLE-TAP GUARD — nothing moves once it is over', () => {
    const events: RatingEvent[] = ['ask', 'answer', 'defer'];
    for (const ev of events) {
      expect(ratingNext('answered', ev)).toBeNull();
      expect(ratingNext('closed', ev)).toBeNull();
    }
  });

  it('a second ask cannot re-open the question in one mount', () => {
    expect(ratingNext('asking', 'ask')).toBeNull();
  });

  it('every phase answers every event — no undefined falls through', () => {
    const phases: RatingPhase[] = ['hidden', 'asking', 'answered', 'closed'];
    const events: RatingEvent[] = ['ask', 'answer', 'defer'];
    for (const p of phases) {
      for (const e of events) {
        const out = ratingNext(p, e);
        expect(out === null || phases.includes(out)).toBe(true);
      }
    }
  });
});

describe('firstSeenDay — day 1 belongs to the server (review finding B4)', () => {
  // The bug: day 1 was the first day THIS BUILD ran, so a user weeks into the
  // programme would have been asked on "day 3" and the owner's telemetry would
  // have said day 3 too.

  it('the server\'s first recorded session BEATS the install date', () => {
    expect(firstSeenDay('2026-09-27', '2026-09-01')).toBe('2026-09-01');
  });

  it('but never moves day 1 LATER than what this device already saw', () => {
    // A user may open the app days before recording anything, and the progress
    // read is capped at a 60-day window — the earlier date is the truer one.
    expect(firstSeenDay('2026-09-01', '2026-09-20')).toBe('2026-09-01');
  });

  it('either side alone is used as-is', () => {
    expect(firstSeenDay(null, '2026-09-01')).toBe('2026-09-01');
    expect(firstSeenDay('2026-09-01', null)).toBe('2026-09-01');
    expect(firstSeenDay('2026-09-01', undefined)).toBe('2026-09-01');
  });

  it('nothing known stays nothing known — shouldAsk then says no', () => {
    expect(firstSeenDay(null, null)).toBeNull();
    expect(shouldAsk(null, firstSeenDay(null, null), '2026-09-30')).toBe(false);
  });

  it('a malformed date from the wire is REFUSED, never adopted', () => {
    // This value is written once and kept; a bad one poisons dayNumber for good.
    expect(firstSeenDay('2026-09-10', 'yesterday')).toBe('2026-09-10');
    expect(firstSeenDay(null, '2026-9-1')).toBeNull();
    expect(firstSeenDay(null, '')).toBeNull();
    expect(asISODate('2026-09-01')).toBe('2026-09-01');
    expect(asISODate('01-09-2026')).toBeNull();
  });

  it('the corrected day 1 is what dayNumber then reports', () => {
    // The whole point: day_n in telemetry must say 27, not 1.
    const day1 = firstSeenDay('2026-09-27', '2026-09-01');
    expect(dayNumber(day1!, '2026-09-27')).toBe(27);
  });
});
