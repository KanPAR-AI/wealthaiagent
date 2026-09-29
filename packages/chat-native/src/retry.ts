// What ↻ Retry means (report 3a74d645, E2 round 3 item B).
//
// PURE. The native apps' Retry used to be `send(lastUser.message)`: a NEW
// user message, persisted server-side as a second identical user row, with
// the failed bot bubble left in place above it. Retry now REGENERATES: the
// same user message, the same bot bubble reset in place, the stream opened
// with `target_user_message_id` — what the web's handleRegenerate does.

import type { Message, MessageFile } from '@wealthai/core';

export interface RetryOf {
  userMessageId: string;
  botMessageId: string;
}

export interface RetryTarget {
  text: string;
  files: MessageFile[];
  retryOf: RetryOf;
}

/**
 * The turn to regenerate. `botMessageId` is the bubble whose Retry was
 * tapped; without one, the newest bot message that carries an error. The
 * user message is the one immediately before that bubble — never "the last
 * user message", which after a later send would be a different question.
 */
export function retryTarget(messages: Message[], botMessageId?: string | null): RetryTarget | null {
  const idx = botMessageId
    ? messages.findIndex((m) => m.id === botMessageId && m.sender === 'bot')
    : (() => {
        for (let i = messages.length - 1; i >= 0; i -= 1) {
          if (messages[i].sender === 'bot' && messages[i].error) return i;
        }
        return -1;
      })();
  if (idx <= 0) return null;
  const user = messages[idx - 1];
  if (!user || user.sender !== 'user') return null;
  return {
    text: user.message,
    files: user.files ?? [],
    retryOf: { userMessageId: user.id, botMessageId: messages[idx].id },
  };
}
