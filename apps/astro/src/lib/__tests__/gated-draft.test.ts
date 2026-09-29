// Bug 29c19678 (Astral build 13, 2026-09-18): "Entered birth details then it
// asked to sign in to receive readings but after signing in the birth details
// were gone." The rules that stop a gated turn from being thrown away — and
// from being fired somewhere it does not belong — pinned, plus the source pins
// that hold the screens to them (a screen is a `.tsx` importing react-native,
// which this root project cannot mount).
//
// The carriers are built by the REAL builder (`buildInputResponseMessage`)
// from the engine's CAPTURED asks (`@wealthai/astral/fixtures`), so the keys
// on the wire are the engine's (dob / tob / pob), not names imagined here.

import fs from 'fs';
import path from 'path';

import { buildInputResponseMessage, type InputRequestPayload } from '@wealthai/astral';
import {
  birthDetailsAskPayload,
  correctionAskPayload,
  palmHandednessAskPayload,
  placeChoiceAskPayload,
} from '@wealthai/astral/fixtures';

import {
  applyEviction,
  applyRelease,
  GATED_SUBMIT_LINE,
  carriesInputResponse,
  chatDraft,
  chatReleaser,
  createDraftSlot,
  createReleaser,
  discardLine,
  DRAFT_CAP,
  DRAFT_TTL_MS,
  gateStep,
  HELD_LINE,
  portableAcrossAccounts,
  releaseAction,
  type ParkedDraft,
  type ReleaseState,
} from '../gated-draft';

const ask = (p: unknown) => p as InputRequestPayload;

/** Arun's own first-time birth facts, answered on the engine's own ask. */
const BIRTH = buildInputResponseMessage(ask(birthDetailsAskPayload), {
  dob: '1994-03-11', tob: '06:40', pob: 'Pune',
});
/** A correction's "I don't know" — bound to the record it corrects. */
const CORRECTION = buildInputResponseMessage(ask(correctionAskPayload), { tob: null });
/** Which Pune — an answer to THIS account's contested place. */
const PLACE_CHOICE = buildInputResponseMessage(ask(placeChoiceAskPayload), {
  pob: 'Springfield, MO, United States',
});
/** A palm answer — bound to this account's uploaded files. */
const PALM = buildInputResponseMessage(ask(palmHandednessAskPayload), {
  [ask(palmHandednessAskPayload).fields[0].key]: 'right',
});
/** A partner's facts on the self ask's name — keys outside the self set. */
const PARTNER = buildInputResponseMessage(
  { ...ask(birthDetailsAskPayload),
    fields: [{ key: 'person2_dob', kind: 'date', label: 'Their date of birth', required: true }] } as InputRequestPayload,
  { person2_dob: '1996-07-02' },
);
/** The whose-details answer — names a person on THIS account. */
const WHOSE = buildInputResponseMessage(
  { type: 'input_request', ask: 'whose_details', reason: '',
    fields: [{ key: 'whose_details', kind: 'choice', label: 'Whose details?', required: true,
      options: [{ value: 'person:meera-1', label: 'Meera' }] }] } as unknown as InputRequestPayload,
  { whose_details: 'person:meera-1' },
);
const TEXT = 'I was born on 11 March 1994 at 6:40 am in Pune';

const T0 = 1_800_000_000_000;
const draft = (over: Partial<ParkedDraft> = {}): ParkedDraft => ({
  message: BIRTH, files: [], uid: 'anon-arun', parkedAt: T0, ...over,
});
const ready = (over: Partial<ReleaseState> = {}): ReleaseState => ({
  resolved: true, blocked: false, uid: 'anon-arun', chatId: 'c1',
  focused: true, busy: false, at: T0 + 1000, ...over,
});

describe('the fixtures are what they claim (anti-vacuity)', () => {
  it('the birth carrier uses the engine keys dob/tob/pob on required_slots_missing', () => {
    const body = JSON.parse(BIRTH.split('```input_response\n')[1].split('```')[0]);
    expect(body.ask).toBe('required_slots_missing');
    expect(Object.keys(body.values).sort()).toEqual(['dob', 'pob', 'tob']);
  });
  it('every carrier is recognised as one; plain text is not', () => {
    for (const m of [BIRTH, CORRECTION, PLACE_CHOICE, PALM, PARTNER, WHOSE]) {
      expect(carriesInputResponse(m)).toBe(true);
    }
    expect(carriesInputResponse(TEXT)).toBe(false);
  });
});

