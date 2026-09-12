// docs/60 SL-5 (owner, 2026-09-12): "takes away the several matches and
// only keeps their partner." Set aside, never deleted — the rule, pinned.

import { partnerMode, sections } from '../matches-view';
import type { MatchesResponse } from '../people-shapes';

const RES = {
  groups: [
    { key: 'complete', label: 'Scored /36', rule: '', rows: [
      { pair_key: 'p_a__self', person_id: 'p_a', display_name: 'Anjali',
        favourite: false, relation: 'match', tob_known: true,
        verdict: 'very good', score: { points: 26, out_of: 36 },
        leading: [], doshas: [], computed_at: '2026-09-01' },
      { pair_key: 'p_b__self', person_id: 'p_b', display_name: 'Meera',
        favourite: false, relation: 'match', tob_known: true,
        verdict: 'good', score: { points: 21, out_of: 36 },
        leading: [], doshas: [], computed_at: '2026-09-01' },
    ] },
  ],
  total: 2,
} as unknown as MatchesResponse;

describe('partnerMode', () => {
  it('finds the partner row and counts what steps aside', () => {
    const view = partnerMode(RES, 'p_a');
    expect(view.partnerRow?.name ?? view.partnerRow?.pairKey).toBeTruthy();
    expect(view.partnerRow?.personId).toBe('p_a');
    expect(view.setAsideCount).toBe(1);
  });

  it('a partner with no stored match yields null and the full count', () => {
    const view = partnerMode(RES, 'p_ghost');
    expect(view.partnerRow).toBeNull();
    expect(view.setAsideCount).toBe(2);
  });

  it('never mutates what sections computed', () => {
    const before = sections(RES).flatMap((s) => s.rows).length;
    partnerMode(RES, 'p_a');
    expect(sections(RES).flatMap((s) => s.rows).length).toBe(before);
  });
});
