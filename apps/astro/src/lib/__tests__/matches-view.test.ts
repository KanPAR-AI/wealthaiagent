/**
 * docs/49 ASTRAL-142/143/144, F39, F47 — the leaderboard, tested for the
 * things a screenshot cannot show: that no percentage exists, that the two
 * scales never interleave, and that a refused couple is never quietly
 * dropped to keep the list tidy.
 *
 * Relative imports on purpose (see `settings-rows.test.ts`).
 */

import type { MatchGroup, MatchRow, MatchesResponse } from '../people-shapes';
import {
  askAboutTurn,
  isEmpty,
  sections,
  type MatchRowView,
} from '../matches-view';

// The three group labels the server actually sends (`matches.py:GROUP_LABELS`).
const LABELS: Record<string, string> = {
  complete: 'Scored out of 36',
  firm_only: 'Partly scored — 21 of the 36 gunas need a birth time',
  refused: 'Not scored — a birth time is missing on one side',
};

function row(over: Partial<MatchRow> = {}): MatchRow {
  return {
    pair_key: `self__${over.person_id ?? 'p1'}`,
    person_id: 'p1',
    display_name: 'Meera',
    favourite: false,
    relation: 'match',
    tob_known: true,
    freshness: 'fresh',
    computed_at: '2026-08-24T10:00:00+00:00',
    verdict: 'very good',
    doshas: [],
    dosha_count: 0,
    score: { points: 28, out_of: 36 },
    ...over,
  };
}

const firmRow = (over: Partial<MatchRow> = {}) =>
  row({
    verdict: 'incomplete',
    tob_known: false,
    score: {
      firm_points: 12,
      out_of: 15,
      pending: 21,
      pending_reasons: ['Nadi (health and progeny) cannot be checked without both birth times.'],
    },
    ...over,
  });

const refusedRow = (over: Partial<MatchRow> = {}) =>
  row({ verdict: null, score: undefined, ...over });

function response(groups: Partial<Record<string, MatchRow[]>>): MatchesResponse {
  const keys = ['complete', 'firm_only', 'refused'];
  const built: MatchGroup[] = keys.map((key) => ({
    key,
    label: LABELS[key],
    rows: groups[key] ?? [],
  }));
  return { groups: built, total: built.reduce((n, g) => n + g.rows.length, 0) };
}

function flatten(view: ReturnType<typeof sections>): MatchRowView[] {
  return view.flatMap((s) => s.rows);
}

describe('F39 / ASTRAL-142 — two scales, never interleaved', () => {
  const mixed = response({
    complete: [row({ person_id: 'a', display_name: 'Aditi', score: { points: 30, out_of: 36 } }),
               row({ person_id: 'b', display_name: 'Bhavna', score: { points: 26, out_of: 36 } })],
    firm_only: [firmRow({ person_id: 'c', display_name: 'Chitra' })],
    refused: [refusedRow({ person_id: 'd', display_name: 'Divya' })],
  });

  it('keeps the server\'s three groups, in order, with their own labels', () => {
    expect(sections(mixed).map((s) => s.key)).toEqual(['complete', 'firm_only', 'refused']);
    expect(sections(mixed).map((s) => s.label)).toEqual([
      LABELS.complete, LABELS.firm_only, LABELS.refused,
    ]);
  });

  it('never places a partly-scored match above a complete one', () => {
    const order = flatten(sections(mixed)).map((r) => r.name);
    expect(order.indexOf('Chitra')).toBeGreaterThan(order.indexOf('Bhavna'));
  });

  it('a firm-only score is NEVER rendered against 36', () => {
    const chitra = flatten(sections(mixed)).find((r) => r.name === 'Chitra')!;
    expect(chitra.score!.text).toBe('12 / 15');
    expect(chitra.score!.text).not.toContain('36');
    expect(chitra.score!.scale).toContain('birth time');
  });

  it('renders no percentage anywhere, on any row', () => {
    const printed = JSON.stringify(sections(mixed));
    expect(printed).not.toContain('%');
    expect(printed).not.toMatch(/\b\d{2}\s*percent/i);
  });

  it('drops an empty section rather than heading nothing', () => {
    const only = response({ complete: [row()] });
    expect(sections(only).map((s) => s.key)).toEqual(['complete']);
  });
});