describe('createDraftSlot — a FIFO; nothing parked is overwritten', () => {
  it('holds exactly what was parked', () => {
    const slot = createDraftSlot();
    expect(slot.park(draft())).toEqual({ kept: true, evicted: null });
    expect(slot.peek()).toEqual({ message: BIRTH, files: [], uid: 'anon-arun', parkedAt: T0 });
  });

  it('B1: carrier then "hello?" — the carrier comes out first, then the text', () => {
    const slot = createDraftSlot();
    slot.park(draft());
    slot.park(draft({ message: 'hello?' }));
    expect(slot.size()).toBe(2);
    expect(slot.take()?.message).toBe(BIRTH);
    expect(slot.take()?.message).toBe('hello?');
    expect(slot.take()).toBeNull();
  });

  it('take empties one at a time; peek does not remove', () => {
    const slot = createDraftSlot();
    slot.park(draft());
    expect(slot.peek()?.message).toBe(BIRTH);
    expect(slot.size()).toBe(1);
    slot.take();
    expect(slot.peek()).toBeNull();
    expect(slot.size()).toBe(0);
  });

  it(`is capped at ${DRAFT_CAP}; when full the oldest PLAIN turn goes — and is RETURNED`, () => {
    const slot = createDraftSlot();
    slot.park(draft());                               // the carrier
    slot.park(draft({ message: 'one' }));
    slot.park(draft({ message: 'two' }));
    const r = slot.park(draft({ message: 'three' }));
    expect(r.kept).toBe(true);
    expect(r.evicted?.message).toBe('one');
    expect(slot.size()).toBe(DRAFT_CAP);
    expect(slot.take()?.message).toBe(BIRTH);
    expect(slot.take()?.message).toBe('two');
    expect(slot.take()?.message).toBe('three');
  });

  // RULE CHANGE (Role-3, E2 round 3): this used to pin a SILENT eviction —
  // park returned true and the dropped answer vanished. The oldest answer
  // still goes, but it is now returned so the caller voices it.
  it('full of form answers only: the oldest is evicted and RETURNED, never silently lost', () => {
    const slot = createDraftSlot();
    expect(slot.park(draft({ message: CORRECTION })).evicted).toBeNull();
    slot.park(draft({ message: PALM }));
    slot.park(draft({ message: WHOSE }));
    const r = slot.park(draft({ message: BIRTH }));
    expect(r).toEqual({ kept: true, evicted: draft({ message: CORRECTION }) });
    expect(slot.size()).toBe(DRAFT_CAP);
    expect(slot.take()?.message).toBe(PALM);
  });

  it('a blank turn is not parked (the composer never sends one either)', () => {
    const slot = createDraftSlot();
    expect(slot.park(draft({ message: '   ' }))).toEqual({ kept: false, evicted: null });
    expect(slot.size()).toBe(0);
  });

  it('a blank message WITH an attachment is still kept', () => {
    const slot = createDraftSlot();
    slot.park(draft({ message: '', files: [{ name: 'palm.jpg' }] }));
    expect(slot.peek()?.files).toHaveLength(1);
  });

  it('a parked turn is a copy — mutating the caller’s array does not reach it', () => {
    const slot = createDraftSlot();
    const files: unknown[] = [{ name: 'a' }];
    slot.park(draft({ files }));
    files.push({ name: 'b' });
    expect(slot.peek()?.files).toHaveLength(1);
  });

  it('clear drops everything; two slots share nothing', () => {
    const a = createDraftSlot();
    const b = createDraftSlot();
    a.park(draft());
    expect(b.size()).toBe(0);
    a.clear();
    expect(a.size()).toBe(0);
  });

  // RULE CHANGE (E2 round 3): no form answer survives a swap — not even the
  // birth answer, which round 2 let through. Plain text is re-stamped.
  it('rehome keeps ONLY plain text (re-stamped) and drops every form answer, the birth answer included', () => {
    const slot = createDraftSlot();
    slot.park(draft());                                   // the birth answer — dropped
    slot.park(draft({ message: CORRECTION }));            // dropped
    slot.park(draft({ message: TEXT }));                  // kept
    expect(slot.rehome('google-arun')).toBe(2);
    expect(slot.take()).toEqual(draft({ message: TEXT, uid: 'google-arun' }));
    expect(slot.size()).toBe(0);
  });

  // RULE CHANGE (E2 round 3): a turn parked before any account reported
  // (uid null) is treated as another account's — nobody can say whose ask it
  // answered — so an answer typed then is dropped; one already typed under
  // the new account is kept.
  it('rehome keeps an answer typed under the NEW account, drops one parked with no account', () => {
    const slot = createDraftSlot();
    slot.park(draft({ message: WHOSE, uid: 'google-arun' }));
    slot.park(draft({ message: PALM, uid: null }));
    slot.park(draft({ message: TEXT, uid: null }));
    expect(slot.rehome('google-arun')).toBe(1);
    expect(slot.take()?.message).toBe(WHOSE);
    expect(slot.take()).toEqual(draft({ message: TEXT, uid: 'google-arun' }));
  });

  it('the chat screen’s slot is a real slot', () => {
    chatDraft.clear();
    chatDraft.park(draft());
    expect(chatDraft.take()?.message).toBe(BIRTH);
    expect(chatDraft.size()).toBe(0);
  });
});

