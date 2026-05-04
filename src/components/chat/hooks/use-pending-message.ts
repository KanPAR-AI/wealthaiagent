import { useEffect } from 'react';
import { useChatStore } from '@/store/chat';
import { listenToChatStream } from '@/services/chat-service';
import { nanoid } from 'nanoid';

interface UsePendingMessageProps {
  chatId?: string;
  token: string | null;
  isProcessingRef: React.MutableRefObject<boolean>;
  setIsProcessingPendingMessage: (processing: boolean) => void;
  setIsSending: (sending: boolean) => void;
  setStreamingController: (controller: AbortController | null) => void;
  addMessage: (message: any) => void;
  updateMessage: (id: string, updates: any) => void;
  clearPendingMessage: () => void;
}

export function usePendingMessage({
  chatId,
  token,
  isProcessingRef,
  setIsProcessingPendingMessage,
  setIsSending,
  setStreamingController,
  addMessage,
  updateMessage,
  clearPendingMessage,
}: UsePendingMessageProps) {
  const pendingMessage = useChatStore((state) => state.pendingMessage);
  const selectedAgent = useChatStore((state) => state.selectedAgent);

  useEffect(() => {
    const isMockChat = chatId?.startsWith('mock-');
    // Read live from the store, not the closure. Under React StrictMode (dev)
    // the effect runs twice per mount: once, then cleanup, then again with
    // the same closure. The first run synchronously clears pendingMessage,
    // but the second run still sees the stale value in closure — without a
    // live read it re-enters and fires a duplicate SSE + duplicate optimistic
    // adds. Reading from the store sees the cleared null.
    const livePending = useChatStore.getState().pendingMessage;
    const canProcess =
      (token || isMockChat) &&
      chatId &&
      livePending &&
      livePending.chatId === chatId &&
      !isProcessingRef.current;

    if (!canProcess) return;

    const { text, files, useMockService } = livePending;

    isProcessingRef.current = true;
    setIsProcessingPendingMessage(true);

    // Clear immediately so an HMR-induced remount doesn't fire a duplicate
    // SSE for the same first message. Hard refresh wipes the store anyway
    // (no persist middleware), so delaying the clear wouldn't help refresh
    // recovery — that's handled by the backend partial-save (Layer 2).
    clearPendingMessage();

    const userMessageId = nanoid();
    addMessage({
      id: userMessageId,
      message: text,
      sender: 'user',
      files,
      timestamp: new Date().toISOString(),
    });

    setIsSending(true);

    // Bot placeholder uses a local nanoid; backend's `message_start` event
    // will deliver the real Firestore uuid which we swap in via
    // onAssistantId. Without the swap, /regenerate against the local id
    // returns 204 (idempotent on missing) but never actually deletes the
    // partial save server-side.
    let aiMessageIdLive = nanoid();
    addMessage({
      id: aiMessageIdLive,
      message: '',
      sender: 'bot',
      timestamp: new Date().toISOString(),
      isStreaming: true,
      streamingContent: '',
      streamingChunks: [],
    });

    const startListening = async () => {
      const controller = new AbortController();
      setStreamingController(controller);
      try {
        // Wait one tick so the bot placeholder is in the store before any
        // chunk-update tries to address it.
        await new Promise((resolve) => setTimeout(resolve, 50));

        let receivedText = '';
        const streamingChunks: string[] = [];
        const contentBlocks: any[] = [];
        let currentTextBlock = '';

        await listenToChatStream(
          token || 'mock-token',
          chatId,
          (chunk: string, type: string) => {
            if (type === 'text_chunk') {
              receivedText += chunk;
              currentTextBlock += chunk;
              streamingChunks.push(chunk);

              const updatedBlocks = [...contentBlocks];
              if (updatedBlocks.length > 0 && updatedBlocks[updatedBlocks.length - 1].type === 'text') {
                updatedBlocks[updatedBlocks.length - 1] = { type: 'text', content: currentTextBlock };
              } else {
                updatedBlocks.push({ type: 'text', content: currentTextBlock });
              }

              updateMessage(aiMessageIdLive, {
                message: receivedText,
                streamingContent: receivedText,
                streamingChunks: [...streamingChunks],
                contentBlocks: updatedBlocks,
              });
            } else if (type.startsWith('widget_')) {
              try {
                if (currentTextBlock.trim()) {
                  const lastBlock = contentBlocks[contentBlocks.length - 1];
                  if (lastBlock && lastBlock.type === 'text') {
                    contentBlocks[contentBlocks.length - 1] = { type: 'text', content: currentTextBlock };
                  } else {
                    contentBlocks.push({ type: 'text', content: currentTextBlock });
                  }
                  currentTextBlock = '';
                }
                const widgetData = JSON.parse(chunk);
                contentBlocks.push({ type: 'widget', widget: { ...widgetData, type } });
                updateMessage(aiMessageIdLive, { contentBlocks: [...contentBlocks] });
              } catch (error) {
                console.error('[Pending Message] Failed to parse widget data:', error);
              }
            }
          },
          () => {
            if (currentTextBlock.trim()) {
              contentBlocks.push({ type: 'text', content: currentTextBlock });
            }
            updateMessage(aiMessageIdLive, {
              isStreaming: false,
              message: receivedText,
              streamingContent: receivedText,
              contentBlocks: [...contentBlocks],
            });
            setIsSending(false);
            isProcessingRef.current = false;
            setIsProcessingPendingMessage(false);
          },
          (error: any) => {
            console.error('Error in SSE stream for pending message:', error);
            const isTimeout = error?.name === 'TimeoutError' || /timed out/i.test(error?.message || '');
            updateMessage(aiMessageIdLive, {
              message: receivedText,
              streamingContent: receivedText,
              error: isTimeout
                ? 'Connection timed out. Tap Retry to continue.'
                : 'Response interrupted. Tap Retry to continue.',
              isStreaming: false,
            });
            setIsSending(false);
            isProcessingRef.current = false;
            setIsProcessingPendingMessage(false);
          },
          useMockService || isMockChat,
          text,
          selectedAgent,
          controller.signal,
          null, // targetUserMessageId — fresh send
          (backendBotId: string) => {
            if (backendBotId && backendBotId !== aiMessageIdLive) {
              updateMessage(aiMessageIdLive, { id: backendBotId });
              aiMessageIdLive = backendBotId;
            }
          },
        );
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          // Cancelled by unmount — silent. The next mount/route owns UI state from here.
          return;
        }
        console.error('Failed to listen to chat stream:', error);
        updateMessage(aiMessageIdLive, {
          message: '',
          streamingContent: '',
          error: "Couldn't connect. Tap Retry to try again.",
          isStreaming: false,
        });
        setIsSending(false);
        isProcessingRef.current = false;
        setIsProcessingPendingMessage(false);
      }
    };

    startListening();
  }, [
    chatId,
    pendingMessage,
    token,
    addMessage,
    updateMessage,
    clearPendingMessage,
    isProcessingRef,
    setIsProcessingPendingMessage,
    setIsSending,
    setStreamingController,
    selectedAgent,
  ]);
}
