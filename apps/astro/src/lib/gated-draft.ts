// What a reading surface does when the sign-in gate stands in front of
// something the user has ALREADY typed (bug 29c19678, Astral build 13,
// 2026-09-18: "Entered birth details then it asked to sign in to receive
// readings but after signing in the birth details were gone").
//
// PURE: no React, no expo, no clock — the root jest project runs it; the
// screens pass the time in and apply what this returns.
//
// ── the two ways typed details were thrown away ────────────────────────────
//
//   * the chat screen's gated send returned early after pushing the gate.
//     The composer had already cleared its text, and the in-bubble birth
//     form had already flipped to its "✓ …" receipt, so after signing in the
//     user was back in a chat where nothing had been sent and nothing could
//     be re-sent — their details were simply gone.
//   * the birth-details screen gated with `router.replace('/sign-in')`, which
//     UNMOUNTS the form (and the engine's pending ask with it), and sign-in
//     returns with `router.back()` — which cannot return to a replaced
//     screen. It also let the opening turn go out before the gate resolved.
//
// ── the rule this module encodes ───────────────────────────────────────────
//
// A turn the gate stops is PARKED, not dropped: the exact message the user
// composed (for a form, the typed `input_response` carrier the widget built)
// waits in a small FIFO queue until the account can read, and then goes out,
// oldest first, one at a time, through the screen's ONE send path. Nothing is
// sent to the engine before sign-in, and nothing here is a fact: `reconcile`
// is the only fact-writer (INV-1), and it only sees these values once the
// parked turn is actually sent, as the signed-in user.
//
// Three things are deliberately NOT released (Role-3 review, E2 round 2):
//   * a turn older than DRAFT_TTL_MS — a reading fired hours later on a tab
//     nobody is looking at spends a credit the user never sees;
//   * any turn while the surface is not focused — same reason;
//   * ANY form answer after a sign-in that swapped the uid (`lib/auth.ts`'s
//     `credential-already-in-use` fallback). A guest never receives an
//     engine ask (every send and every opening turn waits for the gate), so
//     a form answer parked before a swap is BY CONSTRUCTION an answer to a
//     different account's ask. The engine treats the carrier as
//     self-describing and WRITES its values, dated now (chatservice graph.py
//     `_parse_input_response` → `_apply_input_answer`), where an in-chat
//     statement beats an adopted value and a declined time sets a pending
//     time ask — so even "just my birth date" would overwrite the other
//     account's record. Role-3, E2 round 3: no carrier survives a swap. Only
//     plain text does, because the engine asks for whatever it needs from a
//     sentence; every carrier is discarded with a visible line.
//
// IN MEMORY ONLY. A parked turn can hold a birth date, time and place, and
// the birth-details lock (docs/75, owner 2026-09-19) exists so those are not
// lying around on the device in plain sight; AsyncStorage is plain text on
// disk. The cost, stated: if iOS kills the app while the provider sheet is
// up, the parked turn dies with the process.

import { readInputResponse } from '@wealthai/astral';

/** A turn the gate stopped, waiting for the account to be able to read. */
export interface ParkedDraft {
  /** exactly what the user composed — never re-worded */
  message: string;
  /** attachments that travelled with it (the chat composer's) */
  files: unknown[];
  /** the Firebase uid it was typed under, or null when there was none yet */
  uid: string | null;
  /** epoch ms when it was parked — the CALLER's clock, passed in */
  parkedAt: number;
}

/** How long a parked turn may wait. Past this it is discarded, not sent. */
export const DRAFT_TTL_MS = 15 * 60 * 1000;

/** How many parked turns a surface holds at once. */
export const DRAFT_CAP = 3;

/** The line a surface shows while a turn is parked, so a "✓" receipt does
 *  not read as sent. */
export const HELD_LINE = 'Held until you sign in — it sends as soon as you do.';

/** A screen with no parking (Palm) whose submit the gate stopped: the form
 *  has already shown its "✓", so it must say it did NOT send. */
