// One reading: ask a question, stream the astrology agent's answer.
//
// This is the bootstrap chat surface for the standalone app — deliberately
// the minimum that proves the pinned path end to end (docs/49 ASTRAL-68).
// It is NOT a second chat client: apps/mobile's use-send-message.ts holds
// the full message lifecycle (stream-drop reconciliation, stop-vs-error,
// throttled flushes, widget content blocks), and duplicating a weaker copy
// here is how the two apps drift. That hook moves into a shared package
// before this app grows a real chat screen; until then this file stays
// small enough that replacing it is trivial.
//
// Widget blocks are counted but not rendered: the RN renderer adapter still
// lives in apps/mobile/src/components/astral/ and has to be shared
// deliberately. A reading that emits one shows its text, not a blank.

import {
  createChatSession,
  listenToChatStreamCore,
  sendChatMessage,
  stripRoutingTag,
} from '@wealthai/core';

import { getToken } from './auth';
import { ensureCoreInitialized } from './core-adapter';
import { PINNED_AGENT } from './env';

ensureCoreInitialized();

export interface AskHandle {
  /** The chat this reading belongs to — pass it back to continue. */
  chatId: string;
  /** Abort the in-flight stream. A stop is not an error. */
  stop: () => void;
  /** Resolves with the full reply text once the stream settles. */
  done: Promise<string>;
}

export interface AskOptions {
  /** Continue an existing reading. Omit to start a new one. */
  chatId?: string | null;
  onDelta: (fullTextSoFar: string) => void;
  onWidget?: (type: string, payload: unknown) => void;
}

export async function ask(question: string, opts: AskOptions): Promise<AskHandle> {
  const { chatId: existing, onDelta, onWidget } = opts;
  const token = await getToken();

  // The first message is persisted by createChatSession itself, so a new
  // reading must NOT also POST it — that is the double-user-message bug.
  const chatId = existing ?? (await createChatSession(token, 'Reading', question, [])).chatId;
  if (existing) await sendChatMessage(token, existing, question, []);

  const controller = new AbortController();
  let text = '';

  let streamError: Error | null = null;

  const done = (async () => {
    await listenToChatStreamCore(
      token,
      chatId,
      (chunk, type) => {
        if (type === 'text_chunk') {
          // The router's "[Using X agent]" tag arrives as the first chunk of
          // a reply and a live stream never passes through mapHistoryMessage,
          // which is the other place it is stripped.
          text = stripRoutingTag(text + chunk);
          onDelta(text);
        } else if (type.startsWith('widget_') && onWidget) {
          try {
            onWidget(type, JSON.parse(chunk));
          } catch {
            /* a truncated widget payload is not worth failing the turn over */
          }
        }
      },
      () => {},
      (error) => {
        // Recorded, not thrown: this runs inside core's reader loop, where a
        // throw would be swallowed and the caller would wait forever.
        streamError = error;
      },
      { forceAgent: PINNED_AGENT, externalSignal: controller.signal },
    );
    // A stop is a success with less text, not a failure.
    if (streamError && !controller.signal.aborted) throw streamError;
    return text;
  })();

  return { chatId, stop: () => controller.abort(), done };
}
