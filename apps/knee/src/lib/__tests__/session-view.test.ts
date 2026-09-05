/**
 * The follow-along choreography — what the voice says and when. Pure, so the
 * one thing that must never happen (an invented dose spoken at a patient)
 * is held here rather than hoped for.
 */
import type { WireExercise, WirePhaseDetail } from '../library-view';
import {
  announcement,
  buildPlan,
  doseLabel,
  holdCues,
  localDate,
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
