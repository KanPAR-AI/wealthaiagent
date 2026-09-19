/**
 * docs/73 ASTRAL-340 — compare is stored reads side by side, and it computes
 * nothing.
 *
 * FIVE COLUMNS, all captured from the running engine
 * (`e2e/capture-matches.mjs`, 2026-09-19): three complete `/36` scorecards,
 * one firm-only `/15` from a time-less reading, and one REFUSED match. The
 * refused record cannot be minted from the product — `_persist_saved_match`
 * says so in its own comment — so it was seeded through the store's own
 * writer with the engine's own refusal text and then SERVED by the real
 * route; the fixture is what `GET /people/matches/{pair_key}` returned.
 *
 * The row's negative space is the subject of half the cases below: no rank,
 * no winner, no composite, no percentage, no subset sum, no column dropped
 * for being unscored, no number recomputed to make a column comparable.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  FULL_NOTE,
  MAX_COMPARE,
  ORDER_NOTE,
  TIME_DEPENDENT_NOTE,
  columnFor,
  compareRows,
  mixedTimeKnowledge,
  readColumn,
  togglePick,
  type ComparePick,
  type MatchDetailWire,
} from '../compare-view';

const FIXTURES = join(__dirname, 'fixtures');
const DETAILS: Record<string, MatchDetailWire> = JSON.parse(
  readFileSync(join(FIXTURES, 'match-details.json'), 'utf8'),
);

const SCALES: Record<string, string> = {
  complete: 'Scored out of 36',
  firm_only: 'Partly scored — 21 of the 36 gunas need a birth time',
  refused: 'Not scored — a birth time is missing on one side',
};

/** Every captured detail, as a column, in the fixture's own order. */
const COLUMNS = Object.values(DETAILS).map((detail) =>
  columnFor(detail, {
    pairKey: detail.pair_key,
    name: detail.display_name,
    // the engine's own group label, which the LIST view carries
    scale: SCALES[String(detail.group)] ?? '',
  }),
);

const firmOnly = () => COLUMNS.find((c) => c.firm !== null);
const refused = () => COLUMNS.find((c) => c.refusal !== null);
const complete = () => COLUMNS.find((c) => c.total !== null);

describe('the fixtures are the five the row asks for', () => {
  it('has five columns, including one firm-only and one refused', () => {
    // anti-vacuity: the assertions below are about mixing scales, and a set
    // of five complete scorecards would make most of them pass vacuously.
    expect(COLUMNS).toHaveLength(5);
    expect(firmOnly()).toBeDefined();
    expect(refused()).toBeDefined();
    expect(complete()).toBeDefined();
  });

  it('they came off the engine, not out of somebody\'s head', () => {
    for (const detail of Object.values(DETAILS)) {
      expect(detail.pair_key).toMatch(/__self$/);
      expect(detail.computed_at).toBeTruthy();
      expect(detail.group).toBeTruthy();
    }
  });
});

describe('a column is a stored read, and nothing is computed to build it', () => {
  it('a complete match keeps its own total and its own verdict word', () => {
    const column = complete() as NonNullable<ReturnType<typeof complete>>;
    const wire = DETAILS[column.pairKey].report as { total: number; max_total: number; verdict: string };
    expect(column.total).toBe(`${wire.total} / ${wire.max_total}`);
    expect(column.verdict).toBe(wire.verdict);
    expect(column.firm).toBeNull();
  });

  it('a FIRM-ONLY match has no /36 of any kind, and says what is pending', () => {
    const column = firmOnly() as NonNullable<ReturnType<typeof firmOnly>>;
    const wire = DETAILS[column.pairKey].report as {
      firm_total: number;
      firm_max: number;
      pending_max: number;
      verdict: string;
    };
    expect(column.total).toBeNull();
    expect(column.firm?.text).toBe(`${wire.firm_total} / ${wire.firm_max}`);
    expect(column.firm?.pending).toBe(String(wire.pending_max));
    expect(JSON.stringify(column)).not.toContain('/ 36');
    // `incomplete` is a STATE, and it is the engine's own word
    expect(column.verdict).toBe(wire.verdict);
  });

  it('a REFUSED match keeps its column, with its reason and NO numbers', () => {
    const column = refused() as NonNullable<ReturnType<typeof refused>>;
    expect(column.total).toBeNull();
    expect(column.firm).toBeNull();
    expect(column.verdict).toBeNull();
    expect(column.rows).toEqual([]);
    expect(column.refusal?.reason).toContain('score');
    // …and it is NOT dropped for being unscored
    expect(COLUMNS.map((c) => c.pairKey)).toContain(column.pairKey);
  });

  it('carries no percentage anywhere, on any column', () => {
    expect(JSON.stringify(COLUMNS)).not.toContain('%');
  });
});

