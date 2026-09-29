// Which conversation this device is in.
//
// `apps/mobile` has a drawer full of chats and picks one; this app has one
// running reading and simply resumes it. That is a PRODUCT difference, not a
// surface one, so it lives here rather than in `@wealthai/chat-native` —
// but it lives in ONE place, because two readers of the same key (the chat
// screen and the bug reporter, which attaches the transcript) drifting apart
// is how a report arrives with no conversation attached.

import { getPlatform } from '@wealthai/core';

const LAST_CHAT_KEY = 'astro.lastChatId';
const OWN_CHAT_KEY = 'astro.ownChatId';

/** Remembered the moment the id exists, not on unmount: the app can be
 *  killed at any time, and an id written "later" is a transcript that comes
 *  back empty. */
export function rememberChat(chatId: string): void {
  void getPlatform().storage.setItem(LAST_CHAT_KEY, chatId);
}

export function lastChatId(): Promise<string | null> {
  return getPlatform().storage.getItem(LAST_CHAT_KEY);
}

/** The remembered chat is gone (deleted, or a different account). Forget it
 *  rather than showing an empty screen that never fills. */
export function forgetChat(): void {
  void getPlatform().storage.removeItem(LAST_CHAT_KEY);
  void getPlatform().storage.removeItem(OWN_CHAT_KEY);
}

// ── the user's OWN chat ─────────────────────────────────────────────────────
//
// Palm, Muhurta and the birth-details form ADOPT a chat so their result lands
// where the user's readings live. They used to adopt the LAST chat — and since
// docs/67 the last chat is often a friend's sealed reading. Found on the
// simulator 2026-09-18: the Palm tile opened on "The reading needs something
// else first — Continue in chat" and Muhurta on "Keep this reading as a
// person?", because the engine, asked inside the friend's chat, answered with
// that chat's pending ask. Owner: "why not ask here rather than in chat".
//
// So a second key: the last chat the ENGINE said reads for the user
// themselves. Resume and the bug reporter keep the last chat; the native
// surfaces adopt only this one, and start a fresh chat when there is none.

/** Pure: is the chat on screen the user's own? Only the engine's word counts. */
export function isOwnChat(mode: string, engineSaid: boolean, sealed: boolean): boolean {
  return engineSaid && mode === 'self' && !sealed;
}
export function rememberOwnChat(chatId: string): void {
  void getPlatform().storage.setItem(OWN_CHAT_KEY, chatId);
}
export function ownChatId(): Promise<string | null> {
  return getPlatform().storage.getItem(OWN_CHAT_KEY);
}
/** The chat stopped being the user's own (its subject changed). */
export async function disownChat(chatId: string): Promise<void> {
  if ((await ownChatId()) === chatId) void getPlatform().storage.removeItem(OWN_CHAT_KEY);
}

/** The own chat, PROVEN to still exist. A remembered id can outlive its chat
 *  (deleted on another device, a different account) — adopting it blind made
 *  the Palm screen's first turn fail with "Couldn't get a response" (found on
 *  the simulator 2026-09-18). `load` is the same read the chat screen's
 *  resume uses; a throw forgets the key and the surface starts fresh. */
export async function adoptOwnChat(
  load: (id: string) => Promise<unknown>,
): Promise<string | null> {
  const id = await ownChatId();
  if (!id) return null;
  try {
    await load(id);
    return id;
  } catch {
    void getPlatform().storage.removeItem(OWN_CHAT_KEY);
    return null;
  }
}


// ── a different account forgets the chat (E2 round 3) ──────────────────────
//
// `signOut` (lib/auth.ts) signs straight back in anonymously as a NEW uid,
// and the `credential-already-in-use` fallback swaps the uid too. Neither
// forgot the remembered chat, so the next account resumed the previous
// account's chat id: the server refuses a cross-account post (an error
// bubble, not a leak), but the chat tab showed a transcript that was not
// this account's and every send into it failed. Linking an anonymous account
// keeps the uid, so it is NOT a change and forgets nothing.

/** Pure: did the account change to a DIFFERENT one? `null` (signed out, or
 *  not yet reported) is a gap, not an account — it never counts. */
export function isDifferentAccount(lastUid: string | null, uid: string | null): boolean {
  return lastUid !== null && uid !== null && lastUid !== uid;
}

/**
 * Watch the account and forget the remembered chat the moment it becomes a
 * different account. `onChange` lets a mounted screen drop the id it holds
 * in memory as well. Returns the unsubscribe.
 */
export function watchAccountForChat(
  subscribe: (fn: (account: { uid: string } | null) => void) => () => void,
  onChange: () => void = () => undefined,
): () => void {
  let last: string | null = null;
  return subscribe((account) => {
    const uid = account?.uid ?? null;
    if (isDifferentAccount(last, uid)) {
      forgetChat();
      onChange();
    }
    if (uid !== null) last = uid;
  });
}
