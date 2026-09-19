/**
 * docs/73 ASTRAL-325 — the local parser, on a SYNTHETIC corpus.
 *
 * Every string below was written for this test. No text is copied from any
 * live matrimonial profile and no real person's details are in this file:
 * the names are invented, and the whole point of the parser is that its
 * output never leaves the browser anyway.
 *
 * Each case asserts the STATE as well as the value. A parser that returns the
 * right date with the wrong state is the failure this phase is about — it is
 * what turns "found but guessed" into "the user confirmed it".
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  parseProfileText,
  parseProfileWithDiagnostics,
  readDate,
  readTime,
  spell,
} from '../parse-profile';
import type { Candidate, FieldState } from '../confirmed';

const expectField = (c: Candidate, state: FieldState, value: string | null) => {
  expect([c.state, c.value]).toEqual([state, value]);
};

describe('dates', () => {
  const STATED: Array<[string, string]> = [
    ['1994-05-14', '1994-05-14'],
    ['14 May 1994', '1994-05-14'],
    ['14th May 1994', '1994-05-14'],
    ['May 14, 1994', '1994-05-14'],
    ['2 September 1988', '1988-09-02'],
    ['02 Sept 1988', '1988-09-02'],
    ['1994/05/14', '1994-05-14'],
    // day > 12, so only one reading is a real date
    ['14/05/1994', '1994-05-14'],
    ['14-05-1994', '1994-05-14'],
    ['14.05.1994', '1994-05-14'],
    // month-first, forced by a day that cannot be a month
    ['03/14/1989', '1989-03-14'],
    ['29-02-1992', '1992-02-29'],
  ];
  it.each(STATED)('reads %s as a stated %s', (raw, iso) => {
    expectField(readDate(raw), 'stated', iso);
  });

  it('marks a genuinely ambiguous numeric date INFERRED and names both readings', () => {
    const c = readDate('03/04/1989');
    expect(c.state).toBe('inferred');
    expect(c.value).toBe('1989-04-03');
    // B3: the sentence asks, it does not announce a choice the screen no
    // longer makes — nothing is pre-filled and both readings are chips.
    expect(c.basis).toBe(
      '"03/04/1989" is two real dates — 3 April 1989 (day first) or ' +
        '4 March 1989 (month first). Pick the one you mean.',
    );
    expect(c.basis).not.toMatch(/I read it day first/);
  });

  it('builds that sentence from the VALUES, not from a hardcoded example', () => {
    const c = readDate('05/06/1991');
    expect(c.basis).toBe(
      '"05/06/1991" is two real dates — 5 June 1991 (day first) or ' +
        '6 May 1991 (month first). Pick the one you mean.',
    );
  });

  const UNREADABLE = [
    '31/02/1990',   // not a day in February
    '29-02-1991',   // 1991 is not a leap year
    '14/05/94',     // a two-digit year is not a century
    'sometime in 1994',
    'नहीं पता',
    '',
  ];
  it.each(UNREADABLE)('refuses to invent a date from %p', (raw) => {
    expectField(readDate(raw), 'missing', null);
  });
});

describe('times', () => {
  const STATED: Array<[string, string]> = [
    ['22:30', '22:30'],
    ['10:30 am', '10:30'],
    ['10:30 AM', '10:30'],
    ['10:30 pm', '22:30'],
    ['10.30 p.m.', '22:30'],
    ['12:05 am', '00:05'],
    ['12:05 pm', '12:05'],
    ['7 pm', '19:00'],
    ['7 am', '07:00'],
    ['00:15', '00:15'],
    ['13:45', '13:45'],
  ];
  it.each(STATED)('reads %s as a stated %s', (raw, clock) => {
    expectField(readTime(raw), 'stated', clock);
  });

  it('marks a bare morning-or-evening hour INFERRED and names the other half of the day', () => {
    const c = readTime('7:30');
    expect(c.state).toBe('inferred');
    expect(c.value).toBe('07:30');
    expect(c.basis).toContain('19:30');
  });

  it('reads 00:15 and 13:45 as stated — neither exists on a 12-hour clock', () => {
    expectField(readTime('00:15'), 'stated', '00:15');
    expectField(readTime('13:45'), 'stated', '13:45');
  });

  it('names midnight as the other reading of a bare 12:xx', () => {
    const c = readTime('12:20');
    expect(c.state).toBe('inferred');
    expect(c.value).toBe('12:20');
    expect(c.basis).toContain('00:20');
  });

  const UNREADABLE = ['25:00', '10:75', 'morning', 'around sunrise', ''];
  it.each(UNREADABLE)('refuses to invent a time from %p', (raw) => {
    expectField(readTime(raw), 'missing', null);
  });
});

describe('a whole biodata', () => {
  it('reads a plain English one', () => {
    const p = parseProfileText(
      [
        'Name: Meera Iyer',
        'Date of Birth: 14 May 1994',
        'Time of Birth: 10:30 am',
        'Place of Birth: Pune, Maharashtra',
        'Height: 5\'4"',
      ].join('\n'),
    );
    expectField(p.fields.name, 'stated', 'Meera Iyer');
    expectField(p.fields.dob, 'stated', '1994-05-14');
    expectField(p.fields.tob, 'stated', '10:30');
    expectField(p.fields.pob, 'stated', 'Pune, Maharashtra');
    expect(p.kind).toBe('parsed');
    expect(p.source).toBe('paste');
  });

  it('reads a Devanagari-labelled one', () => {
    const p = parseProfileText(
      ['नाम: आरव देशपांडे', 'जन्म तिथि: 1990-08-02', 'जन्म समय: 22:30', 'जन्म स्थान: नागपुर'].join('\n'),
    );
    expectField(p.fields.name, 'stated', 'आरव देशपांडे');
    expectField(p.fields.dob, 'stated', '1990-08-02');
    expectField(p.fields.tob, 'stated', '22:30');
    expectField(p.fields.pob, 'stated', 'नागपुर');
  });

  it('reads "Time of Birth: Not known" as MISSING, not as a name', () => {
    const p = parseProfileText(
      ['Name: Rhea Kapoor', 'DOB: 1991-11-09', 'Time of Birth: Not known', 'POB: Indore'].join('\n'),
    );
    expectField(p.fields.tob, 'missing', null);
    expectField(p.fields.dob, 'stated', '1991-11-09');
  });

  it.each(['Unknown', 'N/A', '-', '—', '?'])(
    'reads a time given as %p as MISSING',
    (word) => {
      const p = parseProfileText(`Time of Birth: ${word}`);
      expectField(p.fields.tob, 'missing', null);
    },
  );

  it('never takes a "Location" row as a STATED birth place', () => {
    const p = parseProfileText(['Name: Kabir Nair', 'Location: Bengaluru'].join('\n'));
    expect(p.fields.pob.state).toBe('inferred');
    expect(p.fields.pob.value).toBe('Bengaluru');
    expect(p.fields.pob.basis).toContain('where they live');
  });

  it.each(['Lives in', 'Current City', 'Residence', 'Based in', 'City'])(
    'treats a "%s" row the same way',
    (label) => {
      const p = parseProfileText(`${label}: Surat`);
      expect(p.fields.pob.state).toBe('inferred');
    },
  );

  it('prefers a real birth place over a residence row when both are present', () => {
    const p = parseProfileText(
      ['Place of Birth: Jamshedpur', 'Location: Bengaluru'].join('\n'),
    );
    expectField(p.fields.pob, 'stated', 'Jamshedpur');
  });

  /**
   * REPLACED, and the replacement is the point (B2, finding F191).
   *
   * This case used to assert `'stated', '1994-05-14'` — "keeps the FIRST
   * labelled row when a page repeats a label" — and it PASSED, which is how
   * the chimera got through review with a test beside it. A repeated label
   * is not a page being redundant; it is a second person's block starting.
   * The first value is still the best candidate, but it is no longer
   * presented as read-off-the-page certain.
   */
  it('treats a repeated label as a RECORD BOUNDARY, not as redundancy', () => {
    const p = parseProfileText(['DOB: 1994-05-14', 'DOB: 1901-01-01'].join('\n'));
    expect(p.fields.dob.value).toBe('1994-05-14');
    expect(p.fields.dob.state).toBe('inferred');
    expect(p.fields.dob.basis).toContain('more than one person');
  });

  it('returns four MISSING fields for prose with no labels', () => {
    const p = parseProfileText('A friendly person who likes hiking and dogs.');
    for (const key of ['name', 'dob', 'tob', 'pob'] as const) {
      expectField(p.fields[key], 'missing', null);
    }
  });

  it('carries the capture channel it was told, and invents none', () => {
    expect(parseProfileText('Name: A', 'selection').source).toBe('selection');
    expect(parseProfileText('Name: A', 'snapshot').source).toBe('snapshot');
  });
});

