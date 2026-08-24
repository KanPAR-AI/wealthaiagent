// The ONE transcript (docs/49 ASTRAL-105).
//
// Moved out of `apps/mobile/src/components/chat/message-list.tsx`. FlashList
// v2, and the ChatGPT-scroll contract (the quality bar):
//   - render pinned to the bottom on entry (startRenderingFromBottom)
//   - autoscroll as streamed tokens grow the last message, BUT ONLY when
//     the user is already near the bottom (autoscrollToBottomThreshold) —
//     scrolling up to re-read must never be hijacked
//   - on SEND, always bring the just-sent message into view pinned to the
//     top of the viewport (bug 9cae3e42) — the reply then streams in
//     below it, exactly ChatGPT's behavior. Tracked by user-message COUNT,
//     not id: the optimistic local id gets swapped for the backend uuid
//     moments later and must not retrigger the scroll.
//   - interactive keyboard dismiss (drag the list down over the keyboard)
//
// This is the half of "a real transcript" that `apps/astro` did not have at
// all: its chat screen held ONE asked string and ONE answer string, so the
// previous turn was gone the moment the next one started (ASTRAL-106).

import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Keyboard } from 'react-native';
import { useChatStore, type Message, type Widget } from '@wealthai/core';

import { MessageBubble } from './message-bubble';
import type { ChatTheme } from './theme';

const EMPTY: Message[] = [];

export interface MessageListProps {
  chatId: string;
  theme: ChatTheme;
  /** (b) the surface's widget set — passed straight through to the bubble. */
  renderWidget?: (widget: Widget, key: string) => ReactNode;
  dataLanguages?: string[];
  renderText?: (text: string, key: string, theme: ChatTheme) => ReactNode;
}

export function MessageList({
  chatId,
  theme,
  renderWidget,
  dataLanguages,
  renderText,
}: MessageListProps) {
  // Subscribe narrowly: only this chat's messages array. The store swaps
  // the array reference on every mutation, so FlashList sees new data.
  const messages = useChatStore((s) => s.chats[chatId]?.messages ?? EMPTY);
  const listRef = useRef<FlashListRef<Message>>(null);
  const userCount = messages.reduce((n, m) => (m.sender === 'user' ? n + 1 : n), 0);
  const seenUserCount = useRef<number | null>(null);

  // Chat switch (same component instance): re-arm the first-render guard
  // so hydrating an older conversation never animates.
  useEffect(() => {
    seenUserCount.current = null;
  }, [chatId]);

  useEffect(() => {
    if (seenUserCount.current === null) {
      // First render of this chat (fresh or hydrated from history) —
      // startRenderingFromBottom already positions us; don't animate.
      seenUserCount.current = userCount;
      return;
    }
    if (userCount > seenUserCount.current) {
      seenUserCount.current = userCount;
      const idx = messages.map((m) => m.sender).lastIndexOf('user');
      if (idx >= 0) {
        // Next frame so FlashList has laid the new row out.
        requestAnimationFrame(() => {
          listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0 });
        });
      }
    } else {
      seenUserCount.current = userCount;
    }
  }, [userCount, messages]);

  // When the keyboard opens (input focused), bring the latest message above it.
  // Without this, `behavior="padding"` shrinks the list and the last message is
  // left hidden under the keyboard (bug 0e4bd715). Interactive dismiss still lets
  // the user drag back up to read history.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    });
    return () => sub.remove();
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => (
      <MessageBubble
        message={item}
        theme={theme}
        renderWidget={renderWidget}
        dataLanguages={dataLanguages}
        renderText={renderText}
      />
    ),
    [theme, renderWidget, dataLanguages, renderText],
  );

  return (
    <FlashList
      ref={listRef}
      data={messages}
      renderItem={renderItem}
      keyExtractor={(m) => m.id}
      maintainVisibleContentPosition={{
        autoscrollToBottomThreshold: 0.2,
        startRenderingFromBottom: true,
      }}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    />
  );
}