// RULE CHANGE (Role-3, E2 round 3). Round 2 let a `required_slots_missing`
// answer with dob/tob/pob cross a swap. It must not: a guest never receives an
// engine ask, so any answer parked before a swap answered ANOTHER account's
// ask, and the engine writes it dated now, beating the new account's record
// (and a declined `tob: null` would set a pending time ask). Plain text only.
describe('portableAcrossAccounts — B3: ONLY plain text survives a swap; no form answer does', () => {
  it('plain text: portable', () => {
    expect(portableAcrossAccounts(TEXT)).toBe(true);
  });
  it('the birth answer on required_slots_missing with dob/tob/pob: NOT portable (rule change)', () => {
    expect(portableAcrossAccounts(BIRTH)).toBe(false);
  });
  it('…with birth_time_confidence, or a declined time (tob: null): NOT portable (rule change)', () => {
    const withConfidence = buildInputResponseMessage(ask(birthDetailsAskPayload), {
      dob: '1994-03-11', tob: '06:40', pob: 'Pune', birth_time_confidence: 'exact',
    });
    const declined = buildInputResponseMessage(ask(birthDetailsAskPayload), {
      dob: '1994-03-11', tob: null, pob: 'Pune',
    });
    expect(portableAcrossAccounts(withConfidence)).toBe(false);
    expect(portableAcrossAccounts(declined)).toBe(false);
  });
  it('a correction (even its "I don\'t know"): NOT portable', () => {
    expect(portableAcrossAccounts(CORRECTION)).toBe(false);
  });
  it('whose_details naming a person on the old account: NOT portable', () => {
    expect(portableAcrossAccounts(WHOSE)).toBe(false);
  });
  it('a partner key (person2_*) even on required_slots_missing: NOT portable', () => {
    expect(portableAcrossAccounts(PARTNER)).toBe(false);
  });
  it('a palm answer and a place choice: NOT portable', () => {
    expect(portableAcrossAccounts(PALM)).toBe(false);
    expect(portableAcrossAccounts(PLACE_CHOICE)).toBe(false);
  });
  it('an unreadable carrier cannot be vouched for: NOT portable', () => {
    expect(portableAcrossAccounts('x\n\n```input_response\n{not json\n```')).toBe(false);
    expect(portableAcrossAccounts('```input_response\n{"type":"input_response","ask":"required_slots_missing","values":[]}\n```')).toBe(false);
    expect(portableAcrossAccounts('```input_response\n{"ask":"required_slots_missing"}\n```')).toBe(false);
    expect(portableAcrossAccounts('```input_response\n{"ask":"required_slots_missing","values":{"dob":"1994-03-11"}')).toBe(false);
  });
});

describe('gateStep — the form is never drawn for a guest to type into', () => {
  it('auth unresolved: wait', () => {
    expect(gateStep({ resolved: false, blocked: true, prompted: false })).toBe('wait');
    expect(gateStep({ resolved: false, blocked: false, prompted: false })).toBe('wait');
  });
  it('a signed-in account proceeds', () => {
    expect(gateStep({ resolved: true, blocked: false, prompted: false })).toBe('proceed');
    expect(gateStep({ resolved: true, blocked: false, prompted: true })).toBe('proceed');
  });
  it('a guest is sent to the gate once', () => {
    expect(gateStep({ resolved: true, blocked: true, prompted: false })).toBe('prompt');
  });
  it('a guest who came back without signing in sees the card — no re-push loop', () => {
    expect(gateStep({ resolved: true, blocked: true, prompted: true })).toBe('card');
  });
  it('only `proceed` lets the screen ask the engine', () => {
    for (const resolved of [true, false]) {
      for (const blocked of [true, false]) {
        for (const prompted of [true, false]) {
          expect(gateStep({ resolved, blocked, prompted }) === 'proceed').toBe(resolved && !blocked);
        }
      }
    }
  });
});

