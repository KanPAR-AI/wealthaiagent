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
