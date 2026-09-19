/**
 * docs/73 B1, second half — the promise survives a closed panel and a closed
 * browser.
 *
 * The panel says "when you leave or close this panel I will delete the
 * conversation. If the browser is closed first, it is deleted the next time
 * you open AstroMatch." Everything below is what has to be true for those two
 * sentences to be honest.
 *
 * The one that is a safety property rather than a behaviour: **only ids are
 * stored.** This is the only thing this extension writes to disk-backed
 * storage, and a birth value in it would outlive the chat we went to the
 * trouble of deleting.
 */

import {
  CLAIM_CEILING_MS,
  CLAIM_GRACE_MS,
  KEPT_CLAIMED,
  PENDING_KEY,
  claimKept,
  clearPending,
  isKept,
  notePending,
  owedNow,
  releaseKept,
  parsePending,
  readPending,
  sweepNotice,
  sweepPending,
  type KeyValueStore,
} from '../pending-deletes';

function fakeStore(initial: Record<string, unknown> = {}) {
  let bag = { ...initial };
  const store: KeyValueStore = {
    get: async (key) => ({ [key]: bag[key] }),
    set: async (items) => {
      bag = { ...bag, ...items };
    },
  };
  return { store, read: () => bag };
}

describe('only ids are ever written', () => {
  it('stores exactly a chat id and a timestamp', async () => {
    const { store, read } = fakeStore();
    await notePending(store, 'chat-1', 1_700_000_000_000);
    expect(read()[PENDING_KEY]).toEqual([{ chatId: 'chat-1', noticedAt: 1_700_000_000_000 }]);
  });

  it('no stored record carries anything that could be a birth value', async () => {
    const { store, read } = fakeStore();
    await notePending(store, 'chat-1', 1);
    await notePending(store, 'chat-2', 2);
    const json = JSON.stringify(read());
    for (const forbidden of ['dob', 'tob', 'pob', 'name', 'place', 'birth', '19', '20']) {
      if (forbidden === '19' || forbidden === '20') continue; // a timestamp is digits
      expect(json).not.toContain(forbidden);
    }
    for (const record of read()[PENDING_KEY] as Array<Record<string, unknown>>) {
      expect(Object.keys(record).sort()).toEqual(['chatId', 'noticedAt']);
    }
  });

  it('DROPS a stored record that carries more than an id', () => {
    // Storage is shared with whatever an earlier build wrote. A record with
    // extra keys means something once stored more than an id, and it is not
    // read back into a delete loop.
    expect(
      parsePending([
        { chatId: 'chat-1', noticedAt: 1 },
        { chatId: 'chat-2', noticedAt: 2, pob: 'Pune, India' },
      ]),
    ).toEqual([{ chatId: 'chat-1', noticedAt: 1 }]);
  });

  it.each([null, undefined, 'a string', 42, [{}], [{ chatId: '' }], [{ chatId: 'x' }]])(
    'reads %p as nothing owed rather than guessing',
    (raw) => {
      expect(parsePending(raw)).toEqual([]);
    },
  );

  it('does not record the same chat twice', async () => {
    const { store, read } = fakeStore();
    await notePending(store, 'chat-1', 1);
    await notePending(store, 'chat-1', 2);
    expect((read()[PENDING_KEY] as unknown[]).length).toBe(1);
  });

  it('records nothing for an empty id', async () => {
    const { store, read } = fakeStore();
    await notePending(store, '', 1);
    expect(read()[PENDING_KEY]).toBeUndefined();
  });
});