describe('releaseAction — nothing before sign-in, nothing unseen, nothing stale', () => {
  it('nothing parked: none', () => {
    expect(releaseAction(null, ready())).toEqual({ kind: 'none' });
  });
  it('still a guest: hold — the facts do not reach the engine', () => {
    expect(releaseAction(draft(), ready({ blocked: true }))).toEqual({ kind: 'hold' });
  });
  it('auth unresolved: hold', () => {
    expect(releaseAction(draft(), ready({ resolved: false }))).toEqual({ kind: 'hold' });
  });
  it('B2: the surface is not focused (a hidden tab): hold', () => {
    expect(releaseAction(draft(), ready({ focused: false }))).toEqual({ kind: 'hold' });
  });
  it('a send already in flight: hold', () => {
    expect(releaseAction(draft(), ready({ busy: true }))).toEqual({ kind: 'hold' });
  });
  it('B2: older than the TTL: discard as stale — even while still gated or hidden', () => {
    const late = T0 + DRAFT_TTL_MS + 1;
    const stale = { kind: 'discard', reason: 'stale' };
    expect(releaseAction(draft(), ready({ at: late }))).toEqual(stale);
    expect(releaseAction(draft(), ready({ at: late, blocked: true }))).toEqual(stale);
    expect(releaseAction(draft(), ready({ at: late, focused: false }))).toEqual(stale);
  });
  it('B2: exactly at the TTL still sends', () => {
    const d = draft();
    expect(releaseAction(d, ready({ at: T0 + DRAFT_TTL_MS }))).toEqual({ kind: 'send', draft: d });
  });
  it('signed in on the SAME uid (the anonymous account was linked): send, unchanged', () => {
    const d = draft();
    expect(releaseAction(d, ready())).toEqual({ kind: 'send', draft: d });
  });
  it('no chat yet: send (the send creates the chat)', () => {
    const d = draft();
    expect(releaseAction(d, ready({ chatId: null }))).toEqual({ kind: 'send', draft: d });
  });
  it('the uid SWAPPED with a chat open: swap and leave', () => {
    expect(releaseAction(draft(), ready({ uid: 'google-arun' })))
      .toEqual({ kind: 'swap', uid: 'google-arun', leave: true });
  });
  it('the uid swapped with no chat open: swap, nothing to leave', () => {
    expect(releaseAction(draft(), ready({ uid: 'google-arun', chatId: null })))
      .toEqual({ kind: 'swap', uid: 'google-arun', leave: false });
  });
  // RULE CHANGE (E2 round 3): a turn parked before any account reported
  // takes the swap path, so a form answer typed then can never be sent into
  // whichever account happens to sign in.
  it('parked before any account reported (uid null): the conservative swap path', () => {
    expect(releaseAction(draft({ uid: null }), ready({ uid: 'google-arun' })))
      .toEqual({ kind: 'swap', uid: 'google-arun', leave: true });
    expect(releaseAction(draft({ uid: null }), ready({ uid: 'google-arun', chatId: null })))
      .toEqual({ kind: 'swap', uid: 'google-arun', leave: false });
  });
  it('still no account reported: hold, never a swap to nobody', () => {
    expect(releaseAction(draft({ uid: null }), ready({ uid: null, resolved: false })))
      .toEqual({ kind: 'hold' });
  });
});

describe('applyRelease — the order is drop, say so, leave, send', () => {
  const ops = () => {
    const calls: string[] = [];
    return {
      calls,
      send: (m: string) => { calls.push(`send:${m === BIRTH ? 'BIRTH' : m}`); },
      leaveChat: () => { calls.push('leave'); },
      notify: (l: string) => { calls.push(`notify:${l}`); },
      restore: (m: string) => { calls.push(`restore:${m}`); },
    };
  };

  it('a stale ANSWER is discarded with a line that says it cannot be re-sent', () => {
    const slot = createDraftSlot();
    slot.park(draft());
    const o = ops();
    expect(applyRelease({ kind: 'discard', reason: 'stale' }, slot, o)).toBeNull();
    expect(slot.size()).toBe(0);
    expect(o.calls).toEqual([`notify:${discardLine('stale', 'answer')}`]);
  });

  it('stale plain TEXT goes back in the composer, and the line says so', () => {
    const slot = createDraftSlot();
    slot.park(draft({ message: TEXT }));
    const o = ops();
    applyRelease({ kind: 'discard', reason: 'stale' }, slot, o);
    expect(o.calls).toEqual([`restore:${TEXT}`, `notify:${discardLine('stale', 'restored')}`]);
  });

  it('stale plain text with NO composer (birth-details): asked to type it again', () => {
    const slot = createDraftSlot();
    slot.park(draft({ message: TEXT }));
    const o = ops();
    applyRelease({ kind: 'discard', reason: 'stale' }, slot, { ...o, restore: undefined });
    expect(o.calls).toEqual([`notify:${discardLine('stale', 'text')}`]);
  });

  it('B3: swap with an account-bound answer drops it, says so, and leaves the old chat', () => {
    const slot = createDraftSlot();
    slot.park(draft({ message: CORRECTION }));
    slot.park(draft({ message: TEXT }));
    const o = ops();
    applyRelease({ kind: 'swap', uid: 'google-arun', leave: true }, slot, o);
    expect(o.calls).toEqual([`notify:${discardLine('other_account', 'answer')}`, 'leave']);
    expect(slot.size()).toBe(1);
    expect(slot.peek()).toEqual(draft({ message: TEXT, uid: 'google-arun' }));
  });

  it('B3: swap with only plain text: no line, leave, keep it', () => {
    const slot = createDraftSlot();
    slot.park(draft({ message: TEXT }));
    const o = ops();
    applyRelease({ kind: 'swap', uid: 'google-arun', leave: true }, slot, o);
    expect(o.calls).toEqual(['leave']);
    expect(slot.size()).toBe(1);
  });

  it('swap without an open chat does not leave anything', () => {
    const slot = createDraftSlot();
    slot.park(draft({ message: TEXT }));
    const o = ops();
    applyRelease({ kind: 'swap', uid: 'google-arun', leave: false }, slot, o);
    expect(o.calls).toEqual([]);
  });

  it('send takes the oldest and sends it verbatim', async () => {
    const slot = createDraftSlot();
    slot.park(draft());
    slot.park(draft({ message: 'hello?' }));
    const o = ops();
    const p = applyRelease({ kind: 'send', draft: draft() }, slot, o);
    await p;
    expect(o.calls).toEqual(['send:BIRTH']);
    expect(slot.peek()?.message).toBe('hello?');
  });

  it('hold and none touch nothing', () => {
    const slot = createDraftSlot();
    slot.park(draft());
    const o = ops();
    expect(applyRelease({ kind: 'hold' }, slot, o)).toBeNull();
    expect(applyRelease({ kind: 'none' }, slot, o)).toBeNull();
    expect(o.calls).toEqual([]);
    expect(slot.size()).toBe(1);
  });

  it('the lines are distinct, visible sentences that say what became of the words', () => {
    expect(discardLine('other_account', 'answer')).toMatch(/different account/);
    expect(discardLine('stale', 'answer')).not.toBe(discardLine('other_account', 'answer'));
    expect(discardLine('stale', 'answer')).toMatch(/asked again/);
    expect(discardLine('stale', 'restored')).toMatch(/back in the box/);
    expect(discardLine('overflow', 'answer')).toMatch(/only three/i);
    expect(discardLine('stale', 'text')).toMatch(/type it again/);
    const all = (['stale', 'other_account', 'before_sign_in', 'overflow'] as const).flatMap((r) =>
      (['restored', 'text', 'answer'] as const).map((f) => discardLine(r, f)));
    expect(new Set(all).size).toBe(all.length);
    expect(HELD_LINE).toMatch(/sign in/i);
    expect(GATED_SUBMIT_LINE).toMatch(/not sent/i);
  });
});

