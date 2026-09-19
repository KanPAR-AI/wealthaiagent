/**
 * docs/73 ASTRAL-341 — one chat per saved match, carrying ids and never a
 * restated birth value.
 *
 * The rows the handoffs are built from are the ones the engine SENT
 * (`matches-groups.json`, captured 2026-09-19), and the birth values those
 * people actually have are read out of the engine too — from
 * `match-details.json`'s own people — so "no birth value in the payload" is
 * asserted against the real values rather than against a pattern somebody
 * guessed at.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { askAboutMatchTurn } from '@wealthai/astral';

import {
  BASIS_MAY_RESCORE,
  BASIS_NO_SCORE,
  BASIS_RESCORED,
  BASIS_STORED,
  HANDOFF_REFUSED_NOTE,
  RESCORED_NOTE,
  basisNow,
  chatBasis,
  latchRescored,
  noteAboveScorecard,
  recomputedNow,
  MATCH_CHATS_KEY,
  MATCH_CHAT_LIMIT,
  forgetLink,
  linkFor,
  loadLinks,
  matchChatHandoff,
  parseMatchChatHandoff,
  readLinks,
  rememberLink,
  withLink,
  withoutLink,
} from '../match-chat';
import type { KeyValueStore } from '../pending-deletes';
import type { MatchesWire } from '../shortlist-view';

const FIXTURES = join(__dirname, 'fixtures');
const WIRE: MatchesWire = JSON.parse(readFileSync(join(FIXTURES, 'matches-groups.json'), 'utf8'));
const ROWS = WIRE.groups.flatMap((g) => g.rows);

function store(): KeyValueStore & { bag: Record<string, unknown> } {
  const bag: Record<string, unknown> = {};
  return {
    bag,
    get: async (key: string) => ({ [key]: bag[key] }),
    set: async (items: Record<string, unknown>) => {
      Object.assign(bag, items);
    },
  };
}

describe('the handoff carries ids and the opener — and nothing else', () => {
  it('is built from a row the engine sent', () => {
    expect(ROWS.length).toBeGreaterThan(3);
    const row = ROWS[0];
    const handoff = matchChatHandoff({
      pairKey: row.pair_key,
      personId: row.person_id,
      name: row.display_name,
    });
    expect(handoff.pairKey).toBe(row.pair_key);
    expect(handoff.personId).toBe(row.person_id);
    expect(handoff.opener).toBe(askAboutMatchTurn(row.display_name));
    expect(Object.keys(handoff).sort()).toEqual(['opener', 'pairKey', 'personId', 'title']);
  });

  it('uses the SHARED carrier, so the engine\'s deterministic switch reads it', () => {
    // `graph._MATCH_NAME_CUE` matches `match with <Name>`, and
    // `_rehydrate_stored_match` then narrates the STORED scorecard. A second
    // wording here would silently fall back to "give me both birth dates".
    const handoff = matchChatHandoff({ pairKey: 'p__self', personId: 'p', name: 'Meera' });
    expect(handoff.opener).toContain('match with Meera');
  });

  it('carries NO birth value — checked against the values these people really have', () => {
    for (const row of ROWS) {
      const handoff = matchChatHandoff({
        pairKey: row.pair_key,
        personId: row.person_id,
        name: row.display_name,
      });
      const payload = JSON.stringify(handoff);
      // no date, no time, no year, no digit at all
      expect(payload).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(payload).not.toMatch(/\d{1,2}:\d{2}/);
      expect(payload).not.toMatch(/\b(19|20)\d{2}\b/);
      // and no place, no chart word
      for (const word of ['dob', 'tob', 'pob', 'birth', 'nakshatra', 'rashi', 'lagna']) {
        expect(payload.toLowerCase()).not.toContain(word);
      }
    }
  });

  it('falls back honestly when a match has no name at all', () => {
    const handoff = matchChatHandoff({ pairKey: 'p__self', personId: 'p', name: '' });
    // …which does NOT rehydrate, so the engine asks rather than guessing
    expect(handoff.opener).toContain('this person');
  });
});

describe('the worker\'s door refuses anything that is not that shape', () => {
  const good = matchChatHandoff({ pairKey: 'p_a__self', personId: 'p_a', name: 'Meera' });

  it('accepts the handoff this client builds', () => {
    expect(parseMatchChatHandoff({ ...good })).toEqual(good);
    expect(parseMatchChatHandoff({ ...good, personId: null })).toEqual({ ...good, personId: null });
  });

  it('refuses an EXTRA key, whatever it carries', () => {
    expect(parseMatchChatHandoff({ ...good, dob: '1994-05-14' })).toBeNull();
    expect(parseMatchChatHandoff({ ...good, note: 'she was born in Nagpur' })).toBeNull();
  });

  it('refuses an opener with a DIGIT in it — a date cannot be written without one', () => {
    expect(
      parseMatchChatHandoff({
        ...good,
        opener: 'Tell me more about my match with Meera, born 14 May 1994.',
      }),
    ).toBeNull();
    expect(parseMatchChatHandoff({ ...good, title: 'Match — 1994-05-14' })).toBeNull();
  });

  it('refuses a missing id, an empty opener and a non-object', () => {
    expect(parseMatchChatHandoff({ ...good, pairKey: '' })).toBeNull();
    expect(parseMatchChatHandoff({ ...good, opener: '   ' })).toBeNull();
    expect(parseMatchChatHandoff({ ...good, personId: 7 })).toBeNull();
    expect(parseMatchChatHandoff(null)).toBeNull();
    expect(parseMatchChatHandoff('Tell me about Meera')).toBeNull();
  });

  it('a refusal is a sentence the panel can show, not a silent drop', () => {
    expect(HANDOFF_REFUSED_NOTE).toContain('Nothing was sent');
  });
});

describe('one chat id per match', () => {
  it('remembers the chat a match\'s conversation is in, and reuses it', async () => {
    const bag = store();
    await rememberLink(bag, { pairKey: 'p_a__self', chatId: 'chat-1' });
    expect(linkFor(await loadLinks(bag), 'p_a__self')).toBe('chat-1');
    // a second match is a second chat, not the same one
    await rememberLink(bag, { pairKey: 'p_b__self', chatId: 'chat-2' });
    expect(linkFor(await loadLinks(bag), 'p_b__self')).toBe('chat-2');
    expect(linkFor(await loadLinks(bag), 'p_a__self')).toBe('chat-1');
  });

  it('replaces a match\'s link rather than growing a second one', () => {
    const links = withLink(withLink([], { pairKey: 'p_a__self', chatId: 'one' }), {
      pairKey: 'p_a__self',
      chatId: 'two',
    });
    expect(links).toEqual([{ pairKey: 'p_a__self', chatId: 'two' }]);
  });

  it('forgets a link when the chat behind it is gone', async () => {
    const bag = store();
    await rememberLink(bag, { pairKey: 'p_a__self', chatId: 'chat-1' });
    await forgetLink(bag, 'p_a__self');
    expect(await loadLinks(bag)).toEqual([]);
    expect(withoutLink([{ pairKey: 'a', chatId: 'c' }], 'a')).toEqual([]);
  });

  it('is bounded, so the store cannot grow for ever', () => {
    let links: Array<{ pairKey: string; chatId: string }> = [];
    for (let n = 0; n < MATCH_CHAT_LIMIT + 10; n += 1) {
      links = withLink(links, { pairKey: `p_${n}__self`, chatId: `chat-${n}` });
    }
    expect(links).toHaveLength(MATCH_CHAT_LIMIT);
    // the newest survive
    expect(links[links.length - 1].chatId).toBe(`chat-${MATCH_CHAT_LIMIT + 9}`);
  });

  it('stores IDS ONLY, and drops any record that carries more', () => {
    expect(
      readLinks([
        { pairKey: 'p_a__self', chatId: 'chat-1' },
        // a record somebody widened — dropped whole, not trimmed
        { pairKey: 'p_b__self', chatId: 'chat-2', name: 'Meera' },
        { pairKey: 'p_c__self', chatId: 'chat-3', dob: '1994-05-14' },
        { pairKey: 'p_d__self' },
        { chatId: 'chat-5' },
        'nonsense',
        null,
      ]),
    ).toEqual([{ pairKey: 'p_a__self', chatId: 'chat-1' }]);
    expect(readLinks('nonsense')).toEqual([]);
  });

  it('what lands in storage is two opaque ids and a key, with no birth value', async () => {
    const bag = store();
    await rememberLink(bag, { pairKey: ROWS[0].pair_key, chatId: 'chat-1' });
    const written = JSON.stringify(bag.bag);
    expect(Object.keys(bag.bag)).toEqual([MATCH_CHATS_KEY]);
    expect(written).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(written).not.toMatch(/\d{1,2}:\d{2}/);
    for (const row of ROWS) {
      expect(written).not.toContain(row.display_name);
    }
  });
});

// ── FLAG-1 · what the screen may promise, and what the turn proved ─────────

describe('the stored-scorecard promise is made only where the engine keeps it', () => {
  /**
   * `_rehydrate_stored_match` (`graph.py:11759`) declines on anything not
   * FRESH, on a refusal and on an undetermined Moon rashi — and when it
   * declines the turn falls through to `node_synastry`, which casts both
   * charts again. So the promise tracks that precondition exactly.
   */
  it('promises the stored scorecard on a FRESH, scored, unrefused row', () => {
    const basis = chatBasis({ freshness: 'fresh', scored: true, refused: false });
    expect(basis.promised).toBe(true);
    expect(basis.sentence).toBe(BASIS_STORED);
    expect(basis.sentence).toContain('nothing is scored again');
  });

  it('promises NOTHING on a stale row, and says it may be scored again', () => {
    const basis = chatBasis({ freshness: 'stale', scored: true, refused: false });
    expect(basis.promised).toBe(false);
    expect(basis.sentence).toBe(BASIS_MAY_RESCORE);
    expect(basis.sentence).toContain('may be');
    expect(basis.sentence).not.toContain('nothing is scored again');
  });

  it('promises nothing on an unprovable stamp either', () => {
    expect(chatBasis({ freshness: 'unprovable', scored: true, refused: false }).promised).toBe(
      false,
    );
  });

  it('says there is no stored score on a refusal, or on a row with none', () => {
    expect(chatBasis({ freshness: 'fresh', scored: false, refused: false }).sentence).toBe(
      BASIS_NO_SCORE,
    );
    expect(chatBasis({ freshness: 'fresh', scored: true, refused: true }).sentence).toBe(
      BASIS_NO_SCORE,
    );
  });

  it('the rows the engine actually sent split across both branches', () => {
    // anti-vacuity, from the captured fixture: if every row were fresh the
    // cases above would be theory.
    const states = new Set(ROWS.map((r) => r.freshness));
    expect(states.size).toBeGreaterThan(1);
  });
});

