/**
 * docs/71 PH-34 — reading for a GROUP, on the client (ASTRAL-290).
 *
 * EVERY FIXTURE HERE WAS CAPTURED FROM THE RUNNING ENGINE
 * (`fixtures/group_sheet.json`): the people are the real `GET /people` wire
 * shape produced by `services/people/views.person_view` over a real store,
 * and `engine_parse` is what `family_members.group_cue` and
 * `subject.subject_cue` ACTUALLY RETURN for each sentence.
 *
 * That last part is the load-bearing one. PH-33's review (docs/71 §8)
 * caught a client test that asserted a derived value against itself and
 * stayed green on a broken renderer. So the sentences this module builds
 * are compared to the ENGINE'S OWN STRINGS, and the assertion that they are
 * group sentences is read off the ENGINE'S OWN PARSE — never off anything
 * this module computed.
 */

import fs from 'fs';
import path from 'path';

import {
  MEMBER_CAP,
  TURN_WHOLE_FAMILY,
  canSelectMore,
  isGroup,
  partnerOf,
  pickable,
  subjectSheetWithGroups,
  turnForGroup,
  turnForSelection,
  type SheetPerson,
} from '../group-view';
import { TURN_ADHOC, TURN_SELF, turnForPerson } from '../subject-view';

const FIXTURE = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures/group_sheet.json'), 'utf8'),
) as {
  people: Array<SheetPerson & { relation?: string }>;
  sentences: Record<string, string>;
  engine_parse: Record<string, { group_cue: unknown[] | null; subject_cue: unknown[] | null }>;
  member_cap: number;
};

const PEOPLE = FIXTURE.people as SheetPerson[];

describe('the fixture is the engine, not an imagination', () => {
  it('carries the five relatives plus self, from the real wire shape', () => {
    expect(PEOPLE.length).toBe(6);
    expect(PEOPLE.some((p) => p.id === 'self')).toBe(true);
    expect(pickable(PEOPLE).map((p) => p.display_name).sort()).toEqual(
      ['Anjali', 'Dev', 'Kiran', 'Meera', 'Rohan'],
    );
  });

  it('the engine derived the partner, and this module does not guess one', () => {
    expect(partnerOf(pickable(PEOPLE))?.display_name).toBe('Anjali');
    // …and it is read off `kinship`, which the ENGINE set — not off a
    // relation, a position, or a name.
    const anjali = PEOPLE.find((p) => p.display_name === 'Anjali')!;
    expect(anjali.kinship).toBe('partner');
  });

  it('a person with no kinship is still pickable (AMB-64(a))', () => {
    const kiran = PEOPLE.find((p) => p.display_name === 'Kiran')!;
    expect(kiran.kinship ?? null).toBeNull();
    expect(pickable(PEOPLE).some((p) => p.id === kiran.id)).toBe(true);
  });
});

describe('the sentences ARE the engine cues', () => {
  it('the whole-family sentence is byte-identical to the engine string', () => {
    expect(TURN_WHOLE_FAMILY).toBe(FIXTURE.sentences.whole_family);
  });

  it('the me-and-partner sentence is byte-identical', () => {
    expect(turnForGroup(['Anjali'], true)).toBe(FIXTURE.sentences.partner_pair);
  });

  it('a two-name pick is byte-identical', () => {
    expect(turnForGroup(['Anjali', 'Rohan'])).toBe(FIXTURE.sentences.pick_two);
  });

  it('a three-name pick with me is byte-identical', () => {
    expect(turnForGroup(['Anjali', 'Rohan', 'Meera'], true)).toBe(
      FIXTURE.sentences.pick_three_with_me,
    );
  });

  it('the engine parses each of them as a GROUP — read off its own parse', () => {
    for (const key of ['partner_pair', 'whole_family', 'pick_two', 'pick_three_with_me']) {
      expect(FIXTURE.engine_parse[key].group_cue).not.toBeNull();
      expect(FIXTURE.engine_parse[key].subject_cue).toBeNull();
    }
  });

  it('and ONE person is NOT a group — it stays the shipped subject switch', () => {
    // The engine's own parse, quoted: "Read for Anjali." earns a PERSON
    // subject cue and no group cue. So the client must never send it as a
    // group sentence, and `isGroup` is what stops it.
    expect(FIXTURE.engine_parse.one_person_is_not_a_group.group_cue).toBeNull();
    expect(FIXTURE.engine_parse.one_person_is_not_a_group.subject_cue).toEqual([
      'person', 'Anjali',
    ]);
    expect(isGroup(['Anjali'])).toBe(false);
    expect(isGroup(['Anjali'], true)).toBe(true);
    expect(isGroup(['Anjali', 'Rohan'])).toBe(true);
    expect(isGroup([])).toBe(false);
  });

  it('the shipped subject sentences are untouched', () => {
    expect(TURN_SELF).toBe(FIXTURE.sentences.self);
    expect(TURN_ADHOC).toBe(FIXTURE.sentences.adhoc);
    expect(turnForPerson('Anjali')).toBe(FIXTURE.sentences.person);
  });
});