describe('the swap line says WHY (Role-3, E2 round 4)', () => {
  const ops = () => ({ send: jest.fn(), leaveChat: jest.fn(), notify: jest.fn() });
  it('an answer parked before any account reported: "before you were signed in", not "a different account"', () => {
    const slot = createDraftSlot();
    slot.park(draft({ uid: null }));
    const o = ops();
    applyRelease({ kind: 'swap', uid: 'google-arun', leave: false }, slot, o);
    expect(o.notify).toHaveBeenCalledTimes(1);
    expect(o.notify).toHaveBeenCalledWith(discardLine('before_sign_in', 'answer'));
    expect(discardLine('before_sign_in', 'answer')).toMatch(/before you were signed in/);
    expect(discardLine('before_sign_in', 'answer')).not.toMatch(/different account/);
  });
  it('an answer typed under another account: "a different account"', () => {
    const slot = createDraftSlot();
    slot.park(draft({ uid: 'anon-arun' }));
    const o = ops();
    applyRelease({ kind: 'swap', uid: 'google-arun', leave: false }, slot, o);
    expect(o.notify).toHaveBeenCalledWith(discardLine('other_account', 'answer'));
    expect(o.notify).toHaveBeenCalledTimes(1);
  });
  it('both kinds in one queue: both lines, once each', () => {
    const slot = createDraftSlot();
    slot.park(draft({ uid: null }));
    slot.park(draft({ uid: 'anon-arun', message: CORRECTION }));
    const o = ops();
    applyRelease({ kind: 'swap', uid: 'google-arun', leave: false }, slot, o);
    expect(o.notify.mock.calls.map((c) => c[0])).toEqual([
      discardLine('other_account', 'answer'), discardLine('before_sign_in', 'answer'),
    ]);
  });
  it('rehomeDetail counts by cause; rehome is their sum', () => {
    const slot = createDraftSlot();
    slot.park(draft({ uid: null }));
    slot.park(draft({ uid: 'anon-arun', message: PALM }));
    slot.park(draft({ uid: 'anon-arun', message: TEXT }));
    expect(slot.rehomeDetail('google-arun')).toEqual({ otherAccount: 1, beforeSignIn: 1 });
    expect(slot.size()).toBe(1);
  });
});

describe('applyEviction — a dropped turn is always voiced (Role-3, E2 round 3)', () => {
  it('nothing dropped: nothing said', () => {
    const notify = jest.fn();
    expect(applyEviction(null, 'overflow', { notify })).toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });
  it('an evicted ANSWER is voiced as an answer', () => {
    const notify = jest.fn();
    const restore = jest.fn();
    expect(applyEviction(draft(), 'overflow', { notify, restore })).toBe(true);
    expect(notify).toHaveBeenCalledWith(discardLine('overflow', 'answer'));
    expect(restore).not.toHaveBeenCalled();
  });
  it('evicted plain text goes back to the composer when there is one', () => {
    const notify = jest.fn();
    const restore = jest.fn();
    applyEviction(draft({ message: TEXT }), 'overflow', { notify, restore });
    expect(restore).toHaveBeenCalledWith(TEXT);
    expect(notify).toHaveBeenCalledWith(discardLine('overflow', 'restored'));
  });
  it('a fourth answer into a full queue: the caller has something to say', () => {
    const slot = createDraftSlot();
    const notify = jest.fn();
    slot.park(draft({ message: CORRECTION }));
    slot.park(draft({ message: PALM }));
    slot.park(draft({ message: WHOSE }));
    const r = slot.park(draft());
    applyEviction(r.evicted, 'overflow', { notify });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(discardLine('overflow', 'answer'));
  });
});

