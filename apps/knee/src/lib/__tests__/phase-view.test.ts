// The phase experience's pure decisions (docs/57). The load-bearing one is
// evaluateFinder — it MUST agree with the server's evaluate_finder, so these
// mirror the backend's placement cases exactly.

import {
  evaluateFinder,
  nextPhase,
  phaseById,
  type WireFinder,
  type WirePhaseContent,
} from '../phase-view';

const FINDER: WireFinder = {
  questions: [
    { id: 'swell', kind: 'scale', prompt: 'Swelling days?', max: 7, unit: 'days',
      sets_flag: 'swell', flag_min: 4 },
    { id: 'stand', kind: 'choice', prompt: 'Stand?', options: [
      { value: 'lt10', label: 'Under 10', sets: ['stand'] },
      { value: 'gt30', label: '30+', sets: [] }] },
    { id: 'glutes', kind: 'choice', prompt: 'Glutes?', options: [
      { value: 'no', label: 'No', sets: ['glutesOff'] },
      { value: 'indiv', label: 'Yes', sets: ['glutesIndiv'] }] },
    { id: 'flare', kind: 'choice', prompt: 'Flare?', options: [
      { value: 'month', label: 'Monthly', sets: ['rare'] },
      { value: 'free', label: 'Free', sets: ['free'] }] },
  ],
  flag_ids: ['swell', 'stand', 'glutesOff'],
  ladder: [
    { all: ['free'], phase: '4' },
    { all: ['glutesIndiv', 'rare'], phase: '3' },
  ],
  default: '2',
  flag_phase: '1',
};

describe('evaluateFinder — mirrors the server placement', () => {
  it('nothing answered → the default', () => {
    expect(evaluateFinder(FINDER, {})).toBe('2');
  });

  it('a scale over its threshold is a red flag → phase 1', () => {
    expect(evaluateFinder(FINDER, { swell: 5 })).toBe('1');
  });

  it('a scale under the threshold is not a flag', () => {
    expect(evaluateFinder(FINDER, { swell: 3 })).toBe('2');
  });

  it('a flagging choice → phase 1', () => {
    expect(evaluateFinder(FINDER, { stand: 'lt10' })).toBe('1');
    expect(evaluateFinder(FINDER, { glutes: 'no' })).toBe('1');
  });

  it('a flag beats every progress signal', () => {
    expect(evaluateFinder(FINDER, { swell: 6, flare: 'free' })).toBe('1');
  });

  it('symptom-free → phase 4', () => {
    expect(evaluateFinder(FINDER, { flare: 'free' })).toBe('4');
  });

  it('the full milestone (individual glutes AND rare flares) → phase 3', () => {
    expect(evaluateFinder(FINDER, { glutes: 'indiv', flare: 'month' })).toBe('3');
  });

  it('half the milestone is not phase 3', () => {
    expect(evaluateFinder(FINDER, { glutes: 'indiv' })).toBe('2');
    expect(evaluateFinder(FINDER, { flare: 'month' })).toBe('2');
  });
});

describe('phase helpers index by id, never by position', () => {
  const phases = [
    { phase: '1', name: 'Calm the joint' },
    { phase: '2', name: 'Master control' },
    { phase: '3', name: 'Build strength' },
    { phase: '4', name: 'Back to life' },
  ] as WirePhaseContent[];

  it('phaseById finds by id', () => {
    expect(phaseById(phases, '3')?.name).toBe('Build strength');
    expect(phaseById(phases, '9')).toBeUndefined();
  });

  it('nextPhase returns the one after, and undefined at the top', () => {
    expect(nextPhase(phases, '2')?.phase).toBe('3');
    expect(nextPhase(phases, '4')).toBeUndefined();
  });
});