describe('the sheet', () => {
  const rows = subjectSheetWithGroups(PEOPLE);

  it('keeps the shipped rows first, in order', () => {
    expect(rows[0]).toEqual({ kind: 'you', label: 'You', turn: TURN_SELF, fresh: false });
    // The person rows are the WIRE's own people, in the WIRE's own order —
    // compared to the fixture's raw `display_name` list rather than to
    // anything this module produced.
    expect(rows.filter((r) => r.kind === 'person').map((r) => r.label)).toEqual(
      FIXTURE.people
        .filter((p) => p.id !== 'self')
        .map((p) => p.display_name),
    );
    expect(rows.slice(1, 6).every((r) => r.kind === 'person')).toBe(true);
    expect(rows[rows.length - 1].kind).toBe('adhoc');
  });

  it('gains exactly the three group rows the owner asked for', () => {
    expect(rows.filter((r) => r.kind === 'partner_pair').map((r) => r.label))
      .toEqual(['Me and Anjali']);
    expect(rows.filter((r) => r.kind === 'whole_family').map((r) => r.label))
      .toEqual(['The whole family']);
    expect(rows.filter((r) => r.kind === 'pick').map((r) => r.label))
      .toEqual(['Pick people…']);
  });

  it('every group row sends a sentence the ENGINE parses as a group', () => {
    const groupSentences = new Set(
      Object.entries(FIXTURE.engine_parse)
        .filter(([, v]) => v.group_cue !== null)
        .map(([k]) => FIXTURE.sentences[k]),
    );
    for (const r of rows) {
      if (r.kind === 'partner_pair' || r.kind === 'whole_family') {
        expect(groupSentences.has(r.turn)).toBe(true);
      }
    }
  });

  it('a scope change starts a NEW reading', () => {
    for (const r of rows) {
      if (r.kind === 'partner_pair' || r.kind === 'whole_family' || r.kind === 'pick') {
        expect(r.fresh).toBe(true);
      }
    }
    // …and choosing one person does not, because that is the shipped
    // in-place subject switch.
    expect(rows.find((r) => r.kind === 'person')!.fresh).toBe(false);
    expect(rows[0].fresh).toBe(false);
  });

  it('no row carries a person id in its sentence', () => {
    for (const r of rows) {
      for (const p of PEOPLE) {
        if (p.id === 'self') continue;
        expect(r.turn).not.toContain(p.id);
      }
    }
  });

  it('the pair row is absent when the engine named no partner', () => {
    const noPartner = pickable(PEOPLE).map((p) => ({ ...p, kinship: null }));
    const out = subjectSheetWithGroups(noPartner);
    expect(out.some((r) => r.kind === 'partner_pair')).toBe(false);
    // …absent, not disabled and not a placeholder (doctrine 8).
    expect(out.some((r) => r.label.includes('Me and'))).toBe(false);
  });

  it('the group rows are absent with fewer than two people', () => {
    const one = [PEOPLE.find((p) => p.display_name === 'Kiran')!];
    const out = subjectSheetWithGroups(one);
    expect(out.map((r) => r.kind)).toEqual(['you', 'person', 'adhoc']);
  });

  it('an empty list is the shipped two-row sheet', () => {
    expect(subjectSheetWithGroups([]).map((r) => r.kind)).toEqual(['you', 'adhoc']);
  });
});

describe('the picker', () => {
  it('sends the names of the ticked people, in list order', () => {
    const ids = pickable(PEOPLE)
      .filter((p) => ['Rohan', 'Anjali'].includes(p.display_name))
      .map((p) => p.id);
    expect(turnForSelection(PEOPLE, ids, false)).toBe(FIXTURE.sentences.pick_two);
  });

  it('sends nothing when the selection is not a group', () => {
    const one = [pickable(PEOPLE)[0].id];
    expect(turnForSelection(PEOPLE, one, false)).toBe('');
    // …but one person plus ME is a group.
    expect(turnForSelection(PEOPLE, one, true)).toBe(FIXTURE.sentences.partner_pair);
  });

  it('ignores an id that is not this list', () => {
    expect(turnForSelection(PEOPLE, ['p_stranger', 'p_other'], false)).toBe('');
  });

  it('honours the engine cap so the sheet cannot promise a sixth person', () => {
    expect(MEMBER_CAP).toBe(FIXTURE.member_cap);
    expect(canSelectMore(['a', 'b', 'c', 'd'])).toBe(true);
    expect(canSelectMore(['a', 'b', 'c', 'd', 'e'])).toBe(false);
  });
});

describe('what this module may not contain', () => {
  const src = fs.readFileSync(path.join(__dirname, '../group-view.ts'), 'utf8');
  // The doctrine's recurring trap: a grep that matches the comment saying
  // the code does not do the thing. Comments are stripped first.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');

  it('imports nothing from react, react-native or expo', () => {
    expect(code).not.toMatch(/from '(react|react-native|expo)/);
  });

  it('keeps no member set and no allowance of its own', () => {
    expect(code).not.toMatch(/useState|AsyncStorage|localStorage/);
    expect(code).not.toMatch(/questions_per_week|allowance|remaining/);
  });

  it('reads no clock', () => {
    expect(code).not.toMatch(/new Date|Date\.now/);
  });
});