describe('createReleaser — one send at a time, oldest first, into the right chat', () => {
  /** A fake screen: a chat id the first send creates, sends that settle when told. */
  function harness(slot = createDraftSlot()) {
    const releaser = createReleaser(slot);
    const sent: Array<{ message: string; chatId: string | null }> = [];
    const pending: Array<() => void> = [];
    const notices: string[] = [];
    let chatId: string | null = null;
    let reruns = 0;
    const step = (over: Partial<ReleaseState> = {}) => releaser.step(
      ready({ chatId, ...over }),
      {
        send: (message) => {
          sent.push({ message, chatId });
          return new Promise<void>((resolve) => {
            pending.push(() => {
              if (chatId === null) chatId = 'new-chat';
              resolve();
            });
          });
        },
        leaveChat: () => { chatId = null; },
        notify: (l) => { notices.push(l); },
        settled: () => { reruns += 1; },
      },
    );
    const settle = async () => {
      pending.shift()?.();
      await Promise.resolve();
      await Promise.resolve();
    };
    return {
      slot, releaser, sent, notices, step, settle,
      setChat: (id: string | null) => { chatId = id; },
      reruns: () => reruns,
    };
  }

  it('B1: carrier then text — both go, in order, the second into the chat the first made', async () => {
    const h = harness();
    h.slot.park(draft());
    h.slot.park(draft({ message: 'hello?' }));
    expect(h.step().kind).toBe('send');
    // re-renders while the first is in flight (isSending not yet true — the
    // lifecycle awaits the token first): the releaser still holds
    expect(h.step().kind).toBe('hold');
    expect(h.step({ busy: false }).kind).toBe('hold');
    expect(h.releaser.inFlight()).toBe(true);
    await h.settle();
    expect(h.reruns()).toBe(1);
    expect(h.releaser.inFlight()).toBe(false);
    expect(h.step().kind).toBe('send');
    await h.settle();
    expect(h.sent).toEqual([
      { message: BIRTH, chatId: null },
      { message: 'hello?', chatId: 'new-chat' },
    ]);
    expect(h.step().kind).toBe('none');
  });

  it('a failed send still releases the next (its own lifecycle shows the failure)', async () => {
    const slot = createDraftSlot();
    const releaser = createReleaser(slot);
    slot.park(draft());
    slot.park(draft({ message: 'hello?' }));
    let rerun = 0;
    const ops = {
      send: () => Promise.reject(new Error('network')),
      leaveChat: () => undefined,
      notify: () => undefined,
      settled: () => { rerun += 1; },
    };
    releaser.step(ready(), ops);
    await Promise.resolve();
    await Promise.resolve();
    expect(rerun).toBe(1);
    expect(releaser.inFlight()).toBe(false);
    expect(slot.peek()?.message).toBe('hello?');
  });

  it('B3 end to end: swap drops the birth answer AND the correction with one line, then the text goes to a fresh chat', async () => {
    const h = harness();
    h.setChat('old-account-chat');
    h.slot.park(draft());
    h.slot.park(draft({ message: CORRECTION }));
    h.slot.park(draft({ message: TEXT }));
    expect(h.step({ uid: 'google-arun' }).kind).toBe('swap');
    expect(h.notices).toEqual([discardLine('other_account', 'answer')]);
    expect(h.step({ uid: 'google-arun' }).kind).toBe('send');
    await h.settle();
    expect(h.sent).toEqual([{ message: TEXT, chatId: null }]);
  });

  it('B2 end to end: parked, the user leaves the tab, signs in, comes back late — nothing sent, a line shown', () => {
    const h = harness();
    h.slot.park(draft());
    expect(h.step({ focused: false }).kind).toBe('hold');
    expect(h.step({ focused: true, at: T0 + DRAFT_TTL_MS + 5 }).kind).toBe('discard');
    expect(h.sent).toEqual([]);
    expect(h.notices).toEqual([discardLine('stale', 'answer')]);
  });

  it('the chat screen’s releaser drives the chat screen’s slot', () => {
    chatDraft.clear();
    chatDraft.park(draft());
    const a = chatReleaser.step(ready({ blocked: true }), {
      send: () => undefined, leaveChat: () => undefined, notify: () => undefined, settled: () => undefined,
    });
    expect(a.kind).toBe('hold');
    expect(chatDraft.size()).toBe(1);
    chatDraft.clear();
  });
});

// ── the screens hold to the rules ─────────────────────────────────────────
// Comments stripped first: a comment explaining the old bug must not be what
// satisfies (or trips) a pin.