describe('the sweep', () => {
  it('deletes everything owed and forgets it', async () => {
    const { store } = fakeStore({ [PENDING_KEY]: [{ chatId: 'a', noticedAt: 1 }, { chatId: 'b', noticedAt: 2 }] });
    const asked: string[] = [];
    const result = await sweepPending(store, async (id) => {
      asked.push(id);
      return true;
    });
    expect(asked).toEqual(['a', 'b']);
    expect(result).toEqual({ deleted: ['a', 'b'], remaining: [], kept: [], expired: [], confirmed: [] });
    expect(await readPending(store)).toEqual([]);
  });

  it('KEEPS an id whose delete failed, and tries it again next time', async () => {
    const { store } = fakeStore({ [PENDING_KEY]: [{ chatId: 'a', noticedAt: 1 }] });
    const first = await sweepPending(store, async () => false);
    expect(first).toEqual({ deleted: [], remaining: ['a'], kept: [], expired: [], confirmed: [] });
    expect(await readPending(store)).toEqual([{ chatId: 'a', noticedAt: 1 }]);

    const second = await sweepPending(store, async () => true);
    expect(second.deleted).toEqual(['a']);
    expect(await readPending(store)).toEqual([]);
  });

  it('keeps an id whose delete THREW, rather than counting it deleted', async () => {
    const { store } = fakeStore({ [PENDING_KEY]: [{ chatId: 'a', noticedAt: 1 }] });
    const result = await sweepPending(store, async () => {
      throw new Error('offline');
    });
    expect(result).toEqual({ deleted: [], remaining: ['a'], kept: [], expired: [], confirmed: [] });
    expect(await readPending(store)).toEqual([{ chatId: 'a', noticedAt: 1 }]);
  });

  it('forgets one by id when it was deleted from the panel instead', async () => {
    const { store } = fakeStore({ [PENDING_KEY]: [{ chatId: 'a', noticedAt: 1 }, { chatId: 'b', noticedAt: 2 }] });
    await clearPending(store, 'a');
    expect(await readPending(store)).toEqual([{ chatId: 'b', noticedAt: 2 }]);
  });

  it('NEVER sweeps a chat a panel is open on', async () => {
    // Measured in the walk: an id becomes pending when the chat is CREATED,
    // so without this a second panel opening swept the reading the first one
    // was still showing.
    const { store } = fakeStore({
      [PENDING_KEY]: [{ chatId: 'open', noticedAt: 1 }, { chatId: 'abandoned', noticedAt: 2 }],
    });
    const asked: string[] = [];
    const result = await sweepPending(
      store,
      async (id) => {
        asked.push(id);
        return true;
      },
      { inUse: new Set(['open']) },
    );
    expect(asked).toEqual(['abandoned']);
    expect(result).toEqual({ deleted: ['abandoned'], remaining: ['open'], kept: [], expired: [], confirmed: [] });
    // …and it is still owed, for when that panel closes
    expect(await readPending(store)).toEqual([{ chatId: 'open', noticedAt: 1 }]);
  });

  it('does nothing at all when nothing is owed', async () => {
    const { store, read } = fakeStore();
    const asked: string[] = [];
    const result = await sweepPending(store, async (id) => {
      asked.push(id);
      return true;
    });
    expect(asked).toEqual([]);
    expect(result).toEqual({ deleted: [], remaining: [], kept: [], expired: [], confirmed: [] });
    expect(read()[PENDING_KEY]).toEqual([]);
  });
});

describe('what the user is told about a sweep', () => {
  it('says nothing when nothing was deleted', () => {
    expect(sweepNotice({ deleted: [], remaining: [], kept: [], expired: [], confirmed: [] })).toBe('');
    expect(sweepNotice({ deleted: [], remaining: ['a'], kept: [], expired: [], confirmed: [] })).toBe('');
  });

  it('says so, in the singular and the plural, when something was', () => {
    expect(sweepNotice({ deleted: ['a'], remaining: [], kept: [], expired: [], confirmed: [] })).toBe(
      'The reading you left open was deleted just now.',
    );
    expect(sweepNotice({ deleted: ['a', 'b'], remaining: [], kept: [], expired: [], confirmed: [] })).toBe(
      '2 readings you left open were deleted just now.',
    );
  });

  it('never prints an id — it is not something a person can check', () => {
    const notice = sweepNotice({ deleted: ['chat-abc-123'], remaining: [], kept: [], expired: [], confirmed: [] });
    expect(notice).not.toContain('chat-abc-123');
  });
});

