/**
 * docs/73 ASTRAL-339 — the shortlist is a VIEW of the People store.
 *
 * The fixture is `GET /people/matches` CAPTURED FROM THE RUNNING ENGINE
 * (`e2e/capture-matches.mjs`, 2026-09-19): three groups, five rows, including
 * a firm-only row minted by a time-less reading and a refused row. A
 * hand-written fixture would prove this client parses what somebody imagined.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { matchStaleSentence } from '@wealthai/astral';

import {
  SHORTLIST_EMPTY_NOTE,
  freshnessSentence,
  readShortlist,
  rowsWithGroup,
  scoreView,
  type MatchesWire,
} from '../shortlist-view';

const FIXTURES = join(__dirname, 'fixtures');
const WIRE: MatchesWire = JSON.parse(
  readFileSync(join(FIXTURES, 'matches-groups.json'), 'utf8'),
);

const read = () => readShortlist(200, WIRE);

describe('the fixture is the engine\'s own answer', () => {
  it('has the three groups, with rows in more than one of them', () => {
    // anti-vacuity: every assertion below is about keeping groups apart, and
    // a fixture with one group would make them all pass while proving
    // nothing.
    expect(WIRE.groups.map((g) => g.key)).toEqual(['complete', 'firm_only', 'refused']);
    expect(WIRE.groups.filter((g) => g.rows.length > 0).length).toBeGreaterThan(2);
  });

  it('carries a firm-only row and a refused row, which is what makes it useful', () => {
    const firm = WIRE.groups.find((g) => g.key === 'firm_only');
    expect(firm?.rows[0]?.score?.firm_points).not.toBeUndefined();
    expect(firm?.rows[0]?.score?.points).toBeUndefined();
    const refused = WIRE.groups.find((g) => g.key === 'refused');
    expect(refused?.rows[0]?.refusal?.reason).toBeTruthy();
    expect(refused?.rows[0]?.score).toBeUndefined();
  });
});

describe('the groups arrive labelled, ruled and IN ORDER', () => {
  it('keeps the engine\'s order and the engine\'s labels, verbatim', () => {
    const outcome = read();
    if (outcome.kind !== 'groups') throw new Error(outcome.kind);
    expect(outcome.groups.map((g) => g.key)).toEqual(WIRE.groups.map((g) => g.key));
    expect(outcome.groups.map((g) => g.label)).toEqual(WIRE.groups.map((g) => g.label));
  });

  it('prints the SORT RULE the engine applied, so the ordering is falsifiable', () => {
    const outcome = read();
    if (outcome.kind !== 'groups') throw new Error(outcome.kind);
    for (const [at, group] of outcome.groups.entries()) {
      expect(group.rule).toBe(WIRE.groups[at].sort_rule);
      expect(group.rule.length).toBeGreaterThan(10);
    }
    // the refused group's own rule says it is NOT ranked
    const refused = outcome.groups.find((g) => g.key === 'refused');
    expect(refused?.rule.toLowerCase()).toContain('not ranked');
  });

  it('keeps the rows in the order the engine sent them — this client sorts nothing', () => {
    const outcome = read();
    if (outcome.kind !== 'groups') throw new Error(outcome.kind);
    for (const [at, group] of outcome.groups.entries()) {
      expect(group.rows.map((r) => r.pairKey)).toEqual(
        WIRE.groups[at].rows.map((r) => r.pair_key),
      );
    }
  });

  it('never orders ACROSS the groups, and gives no row an ordinal', () => {
    const outcome = read();
    if (outcome.kind !== 'groups') throw new Error(outcome.kind);
    const flat = rowsWithGroup(outcome.groups);
    // every row still knows which group it is in — a flat list of rows with
    // the group dropped is the shape an ordering is written against (F47)
    for (const { group, row } of flat) {
      expect(group.key).toBeTruthy();
      expect(Object.keys(row)).not.toContain('rank');
      expect(Object.keys(row)).not.toContain('ordinal');
      expect(Object.keys(row)).not.toContain('position');
    }
    // and the flattening preserves group order rather than re-ordering
    expect(flat.map(({ group }) => group.key)).toEqual(
      outcome.groups.flatMap((g) => g.rows.map(() => g.key)),
    );
  });
});

describe('the numbers are the engine\'s, concatenated and never divided', () => {
  it('shows a complete match out of its own maximum', () => {
    const outcome = read();
    if (outcome.kind !== 'groups') throw new Error(outcome.kind);
    const row = outcome.groups[0].rows[0];
    const wire = WIRE.groups[0].rows[0];
    expect(row.score?.text).toBe(`${wire.score?.points} / ${wire.score?.out_of}`);
    expect(row.score?.scale).toBe('');
  });

  it('shows a firm-only match out of FIFTEEN, with the pending count, never out of 36', () => {
    const outcome = read();
    if (outcome.kind !== 'groups') throw new Error(outcome.kind);
    const group = outcome.groups.find((g) => g.key === 'firm_only');
    const row = group?.rows[0];
    const wire = WIRE.groups.find((g) => g.key === 'firm_only')?.rows[0];
    expect(row?.score?.text).toBe(`${wire?.score?.firm_points} / ${wire?.score?.out_of}`);
    expect(row?.score?.text).not.toContain('36');
    expect(row?.score?.scale).toContain(`${wire?.score?.pending} more gunas need a birth time`);
  });

  it('renders no percentage for any row, on any scale', () => {
    const outcome = read();
    if (outcome.kind !== 'groups') throw new Error(outcome.kind);
    const printed = JSON.stringify(outcome);
    expect(printed).not.toContain('%');
  });

  it('a firm-only score is not readable as a complete one — the shapes differ', () => {
    expect(scoreView({ points: 26, out_of: 36 })?.text).toBe('26 / 36');
    expect(scoreView({ firm_points: 9.5, out_of: 15, pending: 21 })?.scale).toContain('21');
    // and a score the engine did not send is not invented
    expect(scoreView(null)).toBeNull();
    expect(scoreView({})).toBeNull();
  });
});

describe('a refusal is a first-class row (ASTRAL-144)', () => {
  it('carries the engine\'s reason and the ask, and no score at all', () => {
    const outcome = read();
    if (outcome.kind !== 'groups') throw new Error(outcome.kind);
    const row = outcome.groups.find((g) => g.key === 'refused')?.rows[0];
    expect(row?.score).toBeNull();
    expect(row?.refusal?.reason).toContain('score');
    expect(row?.refusal?.ask).toBeTruthy();
    // never a zero, and never an omission
    expect(row?.verdict).toBeNull();
    expect(row?.name).toBeTruthy();
  });

  it('says so even when the record kept no reason, instead of looking unscored', () => {
    const outcome = readShortlist(200, {
      total: 1,
      groups: [
        {
          key: 'refused',
          label: 'Not scored',
          sort_rule: 'Not scored, so not ranked.',
          rows: [
            {
              pair_key: 'p_x__self',
              person_id: 'p_x',
              display_name: 'Someone',
              favourite: false,
              relation: 'match',
              tob_known: false,
              freshness: 'fresh',
              refusal: {},
            },
          ],
        },
      ],
    });
    if (outcome.kind !== 'groups') throw new Error(outcome.kind);
    expect(outcome.groups[0].rows[0].refusal?.reason).toContain('does not say why');
  });
});

describe('staleness names NO CAUSE, and says when it was scored (FLAG-2)', () => {
  /**
   * The false sentence this replaces: "A birth detail has changed since this
   * was scored…". The wire carries `fresh | stale | unprovable` and nothing
   * else — it is a STAMP comparison, and the stamp covers the function
   * version and the calculation settings as well as the inputs. Gun milan is
   * at v4, so every match on the account this fixture came from is stale with
   * nobody's details touched. ASTRAL-238 exists because that blame was once
   * said falsely on the chart surfaces.
   */
  const stale = (over: Record<string, unknown> = {}) =>
    freshnessSentence({
      freshness: 'stale',
      computed_at: '2026-08-24T17:44:41.474626+00:00',
      score: { points: 26, out_of: 36 },
      ...over,
    } as never) as string;

  it('blames nobody, and names the date instead', () => {
    const sentence = stale();
    expect(sentence).toContain('24 Aug 2026');
    expect(sentence).toContain('may be out of date');
    for (const blame of [
      'birth detail',
      'birth fact',
      'you changed',
      'your details',
      'settings',
      'engine',
    ]) {
      expect(sentence.toLowerCase()).not.toContain(blame);
    }
  });

  it('never claims a REFUSED row has numbers — it has none', () => {
    // Found by looking at the walk's own screenshot: the refused row carried
    // a sentence about "these numbers" under a sentence saying it could not
    // be scored.
    const refused = stale({ score: undefined, refusal: { reason: 'x' } });
    expect(refused).not.toContain('numbers');
    expect(refused).toContain('may be out of date');
  });

  it('says nothing at all when the record is fresh', () => {
    expect(freshnessSentence({ freshness: 'fresh' } as never)).toBeNull();
  });

  it('names the unprovable case as its own fact, not as a change', () => {
    const sentence = freshnessSentence({
      freshness: 'unprovable',
      computed_at: '2026-08-24T17:44:41Z',
      score: { points: 26, out_of: 36 },
    } as never) as string;
    expect(sentence).toContain('before we recorded');
    expect(sentence).not.toContain('has moved since');
  });

  it('is the SHARED sentence, so the app and the extension cannot drift', () => {
    expect(stale()).toBe(
      matchStaleSentence({
        freshness: 'stale',
        computedAt: '2026-08-24T17:44:41.474626+00:00',
        scored: true,
      }),
    );
  });

  it('the captured fixture really exercises it, so this is not theory', () => {
    const outcome = read();
    if (outcome.kind !== 'groups') throw new Error(outcome.kind);
    const states = new Set(WIRE.groups.flatMap((g) => g.rows.map((r) => r.freshness)));
    expect(states.has('fresh')).toBe(true);
    expect(states.size).toBeGreaterThan(1);
    const said = outcome.groups
      .flatMap((g) => g.rows)
      .map((r) => r.freshness)
      .filter((f): f is string => Boolean(f));
    expect(said.length).toBeGreaterThan(0);
    for (const sentence of said) {
      expect(sentence.toLowerCase()).not.toContain('birth detail');
    }
  });
});