export const GATED_SUBMIT_LINE =
  'That was not sent — you are not signed in. Sign in, then send it again.';

export type DiscardReason = 'stale' | 'other_account' | 'before_sign_in' | 'overflow';

/**
 * What became of the dropped turn's words — the line says which:
 *   * `restored` — plain text, put back in the composer (from memory; the
 *     docs/75 lock allows memory, it forbids disk);
 *   * `text` — plain text with no composer to put it in;
 *   * `answer` — a form answer, which cannot be re-sent: it answers a
 *     question that has to be asked again.
 */
export type DiscardFate = 'restored' | 'text' | 'answer';

const WHY: Record<DiscardReason, string> = {
  stale: 'waited too long before you signed in, so it was not sent.',
  other_account: 'was for a different account than the one you signed into, so it was not sent.',
  // A turn parked before auth reported (uid null): nobody can say which
  // account it was for, and "a different account" would be a guess
  // (Role-3, E2 round 4).
  before_sign_in: 'was given before you were signed in, so it was not sent.',
  overflow: 'could not be kept — only three things can wait for sign-in at once.',
};
const THEN: Record<DiscardFate, string> = {
  restored: 'It is back in the box below — send it again if you still want to.',
  text: 'Please type it again.',
  answer: 'That question has to be asked again — ask for your reading and it will come back.',
};

/** The one visible line for a discarded turn. Never silent. */
export function discardLine(reason: DiscardReason, fate: DiscardFate): string {
  const what = fate === 'answer' ? 'An answer you gave' : 'Something you typed';
  return `${what} ${WHY[reason]} ${THEN[fate]}`;
}

// ── the carrier, read by the ONE module that knows its fence ───────────────
//
// ASTRAL-91 (packages/astral structural test): exactly one module in the
// workspace knows the answer fence, and it is `packages/astral/src/
// input-request.ts`. So this reads the carrier through its `readInputResponse`
// and never names the fence itself.

/** Is this turn a widget answer (readable or not)? */
export function carriesInputResponse(message: string): boolean {
  return readInputResponse(String(message ?? '')).kind !== 'none';
}

/**
 * May this turn be sent into a DIFFERENT account than it was typed under?
 * Plain text only (E2 round 3 — see the header: a parked form answer is
 * always an answer to another account's ask). An unreadable carrier is
 * still a carrier, so it is not portable either.
 */
export function portableAcrossAccounts(message: string): boolean {
  return readInputResponse(String(message ?? '')).kind === 'none';
}

// ── the queue ──────────────────────────────────────────────────────────────

/** One surface's parked turns, oldest first. */
export interface DraftSlot {
  /**
   * Queue a turn. `kept` is false when there was nothing to keep; `evicted`
   * is the turn that had to go to make room — the caller MUST say so
   * (`applyEviction`), never drop it silently.
   */
  park(draft: ParkedDraft): ParkResult;
  /** the oldest parked turn */
  peek(): ParkedDraft | null;
  /** remove and return the oldest — the caller is about to act on it */
  take(): ParkedDraft | null;
  size(): number;
  /**
   * The account changed to `uid`: every turn typed under ANOTHER account (or
   * before any account reported) is re-homed to this one if it is plain
   * text, and dropped if it is a form answer. Returns how many were
   * dropped, so the caller can say so.
   */
  rehome(uid: string): number;
  /** `rehome`, with the dropped turns counted by WHY they were dropped:
   *  typed under another account, or before any account reported. */
  rehomeDetail(uid: string): { otherAccount: number; beforeSignIn: number };
  clear(): void;
}

export interface ParkResult {
  kept: boolean;
  evicted: ParkedDraft | null;
}