describe('what the TURN proved, read from the stream', () => {
  const CASTING = 'Casting both Kundlis and matching the 36 gunas... 💞\n\n';

  it('the engine\'s progress line IS the recompute signal — one emitter', () => {
    expect(
      recomputedNow({ text: CASTING, drewScorecard: false, rowWasFresh: true }),
    ).toBe(true);
  });

  it('a scorecard on a row that was not fresh is a recompute too', () => {
    expect(recomputedNow({ text: 'Here it is.', drewScorecard: true, rowWasFresh: false })).toBe(
      true,
    );
  });

  it('a narrated stored match on a FRESH row is not', () => {
    expect(
      recomputedNow({ text: 'Your Nadi koota scores 0.', drewScorecard: true, rowWasFresh: true }),
    ).toBe(false);
    expect(recomputedNow({ text: '', drewScorecard: false, rowWasFresh: true })).toBe(false);
  });

  it('WITHDRAWS a promise the turn disproved, rather than leaving it on screen', () => {
    const promised = chatBasis({ freshness: 'fresh', scored: true, refused: false });
    expect(basisNow(promised, false)).toBe(BASIS_STORED);
    const withdrawn = basisNow(promised, true);
    expect(withdrawn).toBe(BASIS_RESCORED);
    expect(withdrawn).not.toContain('nothing is scored again');
    expect(withdrawn).toContain('differ from the ones in your list');
  });

  it('the note printed over the redrawn scorecard says what it is', () => {
    expect(RESCORED_NOTE).toBe(
      'Scored again just now — this can differ from the numbers in your list.',
    );
  });
});