describe('F39 — the property, over generated match sets', () => {
  // Every combination of group sizes 0..3, with pseudo-random scores. The
  // properties below must hold for all of them: no permutation of inputs
  // may interleave the scales or produce a percentage.
  const sets: MatchesResponse[] = [];
  for (let c = 0; c <= 3; c += 1) {
    for (let f = 0; f <= 3; f += 1) {
      for (let r = 0; r <= 2; r += 1) {
        sets.push(response({
          // Deliberately ADVERSARIAL numbers: the complete scores are LOW
          // (8, 6, 4 out of 36) and the firm-only scores are HIGH (15, 13,
          // 11 out of 15), so any flat sort by the raw number — the obvious
          // wrong implementation — puts a partly-scored match above a
          // complete one and the property below fails.
          complete: Array.from({ length: c }, (_, i) =>
            row({ person_id: `c${i}`, display_name: `C${i}`, score: { points: 8 - i * 2, out_of: 36 } })),
          firm_only: Array.from({ length: f }, (_, i) =>
            firmRow({ person_id: `f${i}`, display_name: `F${i}`,
                      score: { firm_points: 15 - i * 2, out_of: 15, pending: 21, pending_reasons: [] } })),
          refused: Array.from({ length: r }, (_, i) =>
            refusedRow({ person_id: `r${i}`, display_name: `R${i}` })),
        }));
      }
    }
  }

  it('covers a realistic spread of shapes', () => {
    expect(sets.length).toBe(48);
  });

  it('every complete row precedes every firm-only row, always', () => {
    for (const set of sets) {
      const flat = flatten(sections(set));
      const lastComplete = flat.map((r) => r.name).reduce((acc, n, i) => (n.startsWith('C') ? i : acc), -1);
      const firstFirm = flat.findIndex((r) => r.name.startsWith('F'));
      if (lastComplete >= 0 && firstFirm >= 0) expect(firstFirm).toBeGreaterThan(lastComplete);
    }
  });

  it('no row ever carries a percentage or a rescaled number', () => {
    for (const set of sets) {
      const printed = JSON.stringify(sections(set));
      expect(printed).not.toContain('%');
      // 12/15 rescaled to /36 would be 28.8; the tell is a decimal appearing
      // where the engine emitted whole firm points.
      expect(printed).not.toMatch(/\d+\.\d+\s*\/\s*36/);
    }
  });

  it('every stored row survives to the screen — none is dropped', () => {
    for (const set of sets) {
      expect(flatten(sections(set)).length).toBe(set.total);
    }
  });
});

describe('F47 — an ordinal is within its section, and labelled with it', () => {
  const many = response({
    complete: [row({ person_id: 'a', display_name: 'Aditi' }), row({ person_id: 'b', display_name: 'Bhavna' })],
    firm_only: [firmRow({ person_id: 'c', display_name: 'Chitra' }), firmRow({ person_id: 'e', display_name: 'Esha' })],
    refused: [refusedRow({ person_id: 'd', display_name: 'Divya' }), refusedRow({ person_id: 'g', display_name: 'Gita' })],
  });

  it('numbers within the section and states which section', () => {
    const view = sections(many);
    expect(view[0].rows.map((r) => r.ordinal)).toEqual([
      '#1 of 2 with complete scorecards',
      '#2 of 2 with complete scorecards',
    ]);
    expect(view[1].rows[0].ordinal).toBe('#1 of 2 among the partly scored');
  });

  it('never numbers across sections — no "#3 of 6" anywhere', () => {
    const printed = flatten(sections(many)).map((r) => r.ordinal).join('|');
    expect(printed).not.toContain('of 6');
    expect(printed).not.toContain('#3');
    expect(printed).not.toContain('#4');
  });

  it('gives an unscored section no ordinal at all', () => {
    // Ranking things that were not scored is a ranking with no measurement
    // behind it — the ordinal F47 rules out, in its purest form.
    expect(sections(many)[2].rows.every((r) => r.ordinal === null)).toBe(true);
  });

  it('does not number a section of one', () => {
    expect(sections(response({ complete: [row()] }))[0].rows[0].ordinal).toBeNull();
  });

  it('gives a section this build has never heard of no ordinal', () => {
    const odd: MatchesResponse = {
      groups: [{ key: 'partial_by_place', label: 'Something new', rows: [row({ person_id: 'x' }), row({ person_id: 'y' })] }],
      total: 2,
    };
    expect(sections(odd)[0].rows.every((r) => r.ordinal === null)).toBe(true);
    expect(sections(odd)[0].rows).toHaveLength(2);
  });
});