describe('the table: every time-dependent row marked, every pending cell pending', () => {
  const rows = compareRows(COLUMNS);

  it('has one row per koota, in the ENGINE\'s order and not in a sorted one', () => {
    const first = complete() as NonNullable<ReturnType<typeof complete>>;
    expect(rows.map((r) => r.name).slice(0, first.rows.length)).toEqual(
      first.rows.map((r) => r.name),
    );
    // not alphabetical, which is what a client-side sort would produce
    expect(rows.map((r) => r.name)).not.toEqual([...rows.map((r) => r.name)].sort());
  });

  it('marks the time-dependent rows from the engine\'s own flag', () => {
    const marked = rows.filter((r) => r.timeDependent).map((r) => r.name);
    const fromEngine = (complete() as NonNullable<ReturnType<typeof complete>>).rows
      .filter((r) => r.timeDependent)
      .map((r) => r.name);
    expect(marked).toEqual(fromEngine);
    expect(marked.length).toBeGreaterThan(0);
  });

  it('a koota the firm-only match could not score is PENDING, never a zero', () => {
    const column = firmOnly() as NonNullable<ReturnType<typeof firmOnly>>;
    const at = COLUMNS.indexOf(column);
    const pendingRows = rows.filter((row) => row.cells[at].pending);
    expect(pendingRows.length).toBeGreaterThan(0);
    for (const row of pendingRows) {
      expect(row.cells[at].text).toBeNull();
      expect(row.cells[at].absent).toBe(false);
      // every koota this match could not score needs a birth time
      expect(row.timeDependent).toBe(true);
    }
  });

  it('the refused column is ABSENT in every row rather than zero in every row', () => {
    const at = COLUMNS.indexOf(refused() as NonNullable<ReturnType<typeof refused>>);
    for (const row of rows) {
      expect(row.cells[at]).toEqual({ text: null, pending: false, absent: true });
    }
  });

  it('notices that this set mixes a scored row with a pending one, and says so', () => {
    expect(mixedTimeKnowledge(rows)).toBe(true);
    expect(TIME_DEPENDENT_NOTE).toContain('not comparable');
    expect(TIME_DEPENDENT_NOTE).toContain('never as a zero');
  });

  it('says nothing about mixed knowledge when there is none', () => {
    const onlyComplete = COLUMNS.filter((c) => c.total !== null);
    expect(mixedTimeKnowledge(compareRows(onlyComplete))).toBe(false);
  });

  it('never sums two kootas, and never sums a column (F47)', () => {
    for (const row of rows) {
      for (const cell of row.cells) {
        // a cell is one koota's own fraction, verbatim, or nothing
        if (cell.text !== null) expect(cell.text).toMatch(/^[\d.]+ \/ [\d.]+$/);
      }
    }
  });
});