export function createDraftSlot(): DraftSlot {
  let queue: ParkedDraft[] = [];
  return {
    park(draft) {
      const message = String(draft.message ?? '');
      // An empty turn is nothing to keep; parking it would later "send" a
      // blank the composer itself refuses to send.
      if (!message.trim() && !(draft.files?.length)) return { kept: false, evicted: null };
      let evicted: ParkedDraft | null = null;
      if (queue.length >= DRAFT_CAP) {
        // Full: make room by evicting the oldest PLAIN turn (it can go back
        // in the composer), so a parked form answer is the last to go. When
        // every queued turn is an answer, the oldest goes — and is REPORTED.
        const plain = queue.findIndex((d) => !carriesInputResponse(d.message));
        evicted = queue.splice(plain >= 0 ? plain : 0, 1)[0] ?? null;
      }
      queue.push({
        message,
        files: [...(draft.files ?? [])],
        uid: draft.uid ?? null,
        parkedAt: draft.parkedAt,
      });
      return { kept: true, evicted };
    },
    peek: () => queue[0] ?? null,
    take: () => queue.shift() ?? null,
    size: () => queue.length,
    rehome(uid) {
      const r = this.rehomeDetail(uid);
      return r.otherAccount + r.beforeSignIn;
    },
    rehomeDetail(uid) {
      let otherAccount = 0;
      let beforeSignIn = 0;
      queue = queue
        .filter((d) => {
          const keep = d.uid === uid || portableAcrossAccounts(d.message);
          if (!keep) {
            if (d.uid === null) beforeSignIn += 1;
            else otherAccount += 1;
          }
          return keep;
        })
        .map((d) => ({ ...d, uid }));
      return { otherAccount, beforeSignIn };
    },
    clear() {
      queue = [];
    },
  };
}

/**
 * The chat screen's parked turns. Module-level so they survive the chat
 * screen being remounted while the sign-in screen is up; memory-only (above).
 */
export const chatDraft: DraftSlot = createDraftSlot();

// ── what a gated SCREEN shows ──────────────────────────────────────────────

export type GateStep =
  /** auth has not reported yet — do nothing, send nothing */
  | 'wait'
  /** a guest, not yet sent to the gate on this visit — push it (ONCE) */
  | 'prompt'
  /** a guest who came back from the gate without signing in — show the
   *  gate card, never re-push (that is a loop) */
  | 'card'
  /** the account can read — the screen may ask the engine */
  | 'proceed';

export function gateStep(state: {
  resolved: boolean;
  blocked: boolean;
  /** has this screen already pushed the gate on this visit? */
  prompted: boolean;
}): GateStep {
  if (!state.resolved) return 'wait';
  if (!state.blocked) return 'proceed';
  return state.prompted ? 'card' : 'prompt';
}

// ── when the oldest parked turn may go out, and where ──────────────────────

export type ReleaseAction =
  /** nothing parked */
  | { kind: 'none' }
  /** parked, but not now (still gated, not focused, a send in flight) */
  | { kind: 'hold' }
  /** parked too long — drop it and say so */
  | { kind: 'discard'; reason: DiscardReason }
  /**
   * Signed in as a DIFFERENT account than the oldest turn was typed under.
   * Re-home the queue (portable turns stay, account-bound answers go, with a
   * line) and, if a conversation is open, leave it: it belongs to the
   * account the user left. The next pass sends.
   */
  | { kind: 'swap'; uid: string; leave: boolean }
  /** send it now, through the screen's one send path */
  | { kind: 'send'; draft: ParkedDraft };

export interface ReleaseState {
  resolved: boolean;
  blocked: boolean;
  uid: string | null;
  chatId: string | null;
  /** is the surface on screen? A turn never fires on a hidden tab. */
  focused: boolean;
  /** is a send already in flight? One at a time, so the second rides the
   *  chat the first one created. */
  busy: boolean;
  /** epoch ms, the caller's clock */
  at: number;
}

export function releaseAction(draft: ParkedDraft | null, now: ReleaseState): ReleaseAction {
  if (!draft) return { kind: 'none' };
  if (now.at - draft.parkedAt > DRAFT_TTL_MS) return { kind: 'discard', reason: 'stale' };
  if (!now.resolved || now.blocked) return { kind: 'hold' };
  if (!now.focused || now.busy) return { kind: 'hold' };
  // A turn parked before auth reported (uid null) counts as another account's:
  // nobody can say whose ask it answered, so it gets the conservative path.
  const swapped = now.uid !== null && draft.uid !== now.uid;
  if (swapped) return { kind: 'swap', uid: now.uid as string, leave: now.chatId !== null };
  return { kind: 'send', draft };
}

