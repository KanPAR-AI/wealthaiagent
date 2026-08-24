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
}
