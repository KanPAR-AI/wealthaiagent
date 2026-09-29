/**
 * Bug bf83c4d7 — "Repeated videos in phase 2" (KneeFit, 2026-09-28).
 *
 * Measured on production: three phase-2 exercises (glute bridges, heel raise,
 * standing calf raises) were whole-file corpus rows — no start, no end, so no
 * clip — and the app's `clip_src ?? clip_url ?? src` fell through to the full
 * source: three silent videos that all open on the same six-second
 * "PHASE 2 EXERCISES" title card. The engine now omits such rows and names
 * them (`omitted`); this file pins the client's side of the contract:
 *
 *   - a row without a segment and without a clip is NOT playable and gets
 *     no playUrl (the belt for the deploy window and for an older server),
 *   - it never enters a session plan or the "Build my own" picker,
 *   - the engine's `omitted` entries render as honest rows,
 *   - the subtitle says how many are awaiting a segment instead of
 *     overclaiming "the complete set".
 *
 * Fixture `program-phase2-omitted.json` is CAPTURED from the engine
 * (knee_program.py under its keyless test harness, on the real document
 * shape of the three unsegmented rows) — never hand-written.
 */
import * as fs from 'fs';
import * as path from 'path';

import {
  exerciseRows,
  hasSegment,
  isExercisePlayable,
  omittedRows,
  phaseSubtitle,
  type WireExercise,
  type WirePhaseDetail,
} from '../library-view';
import { buildCustomPlan, buildPlan, playableExercises } from '../session-view';

