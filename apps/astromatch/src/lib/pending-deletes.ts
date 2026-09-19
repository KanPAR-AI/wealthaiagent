/**
 * The unsaved readings we still owe a delete (docs/73 B1, second half).
 *
 * ── the promise this file makes true ──────────────────────────────────────
 *
 * The panel says "when you leave or close this panel I will delete the
 * conversation". Three controls did that. Closing the side panel did not, and
 * quitting the browser certainly did not — so the promise was true of the
 * three buttons and false of the two things a user is far more likely to do.
 *
 * Two mechanisms, because there are two ways to lose the moment:
 *
 *   1. The port's `onDisconnect` fires when the panel closes, and the worker
 *      issues the delete — it holds the chat id and the token.
 *   2. An MV3 service worker can be TORN DOWN before an async fetch finishes,
 *      and a browser that quits takes everything with it. So the chat id is
 *      RECORDED the moment the chat is created and cleared only on a
 *      successful delete; whatever is left is swept on the next worker start
 *      and on the next panel open.
 *
 * ── why `chrome.storage.local`, and what may go in it ─────────────────────
 *
 * `chrome.storage.session` dies with the browser, which is precisely the case
 * the sweep exists for — a pending id there would be lost exactly when it is
 * needed. So the list lives in `local`, which survives a restart.
 *
 * **IDS ONLY.** A chat id is an opaque uuid the backend minted; it is not a
 * birth value, a name or a place, and nothing else may be written here. The
 * session token still lives in `session` (memory-backed) and never here.
 * `pending-deletes.test.ts` asserts the shape of every stored record.
 *
 * Pure except for the injected store, so the whole thing is testable without
 * a browser.
 */

/** The minimum a sweep needs: which chat, and when we noticed. */
export interface PendingDelete {
  /** the backend's chat id — an opaque identifier, never a birth value */
  chatId: string;
  /** epoch ms, for ordering and for an honest "just now" */
  noticedAt: number;
  /**
   * `kept-claimed` — the user pressed "Add to my matches" and the save is in
   * flight or has landed (docs/73 PH-41, item 6 residue).
   *
   * WHY IT IS DURABLE. "This run was saved" lived in a `WeakSet` keyed by the
   * panel's port, which dies with the worker — and an MV3 worker is torn down
   * whenever Chrome feels like it, including between the save POST and the
   * turn coming back. A worker killed in that window lost the fact, and the
   * next panel open swept the conversation the user had chosen to keep
   * (F383's second half). So the claim is written HERE, in the one store the
   * sweep reads, BEFORE the save is sent.
   *
   * It is not a promise that the save succeeded: it is "somebody asked for
   * this to be kept, and until we know otherwise deleting it is the worse
   * mistake". A definite failure releases it (`releaseKept`); success removes
   * the record altogether (`clearPending`).
   *
   * An ID and a state. No name, no birth value, nothing renderable — the rule
   * this store has always had.
   */
  state?: KeptState;
}

export type KeptState = 'kept-claimed';

export const KEPT_CLAIMED: KeptState = 'kept-claimed';

export const PENDING_KEY = 'astromatch.pending_deletes';

