// Which conversation this device is in — the astro module with this app's
// storage key (see that file: one running conversation, resumed, remembered
// the moment the id exists because the app can be killed at any time).

import { getPlatform } from '@wealthai/core';

const LAST_CHAT_KEY = 'knee.lastChatId';

export function rememberChat(chatId: string): void {
  void getPlatform().storage.setItem(LAST_CHAT_KEY, chatId);
}

export function lastChatId(): Promise<string | null> {
  return getPlatform().storage.getItem(LAST_CHAT_KEY);
}

export function forgetChat(): void {
  void getPlatform().storage.removeItem(LAST_CHAT_KEY);
}
