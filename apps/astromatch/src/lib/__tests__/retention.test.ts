/**
 * docs/73 B1 — what the panel may say about what is kept.
 *
 * The sentence this replaces was "the birth values you gave sit in this chat
 * for 24 hours", and it was false: 24 hours is the Redis slot TTL, while the
 * message carrying a third party's birth details is a Firestore document with
 * no TTL. The tests below pin the two properties that make the new sentences
 * safe — no claim the storage does not honour, and no silent failure.
 */

import {
  ENGINE_DELETE_REMOVES,
  SAVED_NOTHING_HEADLINE,
  needsDelete,
  retentionNotice,
  type DeleteOutcome,
} from '../retention-view';

const ALL: DeleteOutcome[] = [
  { kind: 'pending' },
  { kind: 'deleting' },
  { kind: 'deleted' },
  { kind: 'failed', reason: 'The server answered 500.' },
];

describe('every state says something, and none of them lies', () => {
  it.each(ALL.map((o) => [o.kind, o] as const))('%s has a headline and a detail', (_kind, outcome) => {
    const notice = retentionNotice(outcome);
    expect(notice.headline.length).toBeGreaterThan(10);
    expect(notice.detail.length).toBeGreaterThan(20);
  });

  it('NEVER claims a 24-hour expiry for the chat itself', () => {
    // The precise defect: "the birth values you gave sit in this chat for 24
    // hours". The only 24 hours in this system belongs to the Redis slot
    // envelope, and it is named as exactly that.
    for (const outcome of ALL) {
      const notice = retentionNotice(outcome);
      const text = `${notice.headline} ${notice.detail}`;
      expect(text).not.toMatch(/in this chat for 24/i);
      if (/24 hours/.test(text)) {
        expect(text).toMatch(/session store/i);
      }
    }
  });

  it('says nothing was saved BEFORE the delete, and promises the delete', () => {
    const notice = retentionNotice({ kind: 'pending' });
    expect(notice.headline).toBe(SAVED_NOTHING_HEADLINE);
    expect(notice.detail).toContain('No person was created');
    expect(notice.detail).toMatch(/will delete the conversation/i);
    expect(notice.retry).toBe(false);
  });

  it('states the delete as a FACT only once it happened', () => {
    const notice = retentionNotice({ kind: 'deleted' });
    expect(notice.headline).toMatch(/were deleted/i);
    expect(notice.detail).toMatch(/gone from your chat history/i);
    // the one residue that can outlive it, named honestly
    expect(notice.detail).toMatch(/session store clears within 24 hours/i);
  });

  it('says so, and offers a retry, when the delete FAILED', () => {
    const notice = retentionNotice({ kind: 'failed', reason: 'The server answered 500.' });
    expect(notice.tone).toBe('warn');
    expect(notice.retry).toBe(true);
    expect(notice.detail).toContain('The server answered 500.');
    expect(notice.detail).toMatch(/still in your chat history/i);
    // and it does NOT claim the details are gone
    expect(notice.headline).not.toMatch(/deleted\.$/);
  });

  it('never offers a retry where retrying is not the next step', () => {
    for (const outcome of ALL.filter((o) => o.kind !== 'failed')) {
      expect(retentionNotice(outcome).retry).toBe(false);
    }
  });
});

describe('which readings are deleted', () => {
  it('deletes an unsaved reading that got a chat', () => {
    expect(needsDelete('chat-1', false)).toBe(true);
  });

  it('never deletes one the user SAVED — it is theirs to keep', () => {
    expect(needsDelete('chat-1', true)).toBe(false);
  });

  it('does nothing when there is no chat to delete', () => {
    expect(needsDelete(null, false)).toBe(false);
    expect(needsDelete('', false)).toBe(false);
  });
});

describe('the claim is checked against a DECLARED contract, not a file read', () => {
  /**
   * F199, found by mutation in review: this block used to `readFileSync` a
   * path into `../../../../../../chatservice/services/chat_service.py` and,
   * on `catch`, `console.warn` and RETURN — green. `wealthaiagent` is its own
   * git repository, so in CI that file never exists and the test was
   * permanently vacuous: it would have passed if the delete had stopped
   * removing messages entirely.
   *
   * The contract is declared here instead, and pinned on the engine side by
   * `chatservice/tests/test_chat_delete_contract.py`. A client cannot verify
   * another repository's behaviour; what it CAN do is state what it believes
   * and make the sentences depend on it, so a change to either one is a
   * visible diff in both places.
   */
  it('the sentences claim nothing the contract does not include', () => {
    expect(ENGINE_DELETE_REMOVES.messages).toBe(true);
    expect(ENGINE_DELETE_REMOVES.slotEvents).toBe(true);
    expect(ENGINE_DELETE_REMOVES.chatDocument).toBe(true);
    // best-effort, which is exactly why the sentence says the working copy
    // "clears within 24 hours" rather than "is gone"
    expect(ENGINE_DELETE_REMOVES.redisSlots).toBe('best-effort');
    expect(ENGINE_DELETE_REMOVES.redisTtlHours).toBe(24);
  });

  it('claims NOTHING beyond the chat', () => {
    // The over-claim this replaced: "the birth details you typed are gone
    // from your account". The delete removes a CHAT. Anything else that read
    // the turn on its way past is not something this client can see, and a
    // sentence about it would be a promise made on somebody else's behalf.
    expect(ENGINE_DELETE_REMOVES.anythingElse).toBe(false);
    const detail = retentionNotice({ kind: 'deleted' }).detail;
    expect(detail).toContain('gone from your chat history');
    expect(detail).not.toMatch(/from your account/i);
    expect(detail).not.toMatch(/memory|memories|trace|log/i);
    expect(detail).not.toMatch(/everywhere|completely|permanently/i);
  });

  it('mentions the 24 hours only as the session store, and only where true', () => {
    for (const outcome of ALL) {
      const { headline, detail } = retentionNotice(outcome);
      const text = `${headline} ${detail}`;
      if (!/24 hours/.test(text)) continue;
      expect(outcome.kind).toBe('deleted');
      expect(text).toMatch(/session store/i);
    }
  });

  it('promises only the two things the panel can actually do', () => {
    // docs/73 B1, second half: the panel deletes on leave AND on close, and
    // sweeps on the next open when the browser took the moment away. It does
    // not promise anything about a browser that never opens again.
    const detail = retentionNotice({ kind: 'pending' }).detail;
    expect(detail).toMatch(/leave or close this panel/i);
    expect(detail).toMatch(/next time you open AstroMatch/i);
  });
});
