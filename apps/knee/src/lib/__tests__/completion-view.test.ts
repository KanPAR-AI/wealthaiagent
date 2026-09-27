/**
 * Session-completion capture — the gates that turned 13 session starts /
 * 0 recorded completions into honest records. The decision table, the exit
 * prompt's machine (double-taps can't double-record), and the anonymous
 * nudge gate.
 */
import {
  MIN_PARTIAL_EXERCISES,
  completionAction,
  exercisesDone,
  exitHeadlineKey,
  exitPromptKind,
  exitQuietKey,
  isAnonymous,
  promptNext,
} from '../completion-view';
import type { SessionPlan } from '../session-view';

describe('completionAction — the decision table', () => {
  it('the full plan records itself', () => {
    expect(completionAction(5, 5, false)).toBe('auto_record');
    expect(completionAction(2, 2, false)).toBe('auto_record'); // small plans too
  });

  it('overshoot never downgrades a completion', () => {
    expect(completionAction(6, 5, false)).toBe('auto_record');
  });

  it('a decent partial (≥ 3) prompts, right at the boundary', () => {
    expect(completionAction(3, 5, false)).toBe('prompt');
    expect(completionAction(4, 5, false)).toBe('prompt');
    expect(MIN_PARTIAL_EXERCISES).toBe(3);
  });

  it('below 3 done, exit is exactly as before — silent', () => {
    expect(completionAction(2, 5, false)).toBe('none');
    expect(completionAction(1, 5, false)).toBe('none');
    expect(completionAction(0, 5, false)).toBe('none');
  });

  it('a small plan partially done never prompts (1 of 2)', () => {
    expect(completionAction(1, 2, false)).toBe('none');
  });

  it('DOUBLE-RECORD GUARD: once recorded, every count returns none', () => {
    expect(completionAction(5, 5, true)).toBe('none');
    expect(completionAction(3, 5, true)).toBe('none');
    expect(completionAction(6, 5, true)).toBe('none');
  });

  it('an empty plan never records or prompts', () => {
    expect(completionAction(0, 0, false)).toBe('none');
    expect(completionAction(3, 0, false)).toBe('none');
  });
});