describe('the withdrawal is STICKY, and it is said once (FLAG-1 residual)', () => {
  const CASTING = 'Casting both Kundlis and matching the 36 gunas... 💞\n\n';

  it('a chat that has recomputed stays recomputed, even with an empty stream', () => {
    // The Ask button clears the stream; the FACT is about the chat.
    expect(latchRescored(false, { text: CASTING, drewScorecard: false, rowWasFresh: true })).toBe(
      true,
    );
    expect(latchRescored(true, { text: '', drewScorecard: false, rowWasFresh: true })).toBe(true);
    expect(latchRescored(false, { text: '', drewScorecard: false, rowWasFresh: true })).toBe(false);
  });

  it('never prints the note and the rescored header at the same time', () => {
    expect(
      noteAboveScorecard(BASIS_RESCORED, { rescored: true, drewScorecard: true }),
    ).toBeNull();
  });

  it('…and prints it where the header does NOT carry the sentence', () => {
    expect(noteAboveScorecard(BASIS_STORED, { rescored: true, drewScorecard: true })).toBe(
      RESCORED_NOTE,
    );
  });

  it('says nothing when there is no scorecard and nothing was rescored', () => {
    expect(noteAboveScorecard(BASIS_STORED, { rescored: true, drewScorecard: false })).toBeNull();
    expect(noteAboveScorecard(BASIS_STORED, { rescored: false, drewScorecard: true })).toBeNull();
  });
});
