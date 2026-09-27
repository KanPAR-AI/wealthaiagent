/**
 * The follow-along choreography — what the voice says and when. Pure, so the
 * one thing that must never happen (an invented dose spoken at a patient)
 * is held here rather than hoped for.
 */
import type { WireExercise, WirePhaseDetail } from '../library-view';
import {
  NO_DOSE_SECONDS,
  announcement,
  buildCustomPlan,
  buildPlan,
  doseLabel,
  holdCues,
  localDate,
  nearDuplicateWarnings,
  recipeNote,
  remainingMinutes,
  repCues,
  setCues,
  spokenNumber,
} from '../session-view';

function ex(over: Partial<WireExercise>): WireExercise {
  return {
    name: 'x', title: 'x', phase: '2', start_seconds: 10, end_seconds: 50,
    video_file: 'A.mp4', url: 'https://v/1', clip_url: 'https://c/1',
    dose: null, dub_langs: [], ...over,
  };
}

function detail(exercises: WireExercise[]): WirePhaseDetail {
  return {
    phase: '2', name: 'Build strength', count: exercises.length,
    catalog_count: exercises.length, complete: true, exercises,
  };
}

describe('buildPlan — recipes are selections over server order', () => {
  const d = detail([
    ex({ name: 'a', dose: { reps: 10, sets: 2, pace_seconds_per_rep: 3 } }),
    ex({ name: 'b', dose: null }),
    ex({ name: 'c', dose: { hold_seconds: 30, sets: 1 } }),
    ex({ name: 'unplayable', url: null, clip_url: null }),
  ]);

  it('full = every playable exercise, order untouched', () => {
    const plan = buildPlan(d, 'full');
    expect(plan.exercises.map((x) => x.name)).toEqual(['a', 'b', 'c']);
    expect(plan.estimatedMinutes).toBeGreaterThan(0);
  });

  it('short = dosed only; gentle = holds only', () => {
    expect(buildPlan(d, 'short').exercises.map((x) => x.name)).toEqual(['a', 'c']);
    expect(buildPlan(d, 'gentle').exercises.map((x) => x.name)).toEqual(['c']);
  });

  it('an unplayable exercise never enters a session', () => {
    for (const r of ['full', 'short', 'gentle'] as const) {
      expect(buildPlan(d, r).exercises.some((x) => x.name === 'unplayable')).toBe(false);
    }
  });
});

describe('what the voice says', () => {
  it('announces the design sentence, both languages', () => {
    const x = buildPlan(detail([ex({ name: 'knee flexion stretch',
      dose: { reps: 10, sets: 2, pace_seconds_per_rep: 3 } })]), 'full').exercises[0];
    expect(announcement(x, 0, 8, 'en'))
      .toBe('Exercise 1 of 8 — knee flexion stretch. 10 reps, 2 sets.');
    expect(announcement(x, 0, 8, 'hi'))
      .toBe('व्यायाम 1 — knee flexion stretch. 10 बार, 2 सेट.');
  });

  it('a doseless exercise is announced honestly — follow the video', () => {
    const x = buildPlan(detail([ex({ name: 'walking', dose: null })]), 'full').exercises[0];
    expect(announcement(x, 0, 1, 'en')).toContain('Follow along with the video');
    expect(setCues(x, 'en')).toEqual({ cues: [], durationS: 0 });
  });

  it('rep cues: the screen shows the DIGIT, the voice says the word (owner ruling)', () => {
    const cues = repCues(3, 3, 'hi');
    expect(cues).toEqual([
      { at: 3, show: '1', say: 'एक' },
      { at: 6, show: '2', say: 'दो' },
      { at: 9, show: '3', say: 'तीन' },
    ]);
  });

  it('hold cues: a per-second digital clock, check-ins, and the 5-4-3-2-1 finish', () => {
    const cues = holdCues(15, 'en');
    // the clock ticks every second on screen
    expect(cues[0]).toEqual({ at: 3, show: '0:15', say: 'go' });
    expect(cues.find((c) => c.at === 8)).toEqual({ at: 8, show: '0:10', say: '10' });
    // the last five seconds are called out one by one (owner ask 2026-09-05)
    const finish = cues.filter((c) => typeof c.say === 'string'
      && ['5', '4', '3', '2', '1'].includes(c.say));
    expect(finish.map((c) => c.say)).toEqual(['5', '4', '3', '2', '1']);
    expect(cues[cues.length - 1]).toEqual({ at: 18, show: '0:00', say: 'and release' });
    // silent ticks still update the clock
    expect(cues.find((c) => c.at === 9)).toEqual({ at: 9, show: '0:09', say: undefined });
  });

  it('the Hindi finish is spoken in Hindi but SHOWN in digits', () => {
    const cues = holdCues(8, 'hi');
    const three = cues.find((c) => c.show === '0:03');
    expect(three?.say).toBe('तीन');
  });

  it('spoken numbers switch script with the language', () => {
    expect(spokenNumber(7, 'hi')).toBe('सात');
    expect(spokenNumber(7, 'en')).toBe('7');
    expect(spokenNumber(99, 'hi')).toBe('99'); // out of table → digits, honest
  });

  it('dose labels read like the boards', () => {
    const x = buildPlan(detail([ex({ dose: { reps: 10, sets: 2, pace_seconds_per_rep: 3 } })]),
      'full').exercises[0];
    expect(doseLabel(x, 'en')).toBe('10 reps · × 2 sets');
    expect(doseLabel(x, 'hi')).toBe('10 बार · 2 सेट');
  });
});

