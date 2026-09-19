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
}

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
    if (keys.join(',') !== 'chatId,noticedAt') continue;
    const { chatId, noticedAt } = item as { chatId: unknown; noticedAt: unknown };
    if (typeof chatId !== 'string' || !chatId) continue;
    if (typeof noticedAt !== 'number' || !Number.isFinite(noticedAt)) continue;
    out.push({ chatId, noticedAt });
  }
  return out;
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
  inUse: ReadonlySet<string> = new Set(),
): Promise<SweepResult> {
  const pending = await readPending(store);
  const deleted: string[] = [];
  const remaining: string[] = [];
  for (const item of pending) {
    if (inUse.has(item.chatId)) {
      remaining.push(item.chatId);
      continue;
    }
    let gone = false;
    try {
      gone = await remove(item.chatId);
    } catch {
      // A failed sweep is not an error the user caused and not one this
      // function may swallow into a "deleted" — it stays owed.
      gone = false;
    }
    (gone ? deleted : remaining).push(item.chatId);
  }
  await store.set({
    [PENDING_KEY]: pending.filter((p) => remaining.includes(p.chatId)),
  });
  return { deleted, remaining };
}

/**
 * What to tell the user when a sweep removed something.
 *
 * Only ever said when it actually happened, and it names no detail of the
 * reading — the id is not shown, because an id is not a thing a person can
 * check and printing it would be the only place one ever appeared.
 */
export function sweepNotice(result: SweepResult): string {
  if (!result.deleted.length) return '';
  const many = result.deleted.length > 1;
  return many
    ? `${result.deleted.length} readings you left open were deleted just now.`
    : 'The reading you left open was deleted just now.';
}
