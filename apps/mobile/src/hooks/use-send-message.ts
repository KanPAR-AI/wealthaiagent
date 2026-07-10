// Send-message orchestration — the mobile counterpart of the web's
// use-message-sending hook, driving the SAME @wealthai/core primitives
// (createChatSession, sendChatMessage, listenToChatStreamCore) and the
// SAME shared zustand store.
//
// Web-parity semantics preserved:
//   - Optimistic local nanoids for both bubbles, swapped for backend ids
//     when POST /messages returns (user msg) and when the SSE
//     message_start event arrives (assistant msg).
//   - First message creates the session server-side via createChatSession
//     (which stores it), so no separate POST /messages for message #1.
//   - Widget SSE events accumulate into contentBlocks in stream order.
//
// Mobile-specific: streaming store updates are THROTTLED (~90ms flushes).
// The web updates the store on every chunk; on low-end Android that
// re-renders markdown hundreds of times per reply and stutters the list.
// (Quality bar: ChatGPT-smooth streaming.)

import { useCallback, useRef, useState } from 'react';
import {
  createChatSession,
  listenToChatStreamCore,
  sendChatMessage,
  useChatStore,
  type ContentBlock,
  type MessageFile,
} from '@wealthai/core';

import { getToken } from '@/lib/auth';

const FLUSH_INTERVAL_MS = 90;