/** Anything with the two `chrome.storage.local` methods we use. */
export interface KeyValueStore {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

/**
 * PARSE, DON'T TRUST — the same rule the wire gets.
 *
 * Storage is shared with whatever earlier version of this extension wrote it,
 * so a record of a shape we do not recognise is DROPPED rather than handed to
 * a delete loop. A record carrying anything but the two declared keys is also
 * dropped: it means something wrote more than an id, which is the one thing
 * this store exists to prevent.
 */
export function parsePending(raw: unknown): PendingDelete[] {
  if (!Array.isArray(raw)) return [];
  const out: PendingDelete[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const keys = Object.keys(item as Record<string, unknown>).sort();
    // TWO shapes and no third: the original pair, and the pair plus the one
    // declared state. A record written by an older build parses as owed,
    // which is the safe direction — it gets deleted rather than kept.
    if (keys.join(',') !== 'chatId,noticedAt' && keys.join(',') !== 'chatId,noticedAt,state') {
      continue;
    }
    const { chatId, noticedAt, state } = item as {
      chatId: unknown;
      noticedAt: unknown;
      state?: unknown;
    };
    if (typeof chatId !== 'string' || !chatId) continue;
    if (typeof noticedAt !== 'number' || !Number.isFinite(noticedAt)) continue;
    if (state !== undefined && state !== KEPT_CLAIMED) continue;
    out.push(state === KEPT_CLAIMED ? { chatId, noticedAt, state } : { chatId, noticedAt });
  }
  return out;
}

/** Is this chat one the user asked to KEEP? Durable, so a worker teardown
 *  cannot lose the answer. */
export function isKept(pending: PendingDelete[], chatId: string): boolean {
  return pending.some((p) => p.chatId === chatId && p.state === KEPT_CLAIMED);
}

/**
 * Do we still OWE this chat a delete?
 *
 * The store is the promise list, and this is the one question every deleting
 * path asks — the panel closing, the sweep, a fresh worker that never saw the
 * click. Three states, and each answers differently:
 *
 *   · a record with no state  → owed (an unsaved reading)
 *   · a record `kept-claimed` → NOT owed (the user asked to keep it)
 *   · no record at all        → NOT owed (a save that landed, and the
 *                               per-match chats, which are never noted)
 *
 * Saying "owed" for an id nobody noted would make this function a licence to
 * delete any chat whose id happened to be passed in, which is the opposite of
 * what a promise list is for.
 */
export function owedNow(pending: PendingDelete[], chatId: string): boolean {
  return pending.some((p) => p.chatId === chatId && p.state !== KEPT_CLAIMED);
}

/**
 * Claim this chat as kept — BEFORE the save leaves.
 *
 * A chat the panel never noted (there is no record) is claimed anyway, so the
 * ordering holds even if the note was lost: the claim is what the sweep
 * reads.
 */
export async function claimKept(
  store: KeyValueStore,
  chatId: string,
  now: number,
): Promise<void> {
  if (!chatId) return;
  const current = await readPending(store);
  const at = current.find((p) => p.chatId === chatId);
  const next = at
    ? current.map((p) => (p.chatId === chatId ? { ...p, state: KEPT_CLAIMED } : p))
    : [...current, { chatId, noticedAt: now, state: KEPT_CLAIMED }];
  await store.set({ [PENDING_KEY]: next });
}

/** The save definitely did not land — the chat is owed a delete again. */
export async function releaseKept(store: KeyValueStore, chatId: string): Promise<void> {
  const current = await readPending(store);
  if (!current.some((p) => p.chatId === chatId && p.state === KEPT_CLAIMED)) return;
  await store.set({
    [PENDING_KEY]: current.map((p) =>
      p.chatId === chatId ? { chatId: p.chatId, noticedAt: p.noticedAt } : p,
    ),
  });
}

export async function readPending(store: KeyValueStore): Promise<PendingDelete[]> {
  const bag = await store.get(PENDING_KEY);
  return parsePending(bag?.[PENDING_KEY]);
}

/** Record a chat we will owe a delete for. Idempotent on the id. */
export async function notePending(
  store: KeyValueStore,
  chatId: string,
  now: number,
): Promise<void> {
  if (!chatId) return;
  const current = await readPending(store);
  if (current.some((p) => p.chatId === chatId)) return;
  await store.set({ [PENDING_KEY]: [...current, { chatId, noticedAt: now }] });
}

/** Forget one — called only after the delete actually succeeded. */
export async function clearPending(store: KeyValueStore, chatId: string): Promise<void> {
  const current = await readPending(store);
  const next = current.filter((p) => p.chatId !== chatId);
  if (next.length === current.length) return;
  await store.set({ [PENDING_KEY]: next });
}

export interface SweepResult {
  deleted: string[];
  /** still owed — a delete that failed is KEPT, and tried again next time */
  remaining: string[];
  /** claimed by the user as theirs to keep — not deleted on this sweep */
  kept: string[];
  /** claims the ENGINE confirmed as saved — the record is dropped, the chat
   *  is the user's and is never deleted again */
  confirmed: string[];
  /**
   * Claims that hit the CEILING and were cleaned up (subset of `deleted`).
   *
   * They get their own sentence: "we could not confirm it" is a different
   * fact from "you left a reading open", and a user who pressed Save deserves
   * to be told the difference.
   */
  expired: string[];
}

/**
 * HOW LONG A CLAIM MAY WAIT BEFORE IT IS RESOLVED — derived, not picked.
 *
 * `packages/core/src/services/chat-service.ts` bounds a turn with three
 * watchdogs: a 15 s ceiling on `POST /messages`, a 90 s TTFB and a 90 s idle
 * window. A save that has not resolved in FOUR idle windows plus the POST
 * ceiling (6 min 15 s) is not going to; ten minutes is that, rounded up, and
 * the rounding is the only free number here.
 */
export const CLAIM_GRACE_MS = 10 * 60_000;

/**
 * …and a claim may never outlive this, whatever the engine says.
 *
 * A claim that cannot be resolved — the account signed out, the engine
 * unreachable for a week — is still a chat carrying a third party's birth
 * details. At the ceiling it is released and deleted, and the user is TOLD,
 * because silently keeping somebody's data for ever is the failure this whole
 * store exists to prevent and silently deleting it is the other one.
 */
export const CLAIM_CEILING_MS = 7 * 24 * 60 * 60_000;

export interface SweepDeps {
  /** chats a panel is OPEN on right now — never swept */
  inUse?: ReadonlySet<string>;
  /** the clock, injected so the ages below are testable */
  now?: number;
  /**
   * ASK THE ENGINE whether the save behind a claim landed.
   *
   * `true` — a match was stored on this account after the claim was made, so
   * the save landed and the conversation is the user's to keep.
   * `false` — nothing was stored since; the reading was never saved.
   * `null` — we could not ask (offline, signed out, a 500). The claim is KEPT
   * and retried, because a failed question is not an answer.
   *
   * WHY IT ASKS THIS AND NOT "is there a match for person X" (the reviewer's
   * shape): at claim time there IS no person id — the save is what MINTS the
   * person, and the claim has to be written BEFORE the save is sent or it
   * cannot survive the teardown it exists for. The one thing the client knows
   * at that moment is WHEN, so the question is asked in those terms, against
   * the shipped `GET /people/matches` read and its `computed_at` stamps. It
   * also gives `noticedAt` — written and never read until now — its job.
   */
  savedSince?: (noticedAt: number) => Promise<boolean | null>;
}

/**
 * Delete everything we still owe.
 *
 * `remove` returns whether the chat is gone (204 and 404 both mean gone). A
 * failure leaves the id in the list: the honest behaviour is to try again,
 * not to forget a promise because one request failed.
 */
export async function sweepPending(
  store: KeyValueStore,
  remove: (chatId: string) => Promise<boolean>,
  /**
   * Chats a panel is OPEN on right now — never swept.
   *
   * Measured in the browser walk: without this, opening a second panel swept
   * the reading the user was still looking at, because "pending" is recorded
   * when the chat is created rather than when it is abandoned. A chat with a
   * live port is not left over; it is in use.
   */
  deps: SweepDeps = {},
): Promise<SweepResult> {
  const inUse = deps.inUse ?? new Set<string>();
  const now = deps.now ?? Date.now();
  const pending = await readPending(store);
  const deleted: string[] = [];
  const remaining: string[] = [];
  const kept: string[] = [];
  const expired: string[] = [];
  /** ids whose record is dropped because the save is CONFIRMED landed */
  const confirmed: string[] = [];

  const removeNow = async (chatId: string): Promise<boolean> => {
    try {
      return await remove(chatId);
    } catch {
      // A failed sweep is not an error the user caused and not one this
      // function may swallow into a "deleted" — it stays owed.
      return false;
    }
  };

  for (const item of pending) {
    if (inUse.has(item.chatId)) {
      // A chat with a live port is in use, not left over — claimed or not.
      remaining.push(item.chatId);
      continue;
    }

    if (item.state === KEPT_CLAIMED) {
      /**
       * A CLAIM IS NOT A PERMANENT LICENCE (item 6, second residual).
       *
       * It used to be written back unconditionally, so a worker torn down
       * between `claimKept` and the save resolving left an IMMORTAL claim —
       * and the chat behind it, carrying a third party's birth details, was
       * never deleted and the user never told. Protecting the saved by
       * leaking the unsaved is the trade this store exists to refuse.
       *
       * So a claim is resolved, in this order: inside the grace it waits;
       * past the ceiling it is cleaned up whatever happens; in between, the
       * ENGINE is asked.
       */
      const age = now - item.noticedAt;
      if (age < CLAIM_GRACE_MS) {
        kept.push(item.chatId);
        continue;
      }
      if (age >= CLAIM_CEILING_MS) {
        const gone = await removeNow(item.chatId);
        if (gone) {
          deleted.push(item.chatId);
          expired.push(item.chatId);
        } else {
          remaining.push(item.chatId);
        }
        continue;
      }
      let answer: boolean | null = null;
      if (deps.savedSince) {
        try {
          answer = await deps.savedSince(item.noticedAt);
        } catch {
          // A question that threw is not a "no". Kept, and asked again.
          answer = null;
        }
      }
      if (answer === true) {
        // The save landed: the conversation is the user's. The record goes,
        // and nothing ever deletes that chat again.
        confirmed.push(item.chatId);
        continue;
      }
      if (answer === false) {
        // Nothing was stored since the claim — this reading was never saved,
        // so it is owed a delete like any other.
        const gone = await removeNow(item.chatId);
        (gone ? deleted : remaining).push(item.chatId);
        continue;
      }
      // Could not ask. Keep it, and try on the next sweep.
      kept.push(item.chatId);
      continue;
    }

    const gone = await removeNow(item.chatId);
    (gone ? deleted : remaining).push(item.chatId);
  }

  await store.set({
    [PENDING_KEY]: pending.filter(
      (p) => remaining.includes(p.chatId) || kept.includes(p.chatId),
    ),
  });
  return { deleted, remaining, kept, expired, confirmed };
}

/**
 * What to tell the user when a sweep removed something.
 *
 * Only ever said when it actually happened, and it names no detail of the
 * reading — the id is not shown, because an id is not a thing a person can
 * check and printing it would be the only place one ever appeared.
 */
export function sweepNotice(result: SweepResult): string {
  // A claim that ran out of road gets its OWN sentence: "we could not confirm
  // it" is a different fact from "you left a reading open", and somebody who
  // pressed Save is owed the difference.
  const expired = result.expired ?? [];
  if (expired.length) {
    const others = result.deleted.filter((id) => !expired.includes(id));
    const mine =
      expired.length > 1
        ? `${expired.length} readings that were waiting to be added to your matches could not be confirmed, so they were cleaned up.`
        : 'A reading that was waiting to be added to your matches could not be confirmed, so it was cleaned up.';
    if (!others.length) return mine;
    return `${mine} ${
      others.length > 1
        ? `${others.length} readings you left open were deleted just now.`
        : 'The reading you left open was deleted just now.'
    }`;
  }
  if (!result.deleted.length) return '';
  const many = result.deleted.length > 1;
  return many
    ? `${result.deleted.length} readings you left open were deleted just now.`
    : 'The reading you left open was deleted just now.';
}
