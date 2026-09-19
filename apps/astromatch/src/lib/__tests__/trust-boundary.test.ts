/**
 * docs/73 ASTRAL-326 / INV-10 — parsed is not confirmed, and the type system
 * says so.
 *
 * Two halves, because the object crosses a context boundary:
 *
 *   COMPILE TIME — a `ParsedProfile` handed to the worker's door is an error.
 *     Asserted by running the compiler over `type-fixtures/sends-parsed.ts`,
 *     not with `@ts-expect-error`: this suite is transpiled by ts-jest with
 *     `isolatedModules`, which type-checks nothing, so an inline expectation
 *     would assert precisely nothing (the same reason `theme-contract.test.ts`
 *     in `packages/astral` runs a real program).
 *
 *   RUN TIME — `chrome.runtime.sendMessage` structured-clones the object and
 *     drops the symbol-keyed brand, so the worker re-checks a string tag AND
 *     every field before it will send anything.
 */

import { join } from 'path';
import ts from 'typescript';

import { ENGINE_HAS_CAPTURE_FIELDS } from '../config';
import {
  CONFIRMED_TAG,
  carrierValues,
  confirmProfile,
  editedKeys,
  parseConfirmedProfile,
} from '../confirmed';
import { parseProfileText } from '../parse-profile';

const APP = join(__dirname, '..', '..', '..');

function diagnosticsFor(fixture: string): ts.Diagnostic[] {
  const file = join(APP, 'type-fixtures', fixture);
  const program = ts.createProgram([file], {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    // The app's own options: the transport type-imports `@wealthai/astral`,
    // whose components are .tsx, so the program needs the JSX setting the
    // real build uses. Without it every import of the package reports
    // "--jsx is not set" and the CONTROL fixture would fail for a reason
    // that has nothing to do with the boundary.
    jsx: ts.JsxEmit.ReactJSX,
    lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'],
  });
  return [...program.getSemanticDiagnostics(), ...program.getSyntacticDiagnostics()];
}

describe('compile time — a parse cannot be sent', () => {
  it('handing the door a ParsedProfile does not compile', () => {
    const errors = diagnosticsFor('sends-parsed.ts');
    expect(errors.length).toBeGreaterThan(0);
    // TS2345 — "Argument of type X is not assignable to parameter of type Y".
    // Asserting the CODE stops an unrelated error (a bad import path, say)
    // from standing in for the one this test is about.
    expect(errors.map((d) => d.code)).toContain(2345);
    const text = errors
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' '))
      .join('\n');
    expect(text).toContain('ParsedProfile');
    expect(text).toContain('ConfirmedProfile');
  });

  it('the same door with a CONFIRMED profile compiles clean', () => {
    expect(
      diagnosticsFor('sends-confirmed.ts').map((d) =>
        ts.flattenDiagnosticMessageText(d.messageText, ' '),
      ),
    ).toEqual([]);
  });
});

describe('run time — the worker re-checks what arrived', () => {
  const good = {
    tag: CONFIRMED_TAG,
    source: 'paste',
    name: 'Someone',
    dob: '1994-05-14',
    tob: '10:30',
    pob: 'Pune, India',
    acts: { name: 'typed', dob: 'accepted', tob: 'accepted', pob: 'typed' },
  };

  it('accepts a confirmed profile that survived the clone', () => {
    const parsed = parseConfirmedProfile(JSON.parse(JSON.stringify(good)));
    expect(parsed?.dob).toBe('1994-05-14');
    expect(parsed?.acts.dob).toBe('accepted');
  });

  it('refuses a raw parse, which is the shape most likely to arrive by mistake', () => {
    const parsed = parseProfileText('Name: Someone\nDOB: 1994-05-14\nPOB: Pune');
    expect(parseConfirmedProfile(parsed)).toBeNull();
    expect(parseConfirmedProfile(JSON.parse(JSON.stringify(parsed)))).toBeNull();
  });

  it.each([
    ['no tag', { ...good, tag: undefined }],
    ['a made-up tag', { ...good, tag: 'confirmed' }],
    ['a date that is not ISO', { ...good, dob: '14/05/1994' }],
    ['a time that is not 24-hour', { ...good, tob: '10:30 am' }],
    ['an empty place', { ...good, pob: '   ' }],
    ['a capture channel we do not have', { ...good, source: 'shaadi.com' }],
    ['a field with no recorded act', { ...good, acts: { name: 'typed' } }],
    ['nothing at all', null],
    ['a string', 'confirmed'],
  ])('refuses %s', (_label, value) => {
    expect(parseConfirmedProfile(value as unknown)).toBeNull();
  });

  it('keeps "I don\'t know" as a real answer, not as a missing one', () => {
    const parsed = parseConfirmedProfile({ ...good, tob: null, acts: { ...good.acts, tob: 'declined' } });
    expect(parsed?.tob).toBeNull();
  });
});