describe('the kept claim — durable, and the promise list is the authority', () => {
  /**
   * ITEM 6 RESIDUE. "This run was saved" lived in a `WeakSet` keyed by the
   * panel's port. An MV3 worker is torn down whenever Chrome likes, including
   * between the save POST and the turn returning — so the fact died with the
   * worker and the next panel open swept a conversation the user had kept.
   * It also was never cleared when the save turn came back EMPTY, so closing
   * the panel after a failed save left a stranger's details in a chat nothing
   * deleted. Both are answered here, in the one store the sweep reads.
   */
  it('claims a chat as kept, and the claim survives a re-read of the store', async () => {
    const { store } = fakeStore();
    await notePending(store, 'chat-1', 1);
    await claimKept(store, 'chat-1', 2);
    const pending = await readPending(store);
    expect(isKept(pending, 'chat-1')).toBe(true);
    expect(owedNow(pending, 'chat-1')).toBe(false);
    expect(pending).toEqual([{ chatId: 'chat-1', noticedAt: 1, state: KEPT_CLAIMED }]);
  });

  it('claims a chat nobody noted — the ordering holds even if the note was lost', async () => {
    const { store } = fakeStore();
    await claimKept(store, 'chat-9', 7);
    expect(isKept(await readPending(store), 'chat-9')).toBe(true);
  });

  it('releases the claim, and the chat is owed again', async () => {
    const { store } = fakeStore();
    await notePending(store, 'chat-1', 1);
    await claimKept(store, 'chat-1', 2);
    await releaseKept(store, 'chat-1');
    const pending = await readPending(store);
    expect(isKept(pending, 'chat-1')).toBe(false);
    expect(owedNow(pending, 'chat-1')).toBe(true);
    expect(pending).toEqual([{ chatId: 'chat-1', noticedAt: 1 }]);
  });

  it('a chat with NO record is never owed — the list is a promise list', async () => {
    // The per-match chats are never noted, and a saved reading's record is
    // cleared. Neither is anybody's to delete.
    expect(owedNow([], 'chat-anything')).toBe(false);
  });

  /**
   * A CLAIM IS BOUNDED, and it is resolved by ASKING rather than by age
   * alone (item 6, second residual).
   *
   * The first cut wrote a claimed record back unconditionally, so a worker
   * torn down between `claimKept` and the save resolving left an immortal
   * claim — and the unsaved reading's chat, carrying a third party's birth
   * details, was never deleted and the user never told.
   */
  const NOW = 1_700_000_000_000;
  const claimed = async (ageMs: number) => {
    const { store, read } = fakeStore();
    await notePending(store, 'claimed', NOW - ageMs);
    await claimKept(store, 'claimed', NOW - ageMs);
    return { store, read };
  };

  it('inside the grace, a claim waits — the save may still be in flight', async () => {
    const { store } = await claimed(CLAIM_GRACE_MS - 1);
    const asked: string[] = [];
    const result = await sweepPending(store, async (id) => {
      asked.push(id);
      return true;
    }, { now: NOW, savedSince: async () => false });
    expect(asked).toEqual([]);
    expect(result.kept).toEqual(['claimed']);
    expect(await readPending(store)).toEqual([
      { chatId: 'claimed', noticedAt: NOW - (CLAIM_GRACE_MS - 1), state: KEPT_CLAIMED },
    ]);
  });

  it('past the grace, an engine that says the save LANDED keeps the chat and drops the record', async () => {
    const { store } = await claimed(CLAIM_GRACE_MS + 1);
    const asked: string[] = [];
    const seen: number[] = [];
    const result = await sweepPending(store, async (id) => {
      asked.push(id);
      return true;
    }, {
      now: NOW,
      savedSince: async (noticedAt) => {
        seen.push(noticedAt);
        return true;
      },
    });
    expect(asked).toEqual([]);            // the chat is the user's — never deleted
    expect(result.confirmed).toEqual(['claimed']);
    expect(result.deleted).toEqual([]);
    expect(await readPending(store)).toEqual([]);   // and nothing owes it again
    expect(seen).toEqual([NOW - (CLAIM_GRACE_MS + 1)]);   // `noticedAt` is READ
  });

  it('past the grace, an engine that says NOTHING was stored deletes the chat', async () => {
    const { store } = await claimed(CLAIM_GRACE_MS + 1);
    const asked: string[] = [];
    const result = await sweepPending(store, async (id) => {
      asked.push(id);
      return true;
    }, { now: NOW, savedSince: async () => false });
    expect(asked).toEqual(['claimed']);
    expect(result.deleted).toEqual(['claimed']);
    expect(result.expired).toEqual([]);
    expect(await readPending(store)).toEqual([]);
  });

  it('an engine it could not ASK is not a "no" — the claim is kept and retried', async () => {
    for (const answer of [async () => null, async () => { throw new Error('offline'); }]) {
      const { store } = await claimed(CLAIM_GRACE_MS + 1);
      const asked: string[] = [];
      const result = await sweepPending(store, async (id) => {
        asked.push(id);
        return true;
      }, { now: NOW, savedSince: answer as () => Promise<boolean | null> });
      expect(asked).toEqual([]);
      expect(result.kept).toEqual(['claimed']);
      expect(await readPending(store)).toHaveLength(1);
    }
  });

  it('…and with NO engine to ask at all, it is still kept rather than deleted', async () => {
    const { store } = await claimed(CLAIM_GRACE_MS + 1);
    const asked: string[] = [];
    const result = await sweepPending(store, async (id) => {
      asked.push(id);
      return true;
    }, { now: NOW });
    expect(asked).toEqual([]);
    expect(result.kept).toEqual(['claimed']);
  });

  it('at the CEILING it is cleaned up whatever the engine says, and the user is told', async () => {
    const { store } = await claimed(CLAIM_CEILING_MS);
    const asked: string[] = [];
    let questions = 0;
    const result = await sweepPending(store, async (id) => {
      asked.push(id);
      return true;
    }, {
      now: NOW,
      savedSince: async () => {
        questions += 1;
        return null;
      },
    });
    expect(asked).toEqual(['claimed']);
    expect(questions).toBe(0);           // the ceiling does not need an answer
    expect(result.expired).toEqual(['claimed']);
    expect(result.deleted).toEqual(['claimed']);
    expect(await readPending(store)).toEqual([]);
    expect(sweepNotice(result)).toBe(
      'A reading that was waiting to be added to your matches could not be confirmed, so it was cleaned up.',
    );
  });

  it('a claim a panel is OPEN on is never touched, whatever its age', async () => {
    const { store } = await claimed(CLAIM_CEILING_MS);
    const asked: string[] = [];
    const result = await sweepPending(store, async (id) => {
      asked.push(id);
      return true;
    }, { now: NOW, inUse: new Set(['claimed']), savedSince: async () => false });
    expect(asked).toEqual([]);
    expect(result.remaining).toEqual(['claimed']);
    expect(await readPending(store)).toHaveLength(1);
  });

  it('a claim on one chat never protects another', async () => {
    const { store } = fakeStore();
    await notePending(store, 'kept', NOW);
    await notePending(store, 'owed', NOW);
    await claimKept(store, 'kept', NOW);
    const asked: string[] = [];
    const result = await sweepPending(store, async (id) => {
      asked.push(id);
      return true;
    }, { now: NOW, savedSince: async () => false });
    expect(asked).toEqual(['owed']);
    expect(result.deleted).toEqual(['owed']);
    expect(result.kept).toEqual(['kept']);
    expect(await readPending(store)).toEqual([
      { chatId: 'kept', noticedAt: NOW, state: KEPT_CLAIMED },
    ]);
  });

  it('a delete that FAILED leaves the claim owed rather than forgotten', async () => {
    const { store } = await claimed(CLAIM_GRACE_MS + 1);
    const result = await sweepPending(store, async () => false, {
      now: NOW,
      savedSince: async () => false,
    });
    expect(result.deleted).toEqual([]);
    expect(result.remaining).toEqual(['claimed']);
    expect(await readPending(store)).toHaveLength(1);
  });

  it('the grace and the ceiling are DERIVED, and stated', () => {
    // core's watchdogs: a 15 s POST ceiling, a 90 s TTFB, a 90 s idle window.
    expect(CLAIM_GRACE_MS).toBe(10 * 60_000);
    expect(CLAIM_GRACE_MS).toBeGreaterThan(4 * 90_000 + 15_000);
    expect(CLAIM_CEILING_MS).toBe(7 * 24 * 60 * 60_000);
    expect(CLAIM_CEILING_MS).toBeGreaterThan(CLAIM_GRACE_MS);
  });

  it('says nothing to the user about a claim it kept', async () => {
    expect(sweepNotice({ deleted: [], remaining: [], kept: ['kept'], expired: [], confirmed: [] })).toBe('');
  });

  it('a record with an unknown state is DROPPED, not treated as kept', () => {
    // Parse, don't trust: a future build's third state must not silently
    // become "never delete this".
    expect(parsePending([{ chatId: 'a', noticedAt: 1, state: 'something-else' }])).toEqual([]);
    expect(parsePending([{ chatId: 'a', noticedAt: 1, state: KEPT_CLAIMED }])).toEqual([
      { chatId: 'a', noticedAt: 1, state: KEPT_CLAIMED },
    ]);
    // …and an older build's two-key record still parses, as owed
    expect(parsePending([{ chatId: 'a', noticedAt: 1 }])).toEqual([{ chatId: 'a', noticedAt: 1 }]);
  });

  it('stores IDS and a state — nothing renderable, as ever', async () => {
    const { store } = fakeStore();
    await notePending(store, 'chat-1', 1);
    await claimKept(store, 'chat-1', 2);
    const written = JSON.stringify(await readPending(store));
    expect(written).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(written).not.toMatch(/[A-Z][a-z]+ [A-Z][a-z]+/);
  });
});
