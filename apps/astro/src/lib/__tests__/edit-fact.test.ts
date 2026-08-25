/**
 * docs/49 ASTRAL-138 (amended 2026-08-26, owner bug 10761055) — editing a
 * birth fact in place, tested where the decisions live.
 *
 * Relative imports on purpose (see `settings-rows.test.ts`): the root jest
 * project maps `@/*` to the WEB app's `src`.
 *
 * The load-bearing test in this file is the FIRST one. Everything else here
 * is ordinary view-model behaviour; that one is the seam between two repos,
 * and it is the only place the client can state what the engine must agree
 * to. Its counterpart is `chatservice/tests/test_astrology_field_correction.py
 * ::TestTheCorrectionCueIsARequestShape::test_the_clients_own_sentence_fires_
 * this_cue`, which asserts the same three literals fire the engine's cue and
 * name the right field.
 */

import {
  CORRECTION_TURNS,
  correctionTurn,
  editFailure,
  editRoute,
  isEditableFactKey,
  isReturningEdit,
  outcomeLine,
} from '../edit-fact';
import { FACT_ORDER } from '../profile-view';

describe('the sentence that opens a correction', () => {
  it('is a declared constant per fact — these exact strings', () => {
    // If you are here because this went red: the engine's cue is the other
    // half of this contract. Change both, or neither.
    expect(CORRECTION_TURNS).toEqual({
      date_of_birth: 'Please correct my date of birth.',
      time_of_birth: 'Please correct my birth time.',
      place_of_birth: 'Please correct my birth place.',
    });
  });

  it('covers every fact the profile calls editable', () => {
    for (const key of FACT_ORDER) {
      expect(typeof CORRECTION_TURNS[key]).toBe('string');
      expect(CORRECTION_TURNS[key].length).toBeGreaterThan(10);
    }
  });

  it('carries intent and NO value — no digit reaches the engine this way', () => {
    for (const turn of Object.values(CORRECTION_TURNS)) {
      expect(turn).not.toMatch(/\d/);
    }
  });

  it('carries a REQUEST SHAPE, which is what the engine cue requires', () => {
    // The engine refuses the vocabulary alone ("is my birth time correct?"),
    // so a sentence with the noun and no correction verb would be answered
    // with prose and this screen would show its honest "no form" state
    // forever. Checked here as a property, not as a re-implementation of the
    // regex: the authoritative match is the engine test named above.
    for (const turn of Object.values(CORRECTION_TURNS)) {
      expect(turn.toLowerCase()).toMatch(/\b(correct|change|update)\s+my\b/);
    }
  });

  it('refuses a field it has no declared sentence for', () => {
    expect(correctionTurn('birth_time')).toBeNull();
    expect(correctionTurn('lagna')).toBeNull();
    expect(correctionTurn('')).toBeNull();
    expect(isEditableFactKey('date_of_birth')).toBe(true);
    expect(isEditableFactKey('latitude')).toBe(false);
  });
});

describe('where "Change it" goes', () => {
  it('opens screen 2 field-scoped, returning to profile', () => {
    expect(editRoute('time_of_birth')).toEqual({
      pathname: '/birth-details',
      params: {
        opening: 'Please correct my birth time.',
        field: 'time_of_birth',
        returnTo: 'profile',
      },
    });
  });

  it('never puts a fact VALUE in a route param', () => {
    for (const key of FACT_ORDER) {
      const route = editRoute(key)!;
      const serialised = JSON.stringify(route.params);
      expect(serialised).not.toMatch(/\d{4}-\d{2}-\d{2}/); // a date
      expect(serialised).not.toMatch(/\d{1,2}:\d{2}/); // a time
      expect(serialised).not.toMatch(/\d/);
    }
  });

  it('is null for anything it cannot open, rather than a guessed route', () => {
    expect(editRoute('latitude')).toBeNull();
  });

  it('recognises the return trip and nothing else', () => {
    expect(isReturningEdit('profile')).toBe(true);
    expect(isReturningEdit('chat')).toBe(false);
    expect(isReturningEdit(undefined)).toBe(false);
  });
});

describe('the outcome line', () => {
  it('is the engine’s first sentence, verbatim', () => {
    const reply =
      'Your birth time is now **15:20**. That leaves your chart and 1 saved match ' +
      'to be recomputed — which happens the next time you ask for a reading, not ' +
      'quietly behind your back.\n\n';
    expect(outcomeLine(reply)).toBe(
      'Your birth time is now 15:20. That leaves your chart and 1 saved match to be ' +
        'recomputed — which happens the next time you ask for a reading, not quietly ' +
        'behind your back.',
    );
  });

  it('never renders a fenced block at the user', () => {
    const reply = 'Your birth time is now 15:20.\n\n```input_request\n{"type":"x"}\n```\n';
    expect(outcomeLine(reply)).toBe('Your birth time is now 15:20.');
    expect(outcomeLine(reply)).not.toContain('{');
  });

  it('takes the FIRST paragraph — the outcome leads the reply', () => {
    const reply = 'Your birth place is no longer on file.\n\nAnd here is a reading.';
    expect(outcomeLine(reply)).toBe('Your birth place is no longer on file.');
  });

  it('unwraps an engine note marker rather than showing the asterisks', () => {
    expect(outcomeLine('*Note: I couldn’t use that time — 25:71 is not a time.*')).toBe(
      'I couldn’t use that time — 25:71 is not a time.',
    );
  });

  it('is empty when there is nothing to say', () => {
    expect(outcomeLine('')).toBe('');
    expect(outcomeLine(undefined)).toBe('');
    expect(outcomeLine('```input_request\n{}\n```')).toBe('');
  });
});

describe('honest failure', () => {
  it('keeps transport, no-form and refusal apart', () => {
    const transport = editFailure('transport', 'Network request failed');
    const noForm = editFailure('no_form');
    const refused = editFailure('refused', "'25:71' is not a time of day");
    expect(transport).toContain('Network request failed');
    expect(transport).toContain('Nothing was changed');
    expect(noForm).toContain('without the picker');
    expect(refused).toContain('25:71');
    expect(new Set([transport, noForm, refused]).size).toBe(3);
  });

  it('says nothing changed when nothing changed', () => {
    expect(editFailure('transport')).toContain('Nothing was changed');
    expect(editFailure('no_form')).toContain('Nothing was changed');
    expect(editFailure('refused')).toContain('nothing was changed');
  });

  it('never claims success it cannot see', () => {
    for (const kind of ['transport', 'no_form', 'refused'] as const) {
      expect(editFailure(kind).toLowerCase()).not.toMatch(/saved|updated|changed to/);
    }
  });
});