describe('ASTRAL-143 — the verdict is the engine\'s word and the doshas are on the row', () => {
  it('prints the verdict verbatim, including the word `incomplete`', () => {
    const view = sections(response({ complete: [row()], firm_only: [firmRow({ person_id: 'c' })] }));
    expect(view[0].rows[0].verdict).toBe('very good');
    expect(view[1].rows[0].verdict).toBe('incomplete');
  });

  it('carries the active dosha flags onto the list row, not one tap away', () => {
    const withDosha = row({
      doshas: [{ name: 'Nadi dosha', detail: 'Both share the same Nadi.', provisional: false }],
      dosha_count: 1,
    });
    const view = sections(response({ complete: [withDosha] }));
    expect(view[0].rows[0].doshas.map((d) => d.name)).toEqual(['Nadi dosha']);
  });

  it('carries the engine\'s pending sentences on a partly-scored row', () => {
    const view = sections(response({ firm_only: [firmRow()] }));
    expect(view[0].rows[0].score!.pending[0]).toContain('cannot be checked');
  });
});

describe('ASTRAL-144 — a refusal is a row, not an omission', () => {
  it('keeps the person on the list with a stated reason', () => {
    const view = sections(response({
      refused: [refusedRow({ refusal: { reason: "Divya's Moon crosses a rashi boundary that day." } })],
    }));
    expect(view[0].rows[0].name).toBe('Meera');
    expect(view[0].rows[0].refusal).toContain('Moon crosses');
  });

  it('never renders a zero or an empty score in place of the refusal', () => {
    const view = sections(response({ refused: [refusedRow()] }));
    expect(view[0].rows[0].score).toBeNull();
    expect(JSON.stringify(view[0].rows[0])).not.toMatch(/"points":\s*0/);
  });

  it('offers the ask that would resolve it', () => {
    expect(sections(response({ refused: [refusedRow()] }))[0].rows[0].ask).toContain('birth time');
  });

  it('does not invent a reason when the server stored none', () => {
    const sentence = sections(response({ refused: [refusedRow()] }))[0].rows[0].refusal!;
    expect(sentence).toContain('No score could be computed');
    expect(sentence).not.toContain('Moon');
  });

  it('offers no birth-time ask on a complete row — there is nothing to unlock', () => {
    expect(sections(response({ complete: [row()] }))[0].rows[0].ask).toBeNull();
  });
});

describe('ASTRAL-141 / freshness — the name joins at render and staleness is stated', () => {
  it('takes the name from the person row, never from the artifact', () => {
    const renamed = sections(response({ complete: [row({ display_name: 'Meera Iyer' })] }));
    expect(renamed[0].rows[0].name).toBe('Meera Iyer');
    // …and the score is untouched by the rename: nothing was recomputed.
    expect(renamed[0].rows[0].score!.text).toBe('28 / 36');
  });

  it('says nothing about freshness when there is nothing to say', () => {
    expect(sections(response({ complete: [row()] }))[0].rows[0].freshness).toBeNull();
  });

  it('states staleness with the date it was scored', () => {
    const stale = sections(response({ complete: [row({ freshness: 'stale' })] }));
    expect(stale[0].rows[0].freshness).toContain('24 Aug 2026');
  });

  it('states an unprovable stamp rather than claiming fresh', () => {
    const view = sections(response({ complete: [row({ freshness: 'unprovable' })] }));
    expect(view[0].rows[0].freshness).toContain('before we recorded');
  });
});

describe('ASTRAL-146 — the handoff carries a name and no birth facts', () => {
  it('names the person and nothing else', () => {
    const turn = askAboutTurn('Meera');
    expect(turn).toBe('Tell me more about my match with Meera.');
    expect(turn).not.toMatch(/\d/);
  });
});