describe('confirming is an ACT per field, and it refuses rather than repairs', () => {
  it('refuses a field the user never touched', () => {
    const outcome = confirmProfile('paste', {
      name: { act: 'typed', value: 'Someone' },
      dob: { act: 'typed', value: '1994-05-14' },
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('unreachable');
    expect(outcome.refusals.map((r) => r.field).sort()).toEqual(['pob', 'tob']);
  });

  it.each([
    ['a date in the ambiguous form', { dob: '03/04/1989' }],
    ['a 12-hour time', { tob: '10:30 pm' }],
    ['an empty place', { pob: '' }],
  ])('refuses %s by name instead of coercing it', (_label, override) => {
    const outcome = confirmProfile('paste', {
      name: { act: 'typed', value: 'Someone' },
      dob: { act: 'typed', value: (override as { dob?: string }).dob ?? '1994-05-14' },
      tob: { act: 'typed', value: (override as { tob?: string }).tob ?? '10:30' },
      pob: { act: 'typed', value: (override as { pob?: string }).pob ?? 'Pune' },
    });
    expect(outcome.ok).toBe(false);
  });

  it('refuses "I don\'t know" on a date or a place — the engine does too', () => {
    for (const key of ['dob', 'pob'] as const) {
      const decisions = {
        name: { act: 'typed' as const, value: 'Someone' },
        dob: { act: 'typed' as const, value: '1994-05-14' },
        tob: { act: 'typed' as const, value: '10:30' },
        pob: { act: 'typed' as const, value: 'Pune' },
      };
      const outcome = confirmProfile('paste', { ...decisions, [key]: { act: 'declined' } });
      expect(outcome.ok).toBe(false);
    }
  });

  it('records which fields were ACCEPTED and which were TYPED (AMB-68)', () => {
    const outcome = confirmProfile('paste', {
      name: { act: 'accepted', value: 'Someone' },
      dob: { act: 'accepted', value: '1994-05-14' },
      tob: { act: 'declined' },
      pob: { act: 'typed', value: 'Pune, India' },
    });
    if (!outcome.ok) throw new Error('expected this to confirm');
    expect(outcome.profile.acts).toEqual({
      name: 'accepted',
      dob: 'accepted',
      tob: 'declined',
      pob: 'typed',
    });
  });
});

describe('the carrier carries the engine\'s keys and no others', () => {
  const profileWith = (acts: Partial<Record<'name' | 'dob' | 'tob' | 'pob', 'accepted' | 'typed'>>) => {
    const outcome = confirmProfile('paste', {
      name: { act: acts.name ?? 'typed', value: 'Someone' },
      dob: { act: acts.dob ?? 'typed', value: '1994-05-14' },
      tob: { act: acts.tob ?? 'typed', value: '10:30' },
      pob: { act: acts.pob ?? 'typed', value: 'Pune, India' },
    });
    if (!outcome.ok) throw new Error('unreachable');
    return outcome.profile;
  };
  const profile = profileWith({});

  const ASKED = ['person2_dob', 'person2_tob', 'person2_pob'];

  it('answers the three keys the ask carried', () => {
    const values = carrierValues(profile, ASKED);
    expect(values.person2_dob).toBe('1994-05-14');
    expect(values.person2_tob).toBe('10:30');
    expect(values.person2_pob).toBe('Pune, India');
  });

  it('rides the two PH-38 capture stamps along with them (ASTRAL-313)', () => {
    // `_input_request_keys` does not list these on either ask, and the
    // engine's parser accepts any DECLARED field on the fence — so they
    // travel with the details, where they are true.
    const values = carrierValues(profile, ASKED, true);
    expect(values.capture_source).toBe('paste');
    expect(values.capture_edited).toEqual(['person2_dob', 'person2_tob', 'person2_pob']);
  });

  it('sends NEITHER stamp when the engine does not declare them (B7)', () => {
    // The gate, exercised for real rather than skipped. `graph.
    // _parse_input_response` refuses an undeclared key BY NAME, which would
    // put a visible refusal into a turn that otherwise worked — so the flip
    // has to keep working in both directions, and a test that read the
    // constant and returned early proved nothing about either.
    const values = carrierValues(profile, ASKED, false);
    expect('capture_source' in values).toBe(false);
    expect('capture_edited' in values).toBe(false);
    expect(Object.keys(values).sort()).toEqual(['person2_dob', 'person2_pob', 'person2_tob']);
  });

  it('follows the build\'s own constant when nobody passes one', () => {
    const values = carrierValues(profile, ASKED);
    expect('capture_source' in values).toBe(ENGINE_HAS_CAPTURE_FIELDS);
  });

  it('names only the fields the user TYPED as edited (AMB-68(a))', () => {
    const values = carrierValues(
      profileWith({ dob: 'accepted', tob: 'accepted', pob: 'typed' }),
      ASKED,
      true,
    );
    expect(values.capture_edited).toEqual(['person2_pob']);
  });

  it('carries BELIEF KEYS on capture_edited, never values', () => {
    const edited = editedKeys(profile);
    expect(edited).toEqual(['person2_dob', 'person2_tob', 'person2_pob']);
    for (const value of ['1994-05-14', '10:30', 'Pune, India', 'Someone']) {
      expect(edited).not.toContain(value);
    }
  });

  it('never puts the NAME on capture_edited — it is off the engine\'s menu', () => {
    // `capture_edited`'s options are the three person2 belief keys. An
    // off-menu value is refused by name, so a `person2_name` here would
    // turn a working save into a visible refusal.
    expect(editedKeys(profile)).not.toContain('person2_name');
    expect(editedKeys(profile)).not.toContain('name');
  });

  it('counts a DECLINED birth time as not edited', () => {
    const outcome = confirmProfile('snapshot', {
      name: { act: 'accepted', value: 'Someone' },
      dob: { act: 'accepted', value: '1994-05-14' },
      tob: { act: 'declined' },
      pob: { act: 'accepted', value: 'Pune' },
    });
    if (!outcome.ok) throw new Error('unreachable');
    expect(editedKeys(outcome.profile)).toEqual([]);
  });

  it('never invents a key the ask did not carry', () => {
    // A self-ask (`dob` / `tob` / `pob`) is not answerable from a partner's
    // profile, and nothing — including the stamps — is sent for it.
    expect(carrierValues(profile, ['dob', 'tob', 'pob'])).toEqual({});
  });
});
