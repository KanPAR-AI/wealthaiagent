/**
 * docs/49 S20 — the Preferences view model (ASTRAL-152/154/159/160/161/162).
 *
 * What these tests defend:
 *
 *   · a derived priority drawn as one the user chose (ASTRAL-160) — the
 *     failure that reads to a user as the product putting words in their
 *     mouth;
 *   · a proposal drawn as an active preference (AMB-29);
 *   · a free-text note that stops being visibly the user's own words, or
 *     stops being labelled as unscored (AMB-32(c), ASTRAL-148);
 *   · a "your chart suggests" with nothing behind it (ASTRAL-159);
 *   · a generic starter set standing in for an honest absence (ASTRAL-161).
 *
 * The payload shape mirrors `GET /people/priorities`, verified against the
 * live API on 2026-08-25.
 */

import type { PrioritiesResponse } from '../people-shapes';
import {
  EMPTY_BODY,
  disclosure,
  plainText,
  interestRows,
  isEmpty,
  migrationNotice,
  proposalAbsence,
  proposalRows,
  provenanceCaption,
  rankedRows,
  summary,
  updatedLine,
} from '../priorities-view';

const VOCAB = {
  max_ranked: 3,
  priorities: [
    { key: 'temperament', label: 'Temperament and emotional fit', kootas: ['Gana'] },
    { key: 'health_progeny', label: 'Health and children', kootas: ['Nadi'] },
    { key: 'family_life', label: 'Prosperity and family welfare', kootas: ['Bhakoot'] },
  ],
  interests: [{ key: 'career', label: 'Career and work', domains: ['career'] }],
};

function payload(over: Partial<PrioritiesResponse> = {}): PrioritiesResponse {
  return {
    set: {
      ranked: [
        {
          key: 'temperament',
          label: 'Temperament and emotional fit',
          provenance: 'user_set',
          basis: null,
          recorded_at: '2026-08-25T10:00:00+00:00',
        },
        {
          key: 'health_progeny',
          label: 'Health and children',
          provenance: 'accepted_proposal',
          basis: 'Jupiter is exalted in Cancer',
          recorded_at: '2026-08-25T10:00:00+00:00',
        },
      ],
      interests: [
        {
          key: 'career',
          text: 'Career and work',
          provenance: 'user_set',
          free_text: false,
          unscored_sentence: 'Gun milan does not score career and work — …',
        },
        {
          key: null,
          text: 'must be kind to my mother',
          provenance: 'user_set',
          free_text: true,
          unscored_sentence: null,
        },
      ],
      removed: [],
      updated_at: '2026-08-25T10:00:00+00:00',
      mapping_version: 1,
    },
    proposed: {
      entries: [
        {
          key: 'family_life',
          basis: '7th lord Jupiter sits in house 11, exalted in Cancer',
          why: 'the 7th house is the house of marriage …',
        },
      ],
      skipped: [],
      reason: '',
      chart_status: 'fresh',
    },
    vocabulary: VOCAB,
    disclosure:
      'Your match reports and your matches list will reorder to lead with ' +
      'temperament and emotional fit. No score, band, verdict or dosha flag changes.',
    edit_turn: "I'd like to set what matters to me in a partner.",
    ...over,
  } as PrioritiesResponse;
}

describe('ASTRAL-160 — derived and declared never look alike', () => {
  it('captions each entry with where it came from', () => {
    const rows = rankedRows(payload());
    expect(rows[0].caption).toBe('set by you');
    expect(rows[1].caption).toBe(
      'from your chart — you accepted it · Jupiter is exalted in Cancer',
    );
  });

  it('marks the chart-sourced entry so the screen can draw it differently', () => {
    const rows = rankedRows(payload());
    expect(rows.map((r) => r.fromChart)).toEqual([false, true]);
  });

  it('never claims a provenance it does not recognise means "you chose it"', () => {
    expect(
      provenanceCaption({
        key: 'temperament',
        label: 'x',
        provenance: 'something_new',
      }),
    ).toBe('recorded earlier');
  });

  it('numbers the ranks from one, and that is the only number here', () => {
    const rows = rankedRows(payload());
    expect(rows.map((r) => r.rank)).toEqual([1, 2]);
    expect(JSON.stringify(rows)).not.toMatch(/\b(points|score|out of|%)\b/);
  });
});

describe('AMB-29 — a proposal is not a preference', () => {
  it('keeps proposals in their own list, with the basis behind each', () => {
    const rows = proposalRows(payload());
    expect(rows).toEqual([
      {
        key: 'family_life',
        label: 'Prosperity and family welfare',
        basis: '7th lord Jupiter sits in house 11, exalted in Cancer',
      },
    ]);
    // …and none of them is in the stored list
    expect(rankedRows(payload()).map((r) => r.key)).not.toContain('family_life');
  });

  it('shows the honest absence when nothing was derivable, never a starter set', () => {
    const data = payload({
      proposed: {
        entries: [],
        skipped: [{ row: 'seventh_lord_placement', key: 'family_life', reason: 'no lagna' }],
        reason: 'your chart does not determine enough to suggest defaults — no birth time',
        chart_status: 'fresh',
      },
    });
    expect(proposalRows(data)).toEqual([]);
    expect(proposalAbsence(data)).toContain('does not determine enough');
  });

  it('says nothing at all when there is nothing to say', () => {
    expect(proposalAbsence(payload())).toBeNull();
    expect(proposalAbsence(null)).toBeNull();
  });
});

