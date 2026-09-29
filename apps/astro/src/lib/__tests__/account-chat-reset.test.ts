/**
 * A different account forgets the remembered chat (E2 round 3, pre-existing
 * defect Role-3 found): `signOut` signs straight back in anonymously as a NEW
 * uid, and nothing forgot `astro.lastChatId`, so the new guest resumed the
 * previous account's conversation on the chat tab. Linking keeps the uid and
 * must forget nothing. `@wealthai/core`'s platform storage is replaced by a
 * double so the REAL `forgetChat` runs.
 */

const removed: string[] = [];
jest.mock('@wealthai/core', () => ({
  getPlatform: () => ({
    storage: {
      setItem: async () => undefined,
      getItem: async () => null,
      removeItem: async (k: string) => { removed.push(k); },
    },
  }),
}));

import { isDifferentAccount, watchAccountForChat } from '../chat-session';

type Emit = (a: { uid: string } | null) => void;

function harness() {
  let emit: Emit = () => undefined;
  const changes = jest.fn();
  const stop = watchAccountForChat((fn) => { emit = fn; return () => undefined; }, changes);
  return { emit: (a: { uid: string } | null) => emit(a), changes, stop };
}

beforeEach(() => { removed.length = 0; });

describe('isDifferentAccount', () => {
  it('A → B is a change', () => expect(isDifferentAccount('a', 'b')).toBe(true));
  it('A → A (a linked anonymous account keeps its uid) is not', () =>
    expect(isDifferentAccount('a', 'a')).toBe(false));
  it('a gap (null) is never a change, either way', () => {
    expect(isDifferentAccount(null, 'a')).toBe(false);
    expect(isDifferentAccount('a', null)).toBe(false);
    expect(isDifferentAccount(null, null)).toBe(false);
  });
});

describe('watchAccountForChat', () => {
  it('sign-out: Arun → (null) → a new guest forgets both remembered chats, once', () => {
    const h = harness();
    h.emit({ uid: 'google-arun' });
    h.emit(null);
    expect(removed).toEqual([]);
    h.emit({ uid: 'anon-new' });
    expect(removed.sort()).toEqual(['astro.lastChatId', 'astro.ownChatId']);
    expect(h.changes).toHaveBeenCalledTimes(1);
  });

  it('linking a guest (same uid, token refreshes) forgets nothing', () => {
    const h = harness();
    h.emit({ uid: 'anon-arun' });
    h.emit({ uid: 'anon-arun' });
    h.emit({ uid: 'anon-arun' });
    expect(removed).toEqual([]);
    expect(h.changes).not.toHaveBeenCalled();
  });

  it('a sign-in that SWAPS the uid (credential already in use) forgets', () => {
    const h = harness();
    h.emit({ uid: 'anon-kabir' });
    h.emit({ uid: 'google-kabir' });
    expect(h.changes).toHaveBeenCalledTimes(1);
    expect(removed).toContain('astro.lastChatId');
  });

  it('the first account of the app’s life is not a change', () => {
    const h = harness();
    h.emit({ uid: 'google-meera' });
    expect(removed).toEqual([]);
    expect(h.changes).not.toHaveBeenCalled();
  });
});