describe('localDate', () => {
  it('is the device day, zero-padded', () => {
    expect(localDate(new Date(2026, 8, 5))).toBe('2026-09-05');
    expect(localDate(new Date(2026, 0, 1))).toBe('2026-01-01');
  });
});

describe('reps of holds — "30 seconds, 3 reps"', () => {
  it('runs the guided hold once per rep, numbering each', () => {
    const x = {
      name: 'knee flexion stretch', clipUrl: 'c', videoUrl: 'v', hasHindi: false,
      startSeconds: 0, endSeconds: 30,
      dose: { reps: 3, sets: 1, holdSeconds: 15, paceSecondsPerRep: 3 },
    };
    const { cues, durationS } = setCues(x as never, 'en');
    // three numbered holds, each with go → check-ins → release
    expect(cues.filter((c) => c.say === 'go')).toHaveLength(3);
    expect(cues.filter((c) => c.say === 'and release')).toHaveLength(3);
    expect(cues[0]).toEqual({ at: 0, show: '1', say: '1' });
    expect(durationS).toBeGreaterThan(3 * 15);
  });
});

describe('buildCustomPlan — the design\'s "Build my own"', () => {
  const d = detail([
    ex({ name: 'bridges' }),
    ex({ name: 'toe curls' }),
    ex({ name: 'clamshells' }),
    ex({ name: 'unplayable', url: null, clip_url: null }),
  ]);

  it('keeps SERVER order regardless of pick order', () => {
    const plan = buildCustomPlan(d, ['clamshells', 'bridges']);
    expect(plan.exercises.map((x) => x.name)).toEqual(['bridges', 'clamshells']);
    expect(plan.recipe).toBe('custom');
  });

  it('never includes the unplayable, even if picked', () => {
    const plan = buildCustomPlan(d, ['unplayable', 'toe curls']);
    expect(plan.exercises.map((x) => x.name)).toEqual(['toe curls']);
  });

  it('matches names case-insensitively', () => {
    expect(buildCustomPlan(d, ['BRIDGES']).exercises).toHaveLength(1);
  });
});

describe('nearDuplicateWarnings — warn, never remove', () => {
  const d = detail([
    ex({ name: 'heel raise', movement_group: 'calf raise' }),
    ex({ name: 'standing calf raises', movement_group: 'calf raise' }),
    ex({ name: 'bridges', movement_group: 'bridge' }),
    ex({ name: 'toe curls', movement_group: 'toe curl' }),
    ex({ name: 'GLUTE SETS', movement_group: null }),
  ]);

  it('flags two picks from the same movement group', () => {
    const w = nearDuplicateWarnings(d, ['heel raise', 'standing calf raises', 'toe curls']);
    expect(w).toHaveLength(1);
    expect(w[0].group).toBe('calf raise');
    expect(w[0].names.sort()).toEqual(['heel raise', 'standing calf raises']);
  });

  it('is silent when picks are all distinct movements', () => {
    expect(nearDuplicateWarnings(d, ['heel raise', 'bridges', 'toe curls'])).toEqual([]);
  });

  it('never warns on ungrouped exercises', () => {
    expect(nearDuplicateWarnings(d, ['GLUTE SETS', 'bridges'])).toEqual([]);
  });

  it('does not remove anything — buildCustomPlan still keeps both', () => {
    // The warning is advisory; the plan the user confirms is untouched.
    const plan = buildCustomPlan(d, ['heel raise', 'standing calf raises']);
    expect(plan.exercises.map((x) => x.name)).toEqual(['heel raise', 'standing calf raises']);
  });
});