describe('the empty state is honest', () => {
  it('is empty only when the server says the total is zero', () => {
    expect(isEmpty(response({}))).toBe(true);
    expect(isEmpty(response({ complete: [row()] }))).toBe(false);
    expect(isEmpty(null)).toBe(true);
  });
});


// ══════════════════════════════════════════════════════════════════════════
// docs/49 ASTRAL-157 — the sort rule, and the kootas it used
// ══════════════════════════════════════════════════════════════════════════

describe('ASTRAL-157 — the ordering is falsifiable by the reader', () => {
  const withRule = {
    total: 2,
    groups: [
      {
        key: 'complete',
        label: 'Scored out of 36',
        sort_rule: 'Ordered by Nadi, then Gana, then the total out of 36, then fewer dosha flags.',
        sort_note: '',
        rows: [
          {
            pair_key: 'a__b',
            person_id: 'p1',
            display_name: 'Meera',
            favourite: false,
            relation: 'match',
            tob_known: true,
            freshness: 'fresh',
            verdict: 'Very good',
            doshas: [],
            dosha_count: 0,
            score: { points: 26, out_of: 36 },
            leading_kootas: [
              { name: 'Nadi', points: 8, max: 8, pending: false },
              { name: 'Gana', points: 6, max: 6, pending: false },
            ],
          },
        ],
      },
      {
        key: 'firm_only',
        label: 'Partly scored — 21 of the 36 gunas need a birth time',
        sort_rule: 'Ordered by the firm points out of 15, then fewer dosha flags.',
        sort_note: 'None of your priorities (Nadi) is scored without a birth time, so these are ordered by the firm points instead.',
        rows: [
          {
            pair_key: 'a__c',
            person_id: 'p2',
            display_name: 'Radha',
            favourite: false,
            relation: 'match',
            tob_known: false,
            freshness: 'fresh',
            verdict: 'incomplete',
            doshas: [],
            dosha_count: 0,
            score: { firm_points: 12, out_of: 15, pending: 21, pending_reasons: [] },
            leading_kootas: [{ name: 'Nadi', points: null, max: 8, pending: true }],
          },
        ],
      },
    ],
  } as any;

  it('carries the server\'s rule verbatim, per section', () => {
    const [complete, firm] = sections(withRule);
    expect(complete.rule).toContain('Ordered by Nadi, then Gana');
    expect(firm.rule).toBe('Ordered by the firm points out of 15, then fewer dosha flags.');
  });

  it('carries the honest note when a group could not use the priority', () => {
    const [, firm] = sections(withRule);
    expect(firm.note).toContain('None of your priorities');
  });

  it('shows the kootas the ordering used, as fractions and never as a total', () => {
    const [complete] = sections(withRule);
    expect(complete.rows[0].leading).toEqual([
      { name: 'Nadi', text: '8 / 8' },
      { name: 'Gana', text: '6 / 6' },
    ]);
    // 8 + 6 = 14 must appear nowhere: a subset sum is an invented composite
    expect(JSON.stringify(complete.rows[0].leading)).not.toContain('14');
  });

  it('says "not scored" for a pending koota rather than showing a zero', () => {
    const [, firm] = sections(withRule);
    expect(firm.rows[0].leading).toEqual([{ name: 'Nadi', text: 'not scored' }]);
  });

  it('prints no rule and no leading kootas when nothing is prioritised', () => {
    const bare = {
      total: 1,
      groups: [
        {
          key: 'complete',
          label: 'Scored out of 36',
          rows: [
            {
              pair_key: 'a__b',
              person_id: 'p1',
              display_name: 'Meera',
              favourite: false,
              relation: 'match',
              tob_known: true,
              freshness: 'fresh',
              verdict: 'Very good',
              doshas: [],
              dosha_count: 0,
              score: { points: 26, out_of: 36 },
            },
          ],
        },
      ],
    } as any;
    const [complete] = sections(bare);
    expect(complete.rule).toBe('');
    expect(complete.rows[0].leading).toEqual([]);
  });
});