describe('there is no winner, and the screen says why', () => {
  it('states the order and refuses the ranking, in one sentence', () => {
    expect(ORDER_NOTE).toContain('in the order you picked them');
    expect(ORDER_NOTE).toContain('not ranked');
    expect(ORDER_NOTE).toContain('no overall winner');
  });

  it('the module contains no ordering over the composed set', () => {
    const code = readFileSync(join(__dirname, '..', 'compare-view.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toContain('.sort(');
    expect(code).not.toContain('.reverse(');
    expect(code).not.toContain('Math.max');
    expect(code).not.toContain('Math.min');
    expect(code).not.toContain('toFixed');
    expect(code).not.toMatch(/\/\s*36\b/);
    expect(code).not.toMatch(/[*/]\s*100\b/);
    // the numbers come off the package's view models and nowhere else
    expect(code).toContain('headline(report)');
    expect(code).toContain('kootaRows(report)');
  });

  it('the grep would actually catch a ranking', () => {
    const sample = 'columns.sort((a, b) => Number(b.total) - Number(a.total));';
    expect(sample).toContain('.sort(');
  });

  it('no column carries a rank, a position or a composite of any kind', () => {
    for (const column of COLUMNS) {
      expect(Object.keys(column).sort()).toEqual([
        'firm',
        'freshness',
        'name',
        'pairKey',
        'refusal',
        'rows',
        'scale',
        'total',
        'verdict',
      ]);
    }
  });
});

describe('picking columns', () => {
  const pick = (n: number): ComparePick => ({
    pairKey: `p_${n}__self`,
    name: `Person ${n}`,
    scale: 'Scored out of 36',
  });

  it('appends in the order they were picked, and never re-orders', () => {
    let picked: ComparePick[] = [];
    for (const n of [3, 1, 2]) picked = togglePick(picked, pick(n)).picked;
    expect(picked.map((p) => p.pairKey)).toEqual(['p_3__self', 'p_1__self', 'p_2__self']);
  });

  it('removes a pick that is picked again', () => {
    let picked = togglePick(togglePick([], pick(1)).picked, pick(2)).picked;
    picked = togglePick(picked, pick(1)).picked;
    expect(picked.map((p) => p.pairKey)).toEqual(['p_2__self']);
  });

  it('refuses the sixth with a sentence, rather than dropping the oldest', () => {
    let picked: ComparePick[] = [];
    for (let n = 1; n <= MAX_COMPARE; n += 1) picked = togglePick(picked, pick(n)).picked;
    const outcome = togglePick(picked, pick(9));
    expect(outcome.picked).toHaveLength(MAX_COMPARE);
    expect(outcome.picked.map((p) => p.pairKey)).toEqual(picked.map((p) => p.pairKey));
    expect(outcome.note).toBe(FULL_NOTE);
    expect(MAX_COMPARE).toBe(5);
  });
});

describe('a read that did not answer with a match', () => {
  const pick: ComparePick = { pairKey: 'p_x__self', name: 'Asha', scale: 'Scored out of 36' };

  it('a 404 says the match is gone, rather than showing four columns where five were picked', () => {
    const outcome = readColumn(404, null, pick);
    expect(outcome.kind).toBe('failed');
    if (outcome.kind !== 'failed') throw new Error('unreachable');
    expect(outcome.note).toContain('Asha');
    expect(outcome.note).toContain('no longer');
  });

  it('a 401 is a sign-in', () => {
    expect(readColumn(401, null, pick).kind).toBe('signed-out');
  });

  it('a body that is not a match is a failure with a sentence', () => {
    expect(readColumn(200, 'nonsense', pick).kind).toBe('failed');
    expect(readColumn(500, { error: { message: 'boom' } }, pick)).toEqual({
      kind: 'failed',
      note: 'boom',
    });
  });

  it('a 200 with a report is a column', () => {
    const detail = Object.values(DETAILS).find((d) => d.report) as MatchDetailWire;
    const outcome = readColumn(200, detail, {
      pairKey: detail.pair_key,
      name: detail.display_name,
      scale: 'Scored out of 36',
    });
    expect(outcome.kind).toBe('column');
  });
});
