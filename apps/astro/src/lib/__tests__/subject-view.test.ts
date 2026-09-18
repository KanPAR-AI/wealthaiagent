import {
  SELF_SUBJECT, TURN_ADHOC, TURN_SELF, chipLabel, parseSubjectBlock,
  subjectSheet, subjectStore, turnForPerson,
} from '../subject-view';

describe('the sentences the chip sends (pinned to the engine cues)', () => {
  it('are the exact strings chatservice/…/subject.py parses', () => {
    expect(TURN_SELF).toBe('Read for me.');
    expect(TURN_ADHOC).toBe('Just this reading.');
    expect(turnForPerson('Rohan')).toBe("Let's talk about Rohan.");
  });
  it('name intents and no values (ASTRAL-83)', () => {
    for (const t of [TURN_SELF, TURN_ADHOC, turnForPerson('Rohan')]) {
      expect(t).not.toMatch(/person_id|slot|dob|reading_subject/i);
    }
  });
});

describe('the engine block → the chip', () => {
  it('renders exactly what the engine says', () => {
    expect(parseSubjectBlock({ type: 'reading_subject', mode: 'person',
      person_id: 'p_1', name: 'Rohan', label: 'Rohan' }))
      .toEqual({ mode: 'person', person_id: 'p_1', name: 'Rohan', label: 'Rohan' });
    expect(parseSubjectBlock({ type: 'reading_subject', mode: 'adhoc' })?.label)
      .toBe('Just this reading');
    expect(parseSubjectBlock({ type: 'reading_subject' })).toEqual(SELF_SUBJECT);
  });
  it('rejects anything that is not the block', () => {
    expect(parseSubjectBlock(null)).toBeNull();
    expect(parseSubjectBlock({ type: 'input_request' })).toBeNull();
  });
  it('labels', () => {
    expect(chipLabel(null)).toBe('Reading for You');
    expect(chipLabel({ mode: 'person', person_id: 'p', name: 'Rohan', label: 'Rohan' }))
      .toBe('Reading for Rohan');
  });
});

describe('the sheet', () => {
  it('lists You, each person, then someone-new — with their sentences', () => {
    const rows = subjectSheet([
      { id: 'self', display_name: 'Ravi' },
      { id: 'p_1', display_name: 'Rohan' },
      { id: 'p_2', display_name: '  ' },
    ]);
    expect(rows.map((r) => r.label)).toEqual(['You', 'Rohan', 'Someone new / just this reading']);
    expect(rows[1].turn).toBe("Let's talk about Rohan.");
    expect(rows[2].turn).toBe(TURN_ADHOC);
  });
});

describe('the store', () => {
  it('notifies, resets to self, and never holds null', () => {
    const seen: string[] = [];
    const off = subjectStore.subscribe((s) => seen.push(s.label));
    subjectStore.set({ mode: 'person', person_id: 'p', name: 'Rohan', label: 'Rohan' });
    subjectStore.set(null);
    subjectStore.reset();
    off();
    expect(seen).toEqual(['Rohan', 'You', 'You']);
    expect(subjectStore.get()).toEqual(SELF_SUBJECT);
  });
});


describe('the sheet: "Someone new" starts a fresh chat (owner 2026-09-17)', () => {
  it('flags only the adhoc row as fresh', () => {
    const rows = subjectSheet([{ id: 'p1', display_name: 'Meera' }]);
    expect(rows.map((r) => r.fresh)).toEqual([false, false, true]);
    expect(rows[rows.length - 1].turn).toBe('Just this reading.');
  });
});

describe('only the engine\'s word makes a chat the user\'s own (docs/67 follow-up)', () => {
  // Palm and Muhurta adopt the user's OWN chat. They used to adopt the last
  // chat, which after a friend's sealed reading is the friend's — and the
  // engine answered with that chat's pending ask.
  const { isOwnChat } = require('../chat-session');
  it('a reset is a default, not a statement', () => {
    subjectStore.reset();
    expect(subjectStore.engineSaid()).toBe(false);
  });
  it('a reading_subject block is the engine speaking', () => {
    subjectStore.set({ mode: 'self', person_id: null, name: null, label: 'You' }, true);
    expect(subjectStore.engineSaid()).toBe(true);
    subjectStore.reset();
  });
  it('self, said by the engine, unsealed — own', () => {
    expect(isOwnChat('self', true, false)).toBe(true);
  });
  it.each([
    ['adhoc', true, false], ['person', true, false],
    ['self', false, false], ['self', true, true],
  ])('%s / engineSaid=%s / sealed=%s — never own', (mode, said, sealed) => {
    expect(isOwnChat(mode as string, said as boolean, sealed as boolean)).toBe(false);
  });
});