function nanoid(): string {
  // Tiny local id generator — avoids pulling web's nanoid package into the
  // RN bundle. Collision domain is one device's optimistic placeholders,
  // which get swapped for backend uuids moments later.
  return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface SendState {
  isSending: boolean;
  /** Set while the first message's session is being created. */
  isCreatingChat: boolean;
}

export function useSendMessage(
  chatId: string | null,
  onChatCreated: (chatId: string) => void,
) {
  const [state, setState] = useState<SendState>({ isSending: false, isCreatingChat: false });
  const controllerRef = useRef<AbortController | null>(null);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const selectedAgent = useChatStore((s) => s.selectedAgent);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const send = useCallback(
    async (text: string, files: MessageFile[] = []) => {
      const trimmed = text.trim();
      if ((!trimmed && files.length === 0) || state.isSending || state.isCreatingChat) return;

      const token = await getToken();
      if (!token) {
        console.warn('[useSendMessage] no auth token — user signed out?');
        return;
      }

      // ── Session bootstrap (first message) ─────────────────────────
      let activeChatId = chatId;
      let isFirstMessage = false;
      if (!activeChatId) {
        setState({ isSending: true, isCreatingChat: true });
        try {
          const { chatId: newChatId } = await createChatSession(token, 'New Chat', trimmed, files);
          activeChatId = newChatId;
          isFirstMessage = true;
          onChatCreated(newChatId);
        } catch (e) {
          console.error('[useSendMessage] createChatSession failed:', e);
          setState({ isSending: false, isCreatingChat: false });
          throw e;
        }
      }

      setState({ isSending: true, isCreatingChat: false });

      let userMessageIdLive = nanoid();
      addMessage(activeChatId, {
        id: userMessageIdLive,
        message: trimmed,
        sender: 'user',
        timestamp: new Date().toISOString(),
        files: files.length > 0 ? files : undefined,
      });

      let aiMessageIdLive = nanoid();
      addMessage(activeChatId, {
        id: aiMessageIdLive,
        message: '',
        sender: 'bot',
        timestamp: new Date().toISOString(),
        isStreaming: true,
        streamingContent: '',
      });

      const controller = new AbortController();
      controllerRef.current = controller;

      // ── Throttled streaming state ─────────────────────────────────
      let receivedText = '';
      let currentTextBlock = '';
      const contentBlocks: ContentBlock[] = [];
      let flushTimer: ReturnType<typeof setTimeout> | null = null;
      let dirty = false;

      const buildBlocks = (): ContentBlock[] => {
        const blocks = [...contentBlocks];
        if (currentTextBlock) blocks.push({ type: 'text', content: currentTextBlock });
        return blocks;
      };
      const flush = () => {
        flushTimer = null;
        if (!dirty) return;
        dirty = false;
        updateMessage(activeChatId!, aiMessageIdLive, {
          message: receivedText,
          streamingContent: receivedText,
          contentBlocks: buildBlocks(),
        });
      };
      const scheduleFlush = () => {
        dirty = true;
        if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
      };
      const finalFlush = (extra: Record<string, unknown>) => {
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
        updateMessage(activeChatId!, aiMessageIdLive, {
          message: receivedText,
          streamingContent: receivedText,
          contentBlocks: buildBlocks(),
          isStreaming: false,
          ...extra,
        });
      };

      // Set by the stream's complete/error callbacks. If the user taps
      // STOP, the SSE reader resolves WITHOUT calling either (caller-
      // cancellation is deliberately not an error in core) — the guard
      // after the await finalizes the bubble with whatever text arrived,
      // mirroring ChatGPT's stop behavior.
      let settled = false;

      try {
        // Message #1 was persisted by createChatSession; later messages
        // POST here and get their backend uuid back.
        if (!isFirstMessage) {
          const backendUserId = await sendChatMessage(
            token, activeChatId, trimmed, files, controller.signal,
          );
          if (backendUserId && backendUserId !== userMessageIdLive) {
            updateMessage(activeChatId, userMessageIdLive, { id: backendUserId });
            userMessageIdLive = backendUserId;
          }
        }

        await listenToChatStreamCore(
          token,
          activeChatId,
          (chunk, type) => {
            if (type === 'text_chunk') {
              receivedText += chunk;
              currentTextBlock += chunk;
              scheduleFlush();
            } else if (type.startsWith('widget_')) {
              // Seal the running text block, then append the widget in
              // stream order (mirrors web's contentBlocks contract).
              if (currentTextBlock.trim()) {
                contentBlocks.push({ type: 'text', content: currentTextBlock });
              }
              currentTextBlock = '';
              try {
                const widgetData = JSON.parse(chunk);
                contentBlocks.push({ type: 'widget', widget: { ...widgetData, type } });
              } catch (e) {
                console.warn('[useSendMessage] unparseable widget payload:', e);
              }
              scheduleFlush();
            }
          },
          () => {
            settled = true;
            finalFlush({});
            setState({ isSending: false, isCreatingChat: false });
          },
          (error) => {
            settled = true;
            // User tapped STOP: the abort surfaces here on platforms whose
            // fetch rejects with a name other than 'AbortError' (expo/fetch
            // does) — core's silent-cancel check misses it. A stop is a
            // success, not an error: freeze the partial text, no banner.
            if (controller.signal.aborted) {
              finalFlush({});
              setState({ isSending: false, isCreatingChat: false });
              return;
            }
            const isTimeout = error?.name === 'TimeoutError' || /timed out/i.test(error?.message || '');
            finalFlush({
              error: isTimeout
                ? 'Connection timed out. Tap to retry.'
                : 'Response interrupted. Tap to retry.',
            });
            setState({ isSending: false, isCreatingChat: false });
          },
          {
            forceAgent: selectedAgent,
            externalSignal: controller.signal,
            onAssistantId: (backendBotId) => {
              if (backendBotId && backendBotId !== aiMessageIdLive) {
                updateMessage(activeChatId!, aiMessageIdLive, { id: backendBotId });
                aiMessageIdLive = backendBotId;
              }
            },
          },
        );
        // User tapped stop (or unmount aborted): the reader returned
        // without settling. Freeze the partial reply as a normal message.
        if (!settled) {
          finalFlush({});
          setState({ isSending: false, isCreatingChat: false });
        }
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          console.error('[useSendMessage] send failed:', error);
          finalFlush({ error: "Couldn't get a response. Tap to retry." });
        } else if (!settled) {
          finalFlush({});
        }
        setState({ isSending: false, isCreatingChat: false });
      }
    },
    [chatId, state.isSending, state.isCreatingChat, addMessage, updateMessage, selectedAgent, onChatCreated],
  );

  return { ...state, send, cancel };
}
