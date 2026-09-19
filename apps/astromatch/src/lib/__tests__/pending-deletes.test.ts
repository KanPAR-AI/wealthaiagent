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
  PENDING_KEY,
  clearPending,
  notePending,
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
    expect(result).toEqual({ deleted: ['a', 'b'], remaining: [] });
    expect(await readPending(store)).toEqual([]);
  });

  it('KEEPS an id whose delete failed, and tries it again next time', async () => {
    const { store } = fakeStore({ [PENDING_KEY]: [{ chatId: 'a', noticedAt: 1 }] });
    const first = await sweepPending(store, async () => false);
    expect(first).toEqual({ deleted: [], remaining: ['a'] });
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
    expect(result).toEqual({ deleted: [], remaining: ['a'] });
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
      new Set(['open']),
    );
    expect(asked).toEqual(['abandoned']);
    expect(result).toEqual({ deleted: ['abandoned'], remaining: ['open'] });
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
    expect(result).toEqual({ deleted: [], remaining: [] });
    expect(read()[PENDING_KEY]).toEqual([]);
  });
});

describe('what the user is told about a sweep', () => {
  it('says nothing when nothing was deleted', () => {
    expect(sweepNotice({ deleted: [], remaining: [] })).toBe('');
    expect(sweepNotice({ deleted: [], remaining: ['a'] })).toBe('');
  });

  it('says so, in the singular and the plural, when something was', () => {
    expect(sweepNotice({ deleted: ['a'], remaining: [] })).toBe(
      'The reading you left open was deleted just now.',
    );
    expect(sweepNotice({ deleted: ['a', 'b'], remaining: [] })).toBe(
      '2 readings you left open were deleted just now.',
    );
  });

  it('never prints an id — it is not something a person can check', () => {
    const notice = sweepNotice({ deleted: ['chat-abc-123'], remaining: [] });
    expect(notice).not.toContain('chat-abc-123');
  });
});
