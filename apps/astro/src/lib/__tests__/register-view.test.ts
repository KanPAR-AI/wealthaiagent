/**
 * docs/74 PH-45 — the register on a screen. The wire entries below are the
 * engine's own, copied from the PH-45 build record (one of each kind); the
 * sentences are the engine's and are asserted to pass through VERBATIM.
 */
import fs from 'fs';
import path from 'path';

import { REGISTER_HEADINGS, registerGroups, registerNote } from '../register-view';
import type { Undetermined } from '../people-shapes';

const humanise = (field: string) => `fallback(${field})`;

const DASHA: Undetermined = {
  field: 'dasha',
  kind: 'undetermined',
  title: 'Your Vimshottari dasha',
  reason:
    'Without a birth time the Vimshottari order cannot be pinned: the Moon changes nakshatra during that day, so it opens under Ketu, Venus or Sun, and the first boundary — with every later boundary behind it — moves by the same amount. A birth time is what settles it.',
  alternatives: [
    'if the Moon was in Ashwini: Ketu opens the sequence and that first period ends somewhere between 1990-05-23 and 1990-07-14',
    'if the Moon was in Bharani: Venus opens the sequence and that first period ends somewhere between 1990-05-23 and 2010-05-23',
    'if the Moon was in Krittika: Sun opens the sequence and that first period ends somewhere between 1995-08-27 and 1996-05-23',
  ],
  unlocked_by: 'time_of_birth',
};

const D9: Undetermined = {
  field: 'sensitive:d9_lagna',
  kind: 'sensitive',
  title: 'Your Navamsa (D9) Lagna',
  reason:
    'Your Navamsa (D9) Lagna turns on a 4-minute window: at your stated birth time it is Sagittarius, 2 minutes either side it is Scorpio. An exact birth time is what settles it.',
  alternatives: ['Scorpio'],
  unlocked_by: 'time_of_birth',
};

const CLOCK: Undetermined = {
  field: 'sensitive:lagna',
  kind: 'sensitive',
  title: 'Your Lagna',
  reason:
    'Your Lagna depends on which clock that birth time was read from — Indian Standard Time and Bombay Time were both in use where and when you were born. On one reading it is Cancer, on the other Leo. The record cannot say which, so a more exact birth time would not settle it.',
  alternatives: ['Leo'],
  unlocked_by: 'which clock the time was read from',
};

const LEGACY_MOON: Undetermined = {
  field: 'moon_rashi',
  reason: 'The Moon changed rashi that day.',
  alternatives: ['Aries', 'Taurus'],
  unlocked_by: 'time_of_birth',
};

describe('the two kinds are not filed under one heading', () => {
  it('a sensitive value is never listed under "cannot say"', () => {
    const groups = registerGroups([DASHA, D9, CLOCK], humanise);
    expect(groups.map((g) => g.heading)).toEqual([
      REGISTER_HEADINGS.undetermined,
      REGISTER_HEADINGS.sensitive,
    ]);
    const cannotSay = groups.find((g) => g.kind === 'undetermined')!;
    expect(cannotSay.notes.map((n) => n.field)).toEqual(['dasha']);
    const sensitive = groups.find((g) => g.kind === 'sensitive')!;
    expect(sensitive.notes.map((n) => n.field)).toEqual(['sensitive:d9_lagna', 'sensitive:lagna']);
  });

  it('a kind with no entries draws no heading', () => {
    expect(registerGroups([D9], humanise).map((g) => g.kind)).toEqual(['sensitive']);
    expect(registerGroups([], humanise)).toEqual([]);
    expect(registerGroups(undefined, humanise)).toEqual([]);
  });

  it('an engine that predates `kind` sent only absences', () => {
    const groups = registerGroups([LEGACY_MOON], humanise);
    expect(groups.map((g) => g.kind)).toEqual(['undetermined']);
  });
});

describe('the title is the engine\'s, and a raw key is never the heading', () => {
  it('uses the engine title when it sent one', () => {
    expect(registerNote(D9, humanise).title).toBe('Your Navamsa (D9) Lagna');
    expect(registerNote(D9, humanise).title).not.toContain('sensitive:');
  });

  it('falls back to the local table only when the engine sent none', () => {
    expect(registerNote(LEGACY_MOON, humanise).title).toBe('fallback(moon_rashi)');
    expect(registerNote({ ...D9, title: '   ' }, humanise).title).toBe('fallback(sensitive:d9_lagna)');
  });

  it('the reason is verbatim', () => {
    for (const e of [DASHA, D9, CLOCK]) expect(registerNote(e, humanise).reason).toBe(e.reason);
  });
});

describe('the caption says what the alternatives ARE', () => {
  it('a sensitive entry names the OTHER reading, never "it is one of"', () => {
    const note = registerNote(D9, humanise);
    expect(note.alternativesLine).toBe('The other reading: Scorpio.');
    expect(note.alternativesList).toEqual([]);
  });

  it('an absence narrows: "it is one of"', () => {
    expect(registerNote(LEGACY_MOON, humanise).alternativesLine).toBe('It is one of: Aries or Taurus.');
  });

  it('alternatives that are sentences are listed, not joined with "or"', () => {
    const note = registerNote(DASHA, humanise);
    expect(note.alternativesLine).toBeNull();
    expect(note.alternativesList).toEqual(DASHA.alternatives);
  });

  it('no alternatives, no caption', () => {
    const note = registerNote({ ...D9, alternatives: [] }, humanise);
    expect(note.alternativesLine).toBeNull();
    expect(note.alternativesList).toEqual([]);
  });
});

describe('this module decides from `kind`, never from the field key', () => {
  const source = fs
    .readFileSync(path.join(__dirname, '..', 'register-view.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  it('parses no key', () => {
    expect(source).not.toMatch(/startsWith|['"`]sensitive:|\.split\(|\.includes\(/);
  });

  it('is pure', () => {
    expect(source).not.toMatch(/from ['"](react|react-native|expo)|fetch\(|Date\.now|new Date/);
  });

  it('both screens render the groups and neither writes a heading of its own', () => {
    for (const screen of ['chart.tsx', 'profile.tsx']) {
      const src = fs.readFileSync(path.join(__dirname, '..', '..', 'app', screen), 'utf8');
      expect(src).toMatch(/RegisterGroups\(/);
      expect(src).not.toContain('What this chart cannot say</Text>');
      expect(src).not.toContain('It is one of:');
    }
  });
});
