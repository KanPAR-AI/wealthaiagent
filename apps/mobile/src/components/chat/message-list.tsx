// Chat message list on FlashList v2.
//
// The ChatGPT-scroll contract (quality bar):
//   - render pinned to the bottom on entry (startRenderingFromBottom)
//   - autoscroll as streamed tokens grow the last message, BUT ONLY when
//     the user is already near the bottom (autoscrollToBottomThreshold) —
//     scrolling up to re-read must never be hijacked
//   - interactive keyboard dismiss (drag the list down over the keyboard)

import { FlashList } from '@shopify/flash-list';
import { useCallback } from 'react';
import { useChatStore, type Message } from '@wealthai/core';

import { MessageBubble } from './message-bubble';

const EMPTY: Message[] = [];

export function MessageList({ chatId }: { chatId: string }) {
  // Subscribe narrowly: only this chat's messages array. The store swaps
  // the array reference on every mutation, so FlashList sees new data.
  const messages = useChatStore((s) => s.chats[chatId]?.messages ?? EMPTY);

  const renderItem = useCallback(
    ({ item }: { item: Message }) => <MessageBubble message={item} />,
    [],
  );

  return (
    <FlashList
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