describe('AMB-32(c) / ASTRAL-148 — the second tier is honest about doing nothing', () => {
  it('quotes the free-text note as the user\'s own words', () => {
    const rows = interestRows(payload());
    expect(rows[1].text).toBe('“must be kind to my mother”');
    expect(rows[1].freeText).toBe(true);
  });

  it('labels a declared interest as unscored by gun milan', () => {
    expect(interestRows(payload())[0].note).toBe('Not scored by gun milan.');
  });

  it('says plainly that the note is never used to write a reading', () => {
    expect(interestRows(payload())[1].note).toContain('never used to write a reading');
  });

  it('keeps interests out of anything that looks like a rank', () => {
    const rows = interestRows(payload());
    expect(JSON.stringify(rows)).not.toMatch(/"rank"/);
  });
});

describe('ASTRAL-154 — the disclosure, and the summary before you open it', () => {
  it('prints the server\'s disclosure verbatim, including the invariant', () => {
    expect(disclosure(payload())).toContain('No score, band, verdict or dosha flag changes.');
  });

  it('summarises the set in rank order', () => {
    expect(summary(payload())).toBe(
      'temperament and emotional fit, then health and children',
    );
  });

  it('says "not set" — and mentions the chart\'s suggestions when there are some', () => {
    const empty = payload({
      set: { ranked: [], interests: [], removed: [], updated_at: null },
    } as any);
    expect(summary(empty)).toBe('Not set — 1 suggested from your chart');
    expect(isEmpty(empty)).toBe(true);
    expect(EMPTY_BODY).toContain('stay exactly as they are');
  });

  it('reports a null read as empty rather than inventing a state', () => {
    expect(isEmpty(null)).toBe(true);
    expect(summary(null)).toBe('Not set');
    expect(rankedRows(null)).toEqual([]);
    expect(disclosure(null)).toBe('');
    expect(updatedLine(null)).toBeNull();
  });

  it('dates the last change when it has one', () => {
    expect(updatedLine(payload())).toMatch(/^Last changed /);
  });
});

describe('the engine\'s prose, rendered by a screen that has no markdown', () => {
  it('strips emphasis markers the simulator showed raw', () => {
    expect(
      plainText('- **Prosperity and family welfare** — 7th lord Mercury sits in house 3'),
    ).toBe('Prosperity and family welfare — 7th lord Mercury sits in house 3');
  });

  it('changes no word, drops no sentence and reorders nothing', () => {
    const prose =
      'What matters most to you in a partner? Name up to three, in order.\n\n' +
      'From your own chart, and only if you pick them:';
    expect(plainText(prose)).toBe(prose);
  });

  it('leaves a lone asterisk inside a word alone', () => {
    expect(plainText('a*b')).toBe('a*b');
  });

  it('handles the empty case without inventing one', () => {
    expect(plainText('')).toBe('');
  });
});

describe('ASTRAL-158 / F55 — a basis from an older mapping says so', () => {
  const MIGRATION = {
    stored_version: 1,
    current_version: 2,
    stale_keys: ['health_progeny'],
    note:
      'The mapping between what matters to you and the kootas that score it ' +
      'has changed (version 1 → 2). This entry was suggested by your chart ' +
      'under the old table, so it is offered again below with the reason the ' +
      'current table gives. Nothing you set yourself changes, nothing you ' +
      'removed comes back, and no score moves either way.',
  };

  it('names the migration in the server\'s own words', () => {
    expect(
      migrationNotice(
        payload({
          mapping: {
            stored_version: 1,
            current_version: 2,
            stale: true,
            migration: MIGRATION,
          },
        }),
      ),
    ).toBe(MIGRATION.note);
  });

  it('says nothing when the stored set is current', () => {
    expect(migrationNotice(payload())).toBeNull();
    expect(
      migrationNotice(
        payload({
          mapping: {
            stored_version: 1,
            current_version: 1,
            stale: false,
            migration: null,
          },
        }),
      ),
    ).toBeNull();
  });

  it('marks a stale basis on the row that carries it, and only there', () => {
    const data = payload();
    data.set.ranked[1].basis_stale = true;
    const rows = rankedRows(data);
    expect(rows[1].caption).toBe(
      'from your chart — you accepted it · Jupiter is exalted in Cancer · ' +
        'suggested under an earlier mapping',
    );
    expect(rows[0].caption).toBe('set by you');
  });
});