describe('B2 — a page about a FAMILY must not become one person', () => {
  /**
   * The shape the reviewer found, written as synthetic text for this test:
   * the candidate's NAME, then her brother's DATE, TIME and PLACE. Four
   * independent first-row-wins scans return all four as `stated` and cast a
   * chart for a person who does not exist.
   */
  const TWO_PEOPLE = [
    'Name: Meera Iyer',
    'Height: 5\'4"',
    'Brother',
    'Name: Rohan Iyer',
    'Date of Birth: 02/01/1990',
    'Time of Birth: 06:15 am',
    'Place of Birth: Chennai',
  ].join('\n');

  it('takes NOTHING from the second person\'s block', () => {
    const p = parseProfileText(TWO_PEOPLE);
    expect(p.fields.name.value).toBe('Meera Iyer');
    // the brother's three fields are on the other side of the boundary
    expectField(p.fields.dob, 'missing', null);
    expectField(p.fields.tob, 'missing', null);
    expectField(p.fields.pob, 'missing', null);
  });

  it('degrades every field it DID read, and says why', () => {
    const p = parseProfileText(TWO_PEOPLE);
    expect(p.fields.name.state).toBe('inferred');
    expect(p.fields.name.basis).toContain('more than one person');
    expect(p.fields.name.basis).toContain('Meera Iyer');
  });

  it('leaves a MISSING field missing rather than inventing a fourth state', () => {
    const p = parseProfileText(TWO_PEOPLE);
    for (const key of ['dob', 'tob', 'pob'] as const) {
      expect(p.fields[key].value).toBeNull();
      expect(p.fields[key].basis).toBeUndefined();
    }
  });

  it.each([
    ['a relation header on its own line', ['Name: A', 'Brother', 'DOB: 1990-01-01']],
    ['a relation header as a label', ['Name: A', "Father's Name: B", 'DOB: 1960-01-01']],
    ['a repeated label', ['Name: A', 'DOB: 1994-05-14', 'Name: B']],
    ['a name AFTER a date', ['DOB: 1994-05-14', 'Name: B', 'POB: Pune']],
    ['a family heading', ['Name: A', 'Family Details:', 'DOB: 1960-01-01']],
  ])('notices %s', (_label, lines) => {
    const p = parseProfileText(lines.join('\n'));
    const values = Object.values(p.fields).filter((f) => f.value !== null);
    expect(values.length).toBeGreaterThan(0);
    for (const field of values) {
      expect(field.state).toBe('inferred');
      expect(field.basis).toContain('more than one person');
    }
  });

  it('says nothing about a second person when there is only one', () => {
    const p = parseProfileText(
      ['Name: Meera Iyer', 'Date of Birth: 14 May 1994', 'Place of Birth: Pune'].join('\n'),
    );
    expectField(p.fields.name, 'stated', 'Meera Iyer');
    expectField(p.fields.dob, 'stated', '1994-05-14');
    expect(p.fields.name.basis).toBeUndefined();
  });

  it('reports the boundary it found, for a caller that wants to say so', () => {
    const { diagnostics } = parseProfileWithDiagnostics(TWO_PEOPLE);
    expect(diagnostics.multiPerson).toBe(true);
    expect(diagnostics.boundaryLine).toBe('Brother');
  });

  it('carries the SOURCE LINE of every value it read', () => {
    const p = parseProfileText(
      ['Name: Meera Iyer', 'Date of Birth: 14 May 1994', 'Time of Birth: 10:30 am'].join('\n'),
    );
    expect(p.fields.name.sourceLine).toBe('Name: Meera Iyer');
    expect(p.fields.dob.sourceLine).toBe('Date of Birth: 14 May 1994');
    expect(p.fields.tob.sourceLine).toBe('Time of Birth: 10:30 am');
    expect(p.fields.pob.sourceLine).toBeUndefined();
  });
});

