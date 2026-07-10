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
  fetchChatHistory,
  listenToChatStreamCore,
  mapHistoryMessage,
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

      // ── Stream-drop reconciliation ────────────────────────────────
      // Mobile SSE connections die mid-reply (long silent vision passes,
      // cell handoffs) while the backend finishes and persists the full
      // message anyway. Before surfacing "tap to retry" — which would
      // re-run the whole (expensive) agent — poll the chat history a few
      // times for the completed reply and splice it into the bubble.
      // Match by the backend assistant id when message_start delivered
      // one; otherwise take the newest assistant message iff it's the
      // last message in the chat and has at least the text we streamed.
      const reconcileFromServer = async (): Promise<boolean> => {
        const delays = [1200, 4000, 8000];
        for (const delay of delays) {
          await new Promise((r) => setTimeout(r, delay));
          if (controller.signal.aborted) return false;
          try {
            const history = await fetchChatHistory(token, activeChatId!);
            const msgs = [...(history.messages || [])].sort((a: any, b: any) =>
              String(a.timestamp || '').localeCompare(String(b.timestamp || '')),
            );
            if (!msgs.length) continue;
            const byId = msgs.find((m: any) => m.id === aiMessageIdLive);
            let candidate: any = null;
            if (byId) {
              candidate = byId;
            } else {
              const last = msgs[msgs.length - 1];
              if (last?.sender === 'assistant') candidate = last;
            }
            if (!candidate) continue; // reply not persisted yet — poll again
            const mapped = mapHistoryMessage(candidate);
            // Strictly MORE content than we streamed, or reconciling adds
            // nothing — a server that persisted the same truncated text
            // (local backends cancel the run on disconnect) should fall
            // through to the error + Retry, not silently pass off the
            // partial reply as complete.
            if (!mapped.message || mapped.message.length <= receivedText.length) continue;
            if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
            updateMessage(activeChatId!, aiMessageIdLive, {
              id: mapped.id || aiMessageIdLive,
              message: mapped.message,
              streamingContent: mapped.message,
              contentBlocks: mapped.contentBlocks,
              isStreaming: false,
            });
            return true;
          } catch { /* network still flaky — next attempt */ }
        }
        return false;
      };

      // Shared failure path for stream error + send exception: reconcile
      // first (bubble keeps its streaming shimmer), error only if the
      // server truly has nothing.
      const failWithReconcile = async (errorText: string) => {
        const recovered = await reconcileFromServer();
        if (!recovered) {
          // A stop during reconciliation is still a stop, not an error.
          finalFlush(controller.signal.aborted ? {} : { error: errorText });
        }
        setState({ isSending: false, isCreatingChat: false });
      };

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
            void failWithReconcile(
              isTimeout
                ? 'Connection timed out. Tap to retry.'
                : 'Response interrupted. Tap to retry.',
            );
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
        // The reader returned without message_complete OR an error. Two
        // very different causes share this shape:
        //   - user tapped STOP (abort) → freeze the partial text quietly;
        //   - the connection died in a way that surfaces as a clean EOF
        //     (severed TCP mid-SSE does this on expo/fetch) → the backend
        //     is likely still finishing; reconcile before bothering the
        //     user. This was the filed "response stopped" bug: no error,
        //     no recovery, just a silently truncated reply.
        if (!settled) {
          if (controller.signal.aborted) {
            finalFlush({});
            setState({ isSending: false, isCreatingChat: false });
          } else {
            await failWithReconcile('Response interrupted. Tap to retry.');
          }
        }
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          console.error('[useSendMessage] send failed:', error);
          await failWithReconcile("Couldn't get a response. Tap to retry.");
        } else {
          if (!settled) finalFlush({});
          setState({ isSending: false, isCreatingChat: false });
        }
      }
    },
    [chatId, state.isSending, state.isCreatingChat, addMessage, updateMessage, selectedAgent, onChatCreated],
  );

  return { ...state, send, cancel };
}