// ── SLICE 1: the minutes the early-exit card promises ──────────────────────
//
// The card says "about 7 minutes left" to someone deciding whether to quit at
// exercise 5 of 15. That number is COMPUTED from the remaining exercises' own
// doses; a made-up one is a lie the user can time with a clock.

describe('remainingMinutes — the honest cost of finishing', () => {
  // 10 reps x 3s pace = 30s work + 15s rest, x2 sets = 90s
  const dosed = ex({ name: 'a', dose: { reps: 10, sets: 2, pace_seconds_per_rep: 3 } });
  // 30s hold + 15s rest, 1 set = 45s
  const held = ex({ name: 'b', dose: { hold_seconds: 30, sets: 1 } });
  const noDose = ex({ name: 'c', dose: null });

  it('counts only what is STILL AHEAD, from the real doses', () => {
    const plan = buildPlan(detail([dosed, held, noDose]), 'full');
    // nothing done: 90 + 45 + 60 = 195s -> 3 min
    expect(remainingMinutes(plan, 0)).toBe(3);
    // one done: 45 + 60 = 105s -> 2 min
    expect(remainingMinutes(plan, 1)).toBe(2);
    // two done: 60s -> 1 min
    expect(remainingMinutes(plan, 2)).toBe(1);
  });

  it('agrees with the plan estimate the recipe card already shows', () => {
    const plan = buildPlan(detail([dosed, held, noDose]), 'full');
    expect(remainingMinutes(plan, 0)).toBe(plan.estimatedMinutes);
  });

  it('a plan with NULL doses falls back to the stated per-exercise default', () => {
    // No dose = follow-the-video: there is nothing to compute, so each such
    // exercise is worth NO_DOSE_SECONDS and that constant is the only guess.
    const plan = buildPlan(detail([noDose, noDose, noDose]), 'full');
    expect(NO_DOSE_SECONDS).toBe(60);
    expect(remainingMinutes(plan, 0)).toBe(3);   // 3 x 60s
    expect(remainingMinutes(plan, 2)).toBe(1);
  });

  it('returns 0 when nothing is left — the screen drops the time clause', () => {
    const plan = buildPlan(detail([dosed, held]), 'full');
    expect(remainingMinutes(plan, 2)).toBe(0);
    expect(remainingMinutes(plan, 9)).toBe(0);   // overshoot never goes negative
  });

  it('a nonsense count is CLAMPED, not handed to slice()', () => {
    // A negative count reaching `slice()` unclamped quietly returns the LAST
    // n exercises instead of all of them — a card that under-promises the work
    // left. Four exercises so the two readings cannot coincide.
    const plan = buildPlan(detail([dosed, dosed, dosed, held]), 'full');
    expect(remainingMinutes(plan, 0)).toBe(5);        // 90*3 + 45 = 315s
    expect(remainingMinutes(plan, -3)).toBe(remainingMinutes(plan, 0));
    expect(remainingMinutes(plan, 1.7)).toBe(remainingMinutes(plan, 1));
  });

  it('never says "0 minutes" while an exercise remains', () => {
    // A single 1-rep exercise estimates at 18s — under a minute, still not 0.
    const plan = buildPlan(detail([ex({ dose: { reps: 1, sets: 1 } })]), 'full');
    expect(remainingMinutes(plan, 0)).toBe(1);
  });
});

// ── SLICE 2: the shorter-recipe note ───────────────────────────────────────

describe('recipeNote — honest, and only when there is something to say', () => {
  it('the full session gets no commentary', () => {
    expect(recipeNote('full')).toBeNull();
  });

  it('every shorter recipe gets its OWN note', () => {
    // Distinct keys on purpose: "short" exists for a busy day and "gentle"
    // for a sore one, and telling a person in pain they picked wrong is how
    // an app gets deleted.
    const keys = ['short', 'gentle', 'custom'].map((r) => recipeNote(r as never));
    expect(keys).toEqual(['today.noteShort', 'today.noteGentle', 'today.noteCustom']);
    expect(new Set(keys).size).toBe(3);
  });
});