describe('B2 round 2 — "Name of Father" is a PERSON, not a label', () => {
  /**
   * The residual hole the reviewer found: `Name of Father:` did not match the
   * `name` label, so it was skipped as unknown — and the FATHER's date, time
   * and place underneath were read as the candidate's, all three `stated`,
   * with `multiPerson: false`. Every part of that looked right.
   */
  const FATHER = [
    'Name: Meera Iyer',
    'Name of Father: Ramesh Iyer',
    'Date of Birth: 12/08/1962',
    'Time of Birth: 04:20 am',
    'Place of Birth: Madurai',
  ].join('\n');

  it("takes none of the father's birth rows", () => {
    const p = parseProfileText(FATHER);
    expect(p.fields.name.value).toBe('Meera Iyer');
    for (const key of ['dob', 'tob', 'pob'] as const) {
      expectField(p.fields[key], 'missing', null);
    }
  });

  it('says the text describes more than one person', () => {
    const p = parseProfileText(FATHER);
    expect(p.fields.name.state).toBe('inferred');
    expect(p.fields.name.basis).toContain('more than one person');
    expect(parseProfileWithDiagnostics(FATHER).diagnostics.boundaryLine).toBe(
      'Name of Father: Ramesh Iyer',
    );
  });

  it.each([
    "Father's Name: Ramesh Iyer",
    'Name of Mother: Latha Iyer',
    'Mother Name: Latha Iyer',
    'Name of the Brother: Rohan',
    "Sister's Name: Anaya",
    'Guardian Name: S Iyer',
    'Spouse Name: Someone',
    "Grandfather's Name: Venkat",
    'Father: Ramesh Iyer',
    'Brother: Rohan Iyer',
  ])('treats %p as another person', (row) => {
    const p = parseProfileText(['Name: Meera Iyer', row, 'Date of Birth: 12/08/1962'].join('\n'));
    expectField(p.fields.dob, 'missing', null);
    expect(p.fields.name.state).toBe('inferred');
  });
});