describe('the states that are not a list', () => {
  it('an account with no matches gets a sentence, not an empty screen', () => {
    const outcome = readShortlist(200, { groups: [], total: 0 });
    expect(outcome).toEqual({ kind: 'empty', note: SHORTLIST_EMPTY_NOTE });
    expect(SHORTLIST_EMPTY_NOTE).toContain('Add to my matches');
  });

  it('a 401 is a sign-in, not a failure to retry', () => {
    expect(readShortlist(401, null).kind).toBe('signed-out');
    expect(readShortlist(403, null).kind).toBe('signed-out');
  });

  it('a body of the wrong shape FAILS rather than rendering as "no matches"', () => {
    // The most alarming lie this screen could tell is an empty list.
    expect(readShortlist(200, { nonsense: true }).kind).toBe('failed');
    expect(readShortlist(200, null).kind).toBe('failed');
    expect(readShortlist(500, { error: { message: 'boom' } })).toEqual({
      kind: 'failed',
      note: 'boom',
    });
  });
});

describe('nothing here is stored, ordered or re-scored', () => {
  const code = readFileSync(join(__dirname, '..', 'shortlist-view.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('the module sorts nothing', () => {
    expect(code).not.toContain('.sort(');
    expect(code).not.toContain('.reverse(');
    expect(code).not.toContain('Math.max');
    expect(code).not.toContain('Math.min');
  });

  it('the module persists nothing', () => {
    expect(code).not.toContain('chrome.storage');
    expect(code).not.toContain('localStorage');
    expect(code).not.toContain('indexedDB');
  });

  it('the module computes no score', () => {
    expect(code).not.toContain('toFixed');
    expect(code).not.toMatch(/\/\s*36\b/);
    expect(code).not.toMatch(/[*/]\s*100\b/);
    // the only number-to-text in here is the shared package's
    expect(code).toContain('formatFraction');
  });

  it('the greps would actually catch one', () => {
    const sample = 'rows.sort((a, b) => b.score.points - a.score.points);';
    expect(sample).toContain('.sort(');
  });
});