function fixture<T>(name: string): T {
  const p = path.join(__dirname, 'fixtures', name);
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

const captured = fixture<WirePhaseDetail>('program-phase2-omitted.json');

function ex(over: Partial<WireExercise>): WireExercise {
  return {
    name: 'x', title: 'x', phase: '2', start_seconds: 10, end_seconds: 50,
    video_file: 'A.mp4', url: 'https://v/1#t=10', src: 'https://s/1#t=10',
    clip_url: null, clip_src: null, dose: null, dub_langs: [], ...over,
  };
}

// The whole-file row exactly as an OLD server would still send it: footage
// stored (url/src present), no span, no clip.
const WHOLE_FILE = ex({
  name: 'glute bridges', title: 'Unnamed (El_Paso_Manual_Physical_Therapy (18).mp4)',
  start_seconds: null, end_seconds: null,
  url: 'https://v/18', src: 'https://s/18',
});

describe('hasSegment / isExercisePlayable', () => {
  it('a stamped start is a segment; null, negative or non-numeric is not', () => {
    expect(hasSegment({ start_seconds: 6 })).toBe(true);
    expect(hasSegment({ start_seconds: 0 })).toBe(true);
    expect(hasSegment({ start_seconds: null })).toBe(false);
    expect(hasSegment({ start_seconds: -1 })).toBe(false);
    expect(hasSegment({ start_seconds: Number.NaN })).toBe(false);
  });

  it('stored footage without a segment or a clip is NOT playable as an exercise', () => {
    expect(isExercisePlayable(WHOLE_FILE)).toBe(false);
  });

  it('a clip alone is enough (it was cut from a segment)', () => {
    expect(isExercisePlayable(ex({ start_seconds: null, end_seconds: null,
      clip_src: 'https://c/1' }))).toBe(true);
  });

  it('a segment without a clip plays its span from the full source', () => {
    expect(isExercisePlayable(ex({ clip_src: null, clip_url: null }))).toBe(true);
  });

  it('no footage at all is still not playable (the older rule survives)', () => {
    expect(isExercisePlayable(ex({ url: null, src: null }))).toBe(false);
  });
});

describe('exerciseRows — the whole-file row gets no player', () => {
  const detail: WirePhaseDetail = {
    corpus_id: 'knee_timed', phase: '2', name: 'Master control',
    count: 2, catalog_count: 2, complete: true,
    exercises: [ex({ name: 'ARCH ACTIVATION', start_seconds: 6, end_seconds: 120.31 }), WHOLE_FILE],
  } as WirePhaseDetail;
  const [arch, whole] = exerciseRows(detail);

  it('the segmented row plays as before', () => {
    expect(arch.playable).toBe(true);
    expect(arch.playUrl).toBe('https://s/1#t=10');
    expect(arch.notReady).toBe(false);
  });

  it('the whole-file row is rendered, not played: no playUrl, "not ready"', () => {
    expect(whole.name).toBe('glute bridges');
    expect(whole.playable).toBe(false);
    expect(whole.playUrl).toBeNull();
    expect(whole.notReady).toBe(true);   // footage exists — the SEGMENT is missing
    expect(whole.clock).toBeNull();
  });

  it('"no footage yet" and "segment not ready" are different states', () => {
    const [none] = exerciseRows({ ...detail, exercises: [ex({ url: null, src: null })] });
    expect(none.playable).toBe(false);
    expect(none.notReady).toBe(false);
  });
});

describe('session plans never contain a whole-file exercise', () => {
  const detail: WirePhaseDetail = {
    corpus_id: 'knee_timed', phase: '2', name: 'Master control',
    count: 3, catalog_count: 3, complete: true,
    exercises: [
      ex({ name: 'bridges', clip_src: 'https://c/b', dose: { reps: 10, sets: 2 } }),
      WHOLE_FILE,
      ex({ name: 'clamshells', dose: { reps: 10, sets: 2 } }),
    ],
  } as WirePhaseDetail;

  it('playableExercises drops it — and it is what the picker lists', () => {
    expect(playableExercises(detail).map((e) => e.name)).toEqual(['bridges', 'clamshells']);
  });

  it.each(['full', 'short', 'gentle'] as const)('%s recipe', (recipe) => {
    const names = buildPlan(detail, recipe).exercises.map((x) => x.name);
    expect(names).not.toContain('glute bridges');
    expect(names.length).toBeGreaterThan(0);
  });

  it('not even when picked by name in "Build my own"', () => {
    const plan = buildCustomPlan(detail, ['glute bridges', 'bridges']);
    expect(plan.exercises.map((x) => x.name)).toEqual(['bridges']);
  });
});

describe('the captured engine response with omissions', () => {
  it('serves only segmented rows and names the three omissions with the reason', () => {
    expect(captured.count).toBe(captured.exercises.length);
    expect(captured.exercises.every((e) => typeof e.start_seconds === 'number')).toBe(true);
    expect(captured.omitted_count).toBe(3);
    expect(omittedRows(captured).map((o) => o.name)).toEqual([
      'glute bridges', 'heel raise', 'standing calf raises',
    ]);
    expect(omittedRows(captured).every((o) => o.reason === 'no_segment')).toBe(true);
    expect(omittedRows(captured)[0].videoFile).toMatch(/\.mp4$/);
  });

  it('every served row is playable — the client belt agrees with the engine', () => {
    expect(exerciseRows(captured).every((r) => r.playable)).toBe(true);
  });

  it('the subtitle says how many await a segment instead of "the complete set"', () => {
    expect(captured.complete).toBe(true);           // membership matches the catalog
    expect(phaseSubtitle(captured)).toBe('2 exercises — 3 awaiting a segment');
  });

  it('an older server (no omitted fields) reads exactly as before', () => {
    const { omitted: _o, omitted_count: _c, ...older } = captured;
    expect(omittedRows(older as WirePhaseDetail)).toEqual([]);
    expect(phaseSubtitle(older as WirePhaseDetail)).toBe('2 exercises — the complete set');
  });

  it('a mismatch AND omissions: both are said', () => {
    expect(phaseSubtitle({ ...captured, complete: false, catalog_count: 9 }))
      .toBe('2 exercises indexed of 9 in the catalog, 3 awaiting a segment');
  });
});

describe('the captured phase-4 response (round 2: 4 served, 2 omitted)', () => {
  const phase4 = fixture<WirePhaseDetail>('program-phase4-omitted.json');

  it('four segmented rows serve, the two whole-file rows are named as omitted', () => {
    expect(phase4.count).toBe(4);
    expect(exerciseRows(phase4).map((r) => r.name)).toEqual([
      'squats', 'deadlift', 'overhead lifts', 'thruster',
    ]);
    expect(exerciseRows(phase4).every((r) => r.playable && !r.notReady)).toBe(true);
    expect(omittedRows(phase4).map((o) => o.name)).toEqual([
      'barbell front squats', 'barbell deadlifts',
    ]);
    expect(phaseSubtitle(phase4)).toBe('4 exercises — 2 awaiting a segment');
  });

  it('the activity section rides beside, untouched by the guard', () => {
    expect(phase4.sections?.map((s) => s.category)).toEqual(['activity']);
    expect(buildPlan(phase4, 'full').exercises.map((x) => x.name)).toEqual([
      'squats', 'deadlift', 'overhead lifts', 'thruster',
    ]);
  });
});
