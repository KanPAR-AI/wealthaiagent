// Hydrate a past conversation from the backend into the shared chat store.
//
// Uses core's fetchChatHistory + mapHistoryMessage — the exact mapping the
// web app applies (assistant→bot, widgets_json→contentBlocks) — so a chat
// started on web resumes identically on mobile and vice versa.

import { fetchChatHistory, mapHistoryMessage, useChatStore } from '@wealthai/core';

import { getToken } from './auth';

/** Returns true if the chat loaded (or was already loaded). */
export async function loadChatIntoStore(chatId: string): Promise<boolean> {
  const store = useChatStore.getState();
  // Already hydrated this session? addMessage dedups by id anyway, but
  // skipping the fetch makes reopening a chat from history instant.
  if ((store.chats[chatId]?.messages?.length ?? 0) > 0) return true;

  const token = await getToken();
  if (!token) return false;

  const history = await fetchChatHistory(token, chatId);
  const mapped = (history.messages || []).map(mapHistoryMessage);
  // addMessage sorts by timestamp and dedups by id — safe to append in order.
  mapped.forEach((m) => store.addMessage(chatId, m as any));
  return true;
}