describe('exercisesDone — the recorded list is real, in plan order', () => {
  const plan = {
    recipe: 'full', phase: '2', estimatedMinutes: 10,
    exercises: [
      { name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' },
    ],
  } as unknown as SessionPlan;

  it('takes the first N in plan order', () => {
    expect(exercisesDone(plan, 3)).toEqual(['a', 'b', 'c']);
    expect(exercisesDone(plan, 4)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('never invents exercises past the plan or below zero', () => {
    expect(exercisesDone(plan, 9)).toEqual(['a', 'b', 'c', 'd']);
    expect(exercisesDone(plan, 0)).toEqual([]);
    expect(exercisesDone(plan, -1)).toEqual([]);
  });
});

describe('promptNext — the exit prompt machine', () => {
  it('open → saving on Save, open → discarded on Discard', () => {
    expect(promptNext('open', 'save_tap')).toBe('saving');
    expect(promptNext('open', 'discard_tap')).toBe('discarded');
  });

  it('saving resolves: ok → saved, fail → open (retry stays possible)', () => {
    expect(promptNext('saving', 'save_ok')).toBe('saved');
    expect(promptNext('saving', 'save_fail')).toBe('open');
  });

  it('DOUBLE-TAP GUARD: a second Save while saving is refused', () => {
    expect(promptNext('saving', 'save_tap')).toBeNull();
  });

  it('Discard mid-save is refused — one outcome per prompt', () => {
    expect(promptNext('saving', 'discard_tap')).toBeNull();
  });

  it('terminal phases accept nothing', () => {
    for (const ev of ['save_tap', 'save_ok', 'save_fail', 'discard_tap'] as const) {
      expect(promptNext('saved', ev)).toBeNull();
      expect(promptNext('discarded', ev)).toBeNull();
    }
  });

  it('resolution events are meaningless while open', () => {
    expect(promptNext('open', 'save_ok')).toBeNull();
    expect(promptNext('open', 'save_fail')).toBeNull();
  });
});

// ── SLICE 1: the card leads with finishing ─────────────────────────────────
//
// Owner ask 2026-09-27 ("if user are exiting before completing the full
// exercise remind them again"). Continuing became a third outcome, and it must
// be as un-doubleable as save and discard.

describe('promptNext — Keep going is the third outcome', () => {
  it('open → resumed on Keep going', () => {
    expect(promptNext('open', 'keep_going_tap')).toBe('resumed');
  });

  it('DOUBLE-TAP GUARD: Keep going mid-save is refused — one outcome per prompt', () => {
    expect(promptNext('saving', 'keep_going_tap')).toBeNull();
  });

  it('resumed is terminal — no event revives the card', () => {
    for (const ev of ['save_tap', 'save_ok', 'save_fail', 'discard_tap',
                      'keep_going_tap'] as const) {
      expect(promptNext('resumed', ev)).toBeNull();
    }
  });

  it('the older terminals still refuse Keep going', () => {
    expect(promptNext('saved', 'keep_going_tap')).toBeNull();
    expect(promptNext('discarded', 'keep_going_tap')).toBeNull();
  });
});

describe('exitHeadlineKey — never promise a time we do not have', () => {
  it('a real remainder leads with progress and minutes left', () => {
    expect(exitHeadlineKey(7)).toBe('session.keepGoingQ');
    expect(exitHeadlineKey(1)).toBe('session.keepGoingQ');
  });

  it('no honest remainder falls back to the old save question', () => {
    // remainingMinutes returns 0 rather than inventing a number; 0 must never
    // render as "about 0 minutes left".
    expect(exitHeadlineKey(0)).toBe('session.partialQ');
    expect(exitHeadlineKey(-1)).toBe('session.partialQ');
  });
});

describe('isAnonymous — the nudge gate', () => {
  it('a guest (Firebase-anonymous, no providers) = nudge', () => {
    expect(isAnonymous({ anonymous: true, providers: [] })).toBe(true);
  });

  it('any linked provider = never nudge', () => {
    expect(isAnonymous({ anonymous: false, providers: ['password'] })).toBe(false);
    expect(isAnonymous({ anonymous: false, providers: ['google.com', 'password'] })).toBe(false);
    expect(isAnonymous({ anonymous: false, providers: ['phone'] })).toBe(false);
  });

  it('a custom-token user (signed in, EMPTY providerData) = never nudge', () => {
    // The platform's /auth/otp/verify email path mints a Firebase custom token:
    // anonymous:false yet providers:[] — signed in, must not be nagged.
    expect(isAnonymous({ anonymous: false, providers: [] })).toBe(false);
  });

  it('anonymous-with-a-provider (should not exist) = no nudge, the cheaper error', () => {
    expect(isAnonymous({ anonymous: true, providers: ['password'] })).toBe(false);
  });

  it('account not yet known = no nudge (never nag a maybe-linked user)', () => {
    expect(isAnonymous(null)).toBe(false);
    expect(isAnonymous(undefined)).toBe(false);
  });
});


describe('exitPromptKind — REMIND on any unfinished exit, save only if it is worth saving', () => {
  // Review finding B2 (2026-09-27): the card was gated on completionAction ===
  // 'prompt', i.e. on MIN_PARTIAL_EXERCISES, so leaving at exercise 1 or 2 shut
  // the screen in silence — the earliest and largest drop-off, and the exact
  // thing the owner's ask names ("if user are exiting before completing the full
  // exercise remind them again"). Two questions, two answers.

  it('exercise 1 of 15 STILL GETS A REMINDER — the B2 bug', () => {
    expect(exitPromptKind(1, 15, false)).toBe('remind_only');
    expect(exitPromptKind(2, 15, false)).toBe('remind_only');
  });

  it('and that reminder offers NO save — one exercise is not a day\'s work', () => {
    // MIN_PARTIAL_EXERCISES keeps its original job; it just no longer decides
    // whether we speak at all.
    expect(completionAction(1, 15, false)).toBe('none');
    expect(exitQuietKey(exitPromptKind(1, 15, false))).toBe('session.exitAnyway');
  });

  it('a saveable partial reminds AND offers the save', () => {
    expect(exitPromptKind(MIN_PARTIAL_EXERCISES, 15, false)).toBe('remind_and_save');
    expect(exitPromptKind(5, 15, false)).toBe('remind_and_save');   // the live incident
    expect(exitQuietKey(exitPromptKind(5, 15, false))).toBe('session.discard');
  });

  it('the threshold is exactly MIN_PARTIAL_EXERCISES, from ONE owner', () => {
    expect(exitPromptKind(MIN_PARTIAL_EXERCISES - 1, 15, false)).toBe('remind_only');
    expect(exitPromptKind(MIN_PARTIAL_EXERCISES, 15, false)).toBe('remind_and_save');
  });

  it('nothing done yet = silence: there is no set to go back to', () => {
    expect(exitPromptKind(0, 15, false)).toBe('none');
    expect(exitPromptKind(-1, 15, false)).toBe('none');
  });

  it('the finished plan is silence — auto_record owns that moment', () => {
    expect(exitPromptKind(15, 15, false)).toBe('none');
    expect(exitPromptKind(16, 15, false)).toBe('none');
    expect(completionAction(15, 15, false)).toBe('auto_record');
  });

  it('already recorded, or no plan at all, is silence', () => {
    expect(exitPromptKind(5, 15, true)).toBe('none');
    expect(exitPromptKind(0, 0, false)).toBe('none');
    expect(exitPromptKind(3, 0, false)).toBe('none');
  });

  it('a two-exercise plan: one done reminds, no save offered', () => {
    expect(exitPromptKind(1, 2, false)).toBe('remind_only');
  });
});