describe('B2 round 2 — an ATTRIBUTE of the family is not a record boundary', () => {
  /**
   * The regression this closes: `RELATION_HEADER` matched on a word boundary,
   * so every ordinary biodata row that mentions a relative — and they all do —
   * ended the record, and the candidate's own birth rows below it were
   * thrown away. Usability, not safety, but it made the paste path useless on
   * a real page.
   */
  const ATTRIBUTE_ROWS = [
    'Mother Tongue: Marathi',
    'Family Income: 12 LPA',
    'Family Type: Nuclear',
    'Family Status: Middle Class',
    'Family Values: Moderate',
    "Father's Occupation: Engineer",
    "Mother's Occupation: Homemaker",
    'Brothers: 1',
    'Sisters: 2',
    'No. of Brothers: 1',
    'No of Sisters: 0',
    'Family Details: Nuclear family from Pune',
  ];

  it.each(ATTRIBUTE_ROWS)('reads the candidate\'s own rows through %p', (row) => {
    const p = parseProfileText(
      [
        'Name: Meera Iyer',
        row,
        'Date of Birth: 14 May 1994',
        'Time of Birth: 10:30 am',
        'Place of Birth: Pune',
      ].join('\n'),
    );
    expectField(p.fields.name, 'stated', 'Meera Iyer');
    expectField(p.fields.dob, 'stated', '1994-05-14');
    expectField(p.fields.tob, 'stated', '10:30');
    expectField(p.fields.pob, 'stated', 'Pune');
  });

  it('reads a whole realistic biodata, attributes and all', () => {
    const p = parseProfileText(
      [
        'Name: Meera Iyer',
        'Date of Birth: 14 May 1994',
        'Time of Birth: 10:30 am',
        'Place of Birth: Pune',
        'Height: 5\'4"',
        'Mother Tongue: Marathi',
        'Family Type: Nuclear',
        "Father's Occupation: Engineer",
        'Brothers: 1',
        'Sisters: 2',
      ].join('\n'),
    );
    expectField(p.fields.dob, 'stated', '1994-05-14');
    expect(parseProfileWithDiagnostics(p ? 'Name: x' : '').diagnostics.multiPerson).toBe(false);
  });

  it('attribute rows under a family HEADING do not end the record by themselves', () => {
    // The heading is HELD, not acted on: `Family Type` and `Brothers` are
    // attributes and pass straight through, so everything read before the
    // heading is still the candidate's and still `stated`.
    const p = parseProfileText(
      [
        'Name: Meera Iyer',
        'Date of Birth: 14 May 1994',
        'Time of Birth: 10:30 am',
        'Family Details',
        'Family Type: Nuclear',
        'Brothers: 1',
      ].join('\n'),
    );
    expectField(p.fields.name, 'stated', 'Meera Iyer');
    expectField(p.fields.dob, 'stated', '1994-05-14');
    expectField(p.fields.tob, 'stated', '10:30');
  });

  it('a BIRTH row under a family heading is doubted, not claimed', () => {
    // "Family Details / Place of Birth: Pune" and "Family Details: / DOB:
    // 12/08/1962" have the same shape and different owners, so this resolves
    // the safe way: the row under the heading is not taken, and what was
    // read before it says a second person is in the text.
    const p = parseProfileText(
      ['Name: Meera Iyer', 'Family Details', 'Place of Birth: Pune'].join('\n'),
    );
    expectField(p.fields.pob, 'missing', null);
    expect(p.fields.name.state).toBe('inferred');
    expect(p.fields.name.basis).toContain('more than one person');
  });

  it('…but a heading FOLLOWED by another person\'s birth rows still is', () => {
    const p = parseProfileText(
      ['Name: Meera Iyer', 'Brother', 'Date of Birth: 02/01/1990'].join('\n'),
    );
    expectField(p.fields.dob, 'missing', null);
    expect(p.fields.name.state).toBe('inferred');
    expect(parseProfileWithDiagnostics(
      ['Name: Meera Iyer', 'Brother', 'Date of Birth: 02/01/1990'].join('\n'),
    ).diagnostics.boundaryLine).toBe('Brother');
  });
});