const APP = path.join(__dirname, '..', '..');
const codeOf = (rel: string) =>
  fs
    .readFileSync(path.join(APP, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

/**
 * The dependency list of the effect whose body contains `marker`. Role-3,
 * E2 round 3 (R2/R3): after signing in with the gate on top, the ONLY thing
 * that changes when the user comes back is focus — an effect that does not
 * list `focused` would leave the parked turn waiting for the time limit.
 */
function effectDeps(code: string, marker: string): string[] {
  const at = code.indexOf(marker);
  if (at < 0) throw new Error(`marker not found: ${marker}`);
  const open = code.indexOf('}, [', at);
  const close = code.indexOf(']);', open);
  return code.slice(open + 4, close).split(',').map((d) => d.trim()).filter(Boolean);
}

function appFiles(dir = path.join(APP, 'app'), out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) appFiles(full, out);
    else if (/\.tsx?$/.test(e.name)) out.push(path.relative(APP, full));
  }
  return out;
}

describe('B4: no screen replaces itself with the sign-in gate', () => {
  const files = appFiles();
  it('found the screens (anti-vacuity)', () => {
    expect(files).toEqual(expect.arrayContaining([
      path.join('app', 'birth-details.tsx'), path.join('app', 'palm.tsx'),
      path.join('app', 'muhurta.tsx'), path.join('app', '(tabs)', 'chat.tsx'),
    ]));
  });
  it("no `router.replace('/sign-in')` anywhere under src/app", () => {
    const offenders = files.filter((f) =>
      /router\.replace\(\s*(['"`])\/sign-in\1/.test(codeOf(f))
      || /router\.replace\(\s*\{\s*pathname:\s*(['"`])\/sign-in\1/.test(codeOf(f)));
    expect(offenders).toEqual([]);
  });
});

describe('the gated screens send nothing unless the gate says proceed', () => {
  for (const f of ['birth-details.tsx', 'palm.tsx', 'muhurta.tsx']) {
    it(`${f} takes its gate from useReadingGate and shows the card`, () => {
      const code = codeOf(path.join('app', f));
      expect(code).toMatch(/useReadingGate\(\)/);
      expect(code).toMatch(/gate === 'card' \? <SignInGateCard( dark)? \/> : null/);
      expect(code).not.toMatch(/useReadingBlocked\(/);
    });
  }

  it('birth-details: adoption and the opening turn wait for the gate', () => {
    const code = codeOf(path.join('app', 'birth-details.tsx'));
    expect(code).toContain('if (adopted || !mayRead) return;');
    expect(code).toContain('if (started.current || !adopted || !mayRead) return;');
  });

  it('birth-details: a gated Continue is parked with its time, an eviction is VOICED, then the gate opens', () => {
    const code = codeOf(path.join('app', 'birth-details.tsx'));
    expect(code).toMatch(/if \(readingGated\) \{\s*const kept = parked\.park\(\{ message, files: \[\], uid, parkedAt: Date\.now\(\) \}\);\s*if \(kept\.kept\) setDraftNotice\(null\);\s*applyEviction\(kept\.evicted, 'overflow', \{ notify: setDraftNotice \}\);\s*setDraftTick\(\(n\) => n \+ 1\);\s*openGate\(\);\s*return;/);
  });

  it('birth-details: the release effect lists focus and the tick, and re-ticks after a step (R2/R3/R4)', () => {
    const code = codeOf(path.join('app', 'birth-details.tsx'));
    const deps = effectDeps(code, 'releaser.step(');
    expect(deps).toEqual(expect.arrayContaining(['focused', 'draftTick', 'authResolved', 'readingGated', 'uid', 'casting', 'handOff']));
    expect(code).toMatch(/settled: \(\) => setDraftTick\(\(n\) => n \+ 1\),\s*\}\);\s*if \(action\.kind !== 'none' && action\.kind !== 'hold'\) setDraftTick\(\(n\) => n \+ 1\);/);
  });

  it('birth-details: the release is the releaser, with focus, and leaving drops the chat id', () => {
    const code = codeOf(path.join('app', 'birth-details.tsx'));
    expect(code).toMatch(/releaser\.step\(\{[\s\S]{0,200}focused, busy: casting, at: Date\.now\(\)/);
    expect(code).toMatch(/leaveChat: \(\) => \{\s*chatIdRef\.current = null;\s*setChatId\(null\);\s*\}/);
    expect(code).toMatch(/send: \(message\) => handOff\(message\)/);
  });

  it('birth-details: a parked turn shows the held line; a discard shows its line', () => {
    const code = codeOf(path.join('app', 'birth-details.tsx'));
    expect(code).toContain('{parked.size() > 0 ? <Text style={s.subtitle}>{HELD_LINE}</Text> : null}');
    expect(code).toContain('notify: setDraftNotice');
    expect(code).toMatch(/\{draftNotice \? \(/);
  });

  it('palm: adoption, begin and submit all return early unless mayRead', () => {
    const code = codeOf(path.join('app', 'palm.tsx'));
    expect(code).toContain('if (adopting.current || !mayRead) return;');
    expect(code).toContain('if (started.current || !adopted || !mayRead) return;');
    // …and a gated submit SAYS it did not send, with a fresh form to resend
    expect(code).toMatch(/\(message: string\) => \{\s*if \(!mayRead\) \{\s*setGatedLine\(GATED_SUBMIT_LINE\);\s*setFormKey\(\(k\) => k \+ 1\);\s*return;\s*\}/);
    expect(code).toMatch(/\{gatedLine \? \(\s*<Text style=\{st\.cardBody\} accessibilityRole="alert">\{gatedLine\}<\/Text>/);
    expect(code).toMatch(/<InputRequestView\s+key=\{formKey\}/);
  });

  it('muhurta: adoption and answer return early unless mayRead', () => {
    const code = codeOf(path.join('app', 'muhurta.tsx'));
    expect(code).toContain('if (adopting.current || !mayRead) return;');
    expect(code).toContain('if (!replyReady(message) || !adopted || !mayRead) return;');
  });
});

describe('chat: a gated send parks the turn before it pushes the gate', () => {
  const code = codeOf(path.join('app', '(tabs)', 'chat.tsx'));

  it('parks with its time and uid, VOICES an eviction (plain text back in the box), then pushes', () => {
    expect(code).toMatch(
      /if \(readingGated\) \{\s*const parked = chatDraft\.park\(\{ message: text, files: atts \?\? \[\], uid, parkedAt: Date\.now\(\) \}\);\s*if \(parked\.kept\) setDraftNotice\(null\);\s*applyEviction\(parked\.evicted, 'overflow', \{ notify: setDraftNotice, restore: restoreToComposer \}\);\s*setDraftTick\(\(n\) => n \+ 1\);\s*router\.push\('\/sign-in'\);/,
    );
  });

  it('the release effect lists focus and the tick, and re-ticks after a step (R2/R3/R4/R6)', () => {
    const deps = effectDeps(code, 'chatReleaser.step(');
    expect(deps).toEqual(expect.arrayContaining(['focused', 'draftTick', 'authResolved', 'readingGated', 'uid', 'chatId', 'isSending', 'isCreatingChat', 'rawSend', 'restoreToComposer']));
    expect(code).toMatch(/restore: restoreToComposer,\s*settled: \(\) => setDraftTick\(\(n\) => n \+ 1\),\s*\}\);\s*if \(action\.kind !== 'none' && action\.kind !== 'hold'\) setDraftTick\(\(n\) => n \+ 1\);/);
  });

  it('stale or evicted plain text reaches the composer', () => {
    expect(code).toContain('(text: string) => setRestore({ text, key: Date.now() })');
    expect(code).toMatch(/onStop=\{cancel\}\s*restore=\{restore\}/);
  });

  it('a DIFFERENT account drops the chat held in memory (and forgets it)', () => {
    expect(code).toMatch(/if \(isDifferentAccount\(lastUid\.current, uid\)\) \{\s*forgetChat\(\);\s*setChatId\(null\);\s*\}\s*if \(uid !== null\) lastUid\.current = uid;\s*\}, \[uid\]\);/);
  });

  it('the root layout forgets the remembered chat on a different account, app-wide', () => {
    const layout = codeOf(path.join('app', '_layout.tsx'));
    expect(layout).toContain('useEffect(() => watchAccountForChat(subscribeToAccount), []);');
  });

  it('releases through chatReleaser, with focus and the lifecycle’s busy flags', () => {
    expect(code).toMatch(/chatReleaser\.step\(\{[\s\S]{0,200}focused, busy: isSending \|\| isCreatingChat, at: Date\.now\(\)/);
    expect(code).toMatch(/send: \(message, files\) => rawSend\(message, files as never\)/);
    expect(code).toContain('const focused = useIsFocused();');
  });

  it('surviving mutation B: leaving the old account’s chat FORGETS it and clears the id', () => {
    expect(code).toMatch(/leaveChat: \(\) => \{\s*forgetChat\(\);\s*setChatId\(null\);\s*\}/);
    expect(code).not.toMatch(/chatDraft\.clear\(\)/);
  });

  it('the held line and the discard line are on screen', () => {
    expect(code).toMatch(/chatDraft\.size\(\) > 0 && readingGated \? \(\s*<View style=\{s\.nudge\}>\s*<Text style=\{s\.nudgeBody\}>\{HELD_LINE\}<\/Text>/);
    expect(code).toContain('notify: setDraftNotice');
    expect(code).toMatch(/\{draftNotice \? \(/);
  });

  it('nothing is written to disk — the draft module imports only the fence reader', () => {
    const lib = codeOf(path.join('lib', 'gated-draft.ts'));
    expect(lib).not.toMatch(/AsyncStorage|SecureStore/);
    expect(lib.match(/^[ \t]*import .*$/gm)).toEqual(["import { readInputResponse } from '@wealthai/astral';"]);
  });
});
