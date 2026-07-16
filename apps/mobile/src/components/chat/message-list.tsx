// Chat message list on FlashList v2.
//
// The ChatGPT-scroll contract (quality bar):
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

import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useCallback, useEffect, useRef } from 'react';
import { Keyboard } from 'react-native';
import { useChatStore, type Message } from '@wealthai/core';

import { MessageBubble } from './message-bubble';

const EMPTY: Message[] = [];

export function MessageList({ chatId }: { chatId: string }) {
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
    ({ item }: { item: Message }) => <MessageBubble message={item} />,
    [],
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