describe('B2 — captures that used to be lost', () => {
  it('reads a time with a trailing zone token', () => {
    expectField(readTime('10:30 PM IST'), 'stated', '22:30');
    expectField(readTime('06:15 am IST'), 'stated', '06:15');
    expectField(readTime('22:30 hrs'), 'stated', '22:30');
  });

  it('reads Devanagari numerals and month names', () => {
    expectField(readDate('१४ मई १९९४'), 'stated', '1994-05-14');
    expectField(readDate('०२ जनवरी १९९०'), 'stated', '1990-01-02');
    expectField(readDate('१९९४-०५-१४'), 'stated', '1994-05-14');
    expectField(readTime('१०:३०'), 'inferred', '10:30');
  });

  it('reads a date with an age in brackets after it', () => {
    expectField(readDate('14 May 1994 (31 yrs)'), 'stated', '1994-05-14');
    expectField(readDate('1994-05-14 (aged 31)'), 'stated', '1994-05-14');
  });

  it('spells an ISO date in words, for a screen that cannot trust a locale', () => {
    expect(spell('1989-04-03')).toBe('3 April 1989');
    expect(spell('1989-03-04')).toBe('4 March 1989');
    expect(spell('not-a-date')).toBe('');
  });

  it('offers BOTH readings of an ambiguous date as alternatives', () => {
    const c = readDate('03/04/1989');
    expect(c.alternatives).toEqual(['1989-04-03', '1989-03-04']);
  });
});

describe('the module cannot reach the network or the browser', () => {
  // The row's grep, run in CI instead of by hand. Comments legitimately
  // discuss `fetch` and `chrome`, so strip them first — a comment explaining
  // the rule must not trip the rule.
  const src = readFileSync(join(__dirname, '..', 'parse-profile.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('contains no fetch, no XMLHttpRequest and no chrome.*', () => {
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/XMLHttpRequest/);
    expect(src).not.toMatch(/\bchrome\./);
    expect(src).not.toMatch(/sendMessage/);
  });

  it('imports only its own types', () => {
    const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    expect(imports).toEqual(['./confirmed']);
  });

  it('reads no clock — a birth date is not "today"', () => {
    expect(src).not.toMatch(/Date\.now|new Date\(\)/);
  });
});

describe('the function is total', () => {
  // A parser that throws on a shape nobody thought of takes the whole panel
  // down with it, which is a worse failure than a `missing` field.
  const NASTY: unknown[] = [
    '', ' ', '\n\n\n', ':', '::::', 'a'.repeat(5000),
    'Name: ' + 'x'.repeat(4000),
    'DOB: 99999999999999999999',
    'Time of Birth: ::::',
    ' ',
    'Name:\tRiya\nDOB:\t1994-05-14',
    'name : lower case label : with colons',
    null, undefined, 42, {}, [],
  ];
  it.each(NASTY.map((v, i) => [i, v]))('case %i does not throw', (_i, value) => {
    expect(() => parseProfileText(value as string)).not.toThrow();
    const p = parseProfileText(value as string);
    for (const key of ['name', 'dob', 'tob', 'pob'] as const) {
      expect(['stated', 'inferred', 'missing']).toContain(p.fields[key].state);
    }
  });

  it('never returns a value on a MISSING field, and always a basis on an INFERRED one', () => {
    const samples = [
      'Name: A\nDOB: 03/04/1989\nTime of Birth: 7:30\nLocation: Pune',
      'DOB: not known',
      'Place of Birth: Kochi',
    ];
    for (const text of samples) {
      const p = parseProfileText(text);
      for (const key of ['name', 'dob', 'tob', 'pob'] as const) {
        const f = p.fields[key];
        if (f.state === 'missing') {
          expect(f.value).toBeNull();
          expect(f.basis).toBeUndefined();
        }
        if (f.state === 'inferred') expect(typeof f.basis).toBe('string');
        if (f.state === 'stated') {
          expect(typeof f.value).toBe('string');
          expect(f.basis).toBeUndefined();
        }
      }
    }
  });
});
