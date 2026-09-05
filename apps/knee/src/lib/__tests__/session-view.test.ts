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

  it('rep cues tick at the stored pace after the beat of silence', () => {
    const cues = repCues(3, 3, 'hi');
    expect(cues).toEqual([
      { at: 3, text: 'एक' }, { at: 6, text: 'दो' }, { at: 9, text: 'तीन' },
    ]);
  });

  it('hold cues: go, a check-in every 5s, and the release', () => {
    const cues = holdCues(15, 'en');
    expect(cues).toEqual([
      { at: 3, text: 'go' },
      { at: 8, text: '10' },
      { at: 13, text: '5' },
      { at: 18, text: 'and release' },
    ]);
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