/** What a screen can do; `applyRelease` decides which, in what order. */
export interface ReleaseOps {
  /** send through the screen's one send path; may return the send's promise */
  send(message: string, files: unknown[]): Promise<unknown> | void;
  /** leave the current conversation (forget it; the id goes to null) */
  leaveChat(): void;
  /** show one visible line */
  notify(line: string): void;
  /** put plain text back in the composer; absent where there is none */
  restore?(message: string): void;
}

/**
 * Say what happened to a dropped turn, and give plain text back where there
 * is a composer to give it to. The ONE place a discard is voiced, so no path
 * drops a turn in silence (Role-3, E2 round 3).
 */
export function applyEviction(
  dropped: ParkedDraft | null,
  reason: DiscardReason,
  ops: Pick<ReleaseOps, 'notify' | 'restore'>,
): boolean {
  if (!dropped) return false;
  if (carriesInputResponse(dropped.message)) {
    ops.notify(discardLine(reason, 'answer'));
  } else if (ops.restore) {
    ops.restore(dropped.message);
    ops.notify(discardLine(reason, 'restored'));
  } else {
    ops.notify(discardLine(reason, 'text'));
  }
  return true;
}

/** Apply one release decision to one slot, in the order drop -> say so ->
 *  leave -> send. Returns the send's promise when it sent, else null. */
export function applyRelease(
  action: ReleaseAction, slot: DraftSlot, ops: ReleaseOps,
): Promise<unknown> | null {
  switch (action.kind) {
    case 'discard':
      applyEviction(slot.take(), action.reason, ops);
      return null;
    case 'swap': {
      // After this rule change every dropped turn is a form answer.
      const dropped = slot.rehomeDetail(action.uid);
      if (dropped.otherAccount > 0) ops.notify(discardLine('other_account', 'answer'));
      if (dropped.beforeSignIn > 0) ops.notify(discardLine('before_sign_in', 'answer'));
      if (action.leave) ops.leaveChat();
      return null;
    }
    case 'send': {
      const draft = slot.take();
      if (!draft) return null;
      return Promise.resolve(ops.send(draft.message, draft.files));
    }
    default:
      return null;
  }
}

/**
 * The release loop a screen runs from an effect: one step per render, and
 * NEVER a second send while the first is still in flight.
 *
 * `isSending` alone is not enough, read off the shared lifecycle:
 * `useSendMessage` flips it only AFTER it has awaited the auth token, so a
 * re-render in that gap saw "not sending", fired the second parked turn on
 * the send still bound to `chatId === null`, and opened a SECOND new chat.
 * The releaser holds its own in-flight flag from the moment it sends until
 * that send settles, then asks the screen to re-run (`settled`).
 */
export interface Releaser {
  step(now: ReleaseState, ops: ReleaseOps & { settled(): void }): ReleaseAction;
  inFlight(): boolean;
}

export function createReleaser(slot: DraftSlot): Releaser {
  let inFlight = false;
  return {
    step(now, ops) {
      const action = releaseAction(slot.peek(), { ...now, busy: now.busy || inFlight });
      const sent = applyRelease(action, slot, ops);
      if (sent) {
        inFlight = true;
        // The send's own lifecycle renders its failure (an error bubble, an
        // edit's failure line) - this only needs to know it is OVER, either
        // way, so the next parked turn can go.
        const done = () => {
          inFlight = false;
          ops.settled();
        };
        sent.then(done, done);
      }
      return action;
    },
    inFlight: () => inFlight,
  };
}

/** The chat screen's release loop, next to its queue. */
export const chatReleaser: Releaser = createReleaser(chatDraft);
