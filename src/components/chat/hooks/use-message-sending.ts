// import React from 'react';
import { MessageFile } from '@/types';
import { createChatSession, sendChatMessage, listenToChatStream } from '@/services/chat-service';
import { useChatStore } from '@/store/chat';
import { nanoid } from 'nanoid';
import { useNavigate } from 'react-router-dom';

interface UseMessageSendingProps {
  chatId?: string;
  token: string | null;
  isSending: boolean;
  isRegenerating: boolean;
  isLoadingToken: boolean;
  isNewChatInitiating: boolean;
  setIsSending: (sending: boolean) => void;
  setIsNewChatInitiating: (initiating: boolean) => void;
  setLastUserMessageId: (id: string | null) => void;
  setStreamingController: (controller: AbortController | null) => void;
  addMessage: (message: any) => void;
  updateMessage: (id: string, updates: any) => void;
  contextPrompt?: string; // Optional context prompt to prepend to messages
}

export function useMessageSending({
  chatId,
  token,
  isSending,
  isRegenerating,
  isLoadingToken,
  isNewChatInitiating,
  setIsSending,
  setIsNewChatInitiating,
  setLastUserMessageId,
  setStreamingController,
  addMessage,
  updateMessage,
  contextPrompt,
}: UseMessageSendingProps) {
  const navigate = useNavigate();
  const setPendingMessage = useChatStore((state) => state.setPendingMessage);
  const selectedAgent = useChatStore((state) => state.selectedAgent);

  const handleSend = async (text: string, attachments: MessageFile[], useMockService?: boolean) => {
    if (!text.trim() && attachments.length === 0) {
      return;
    }

    const messageText = contextPrompt ? `${contextPrompt}\n\n${text.trim()}` : text.trim();

    if (isSending || isRegenerating || isNewChatInitiating) {
      console.warn('[handleSend] Send aborted: busy or new chat initiating.');
      return;
    }

    if (!useMockService && (isLoadingToken || !token)) {
      console.warn('[handleSend] Send aborted: loading token or no token.');
      return;
    }

    if (!chatId) {
      try {
        setIsNewChatInitiating(true);

        if (useMockService) {
          const mockChatId = `mock-${Date.now()}`;
          setPendingMessage(text, attachments, mockChatId, true);
          navigate(`/chat/${mockChatId}`);
        } else {
          const { chatId: newChatId } = await createChatSession(token!, 'New Chat', messageText, attachments);
          setPendingMessage(text, attachments, newChatId, false);
          navigate(`/chat/${newChatId}`);
        }
      } catch (error) {
        console.error('Failed to create new chat session:', error);
        setIsNewChatInitiating(false);
      }
      return;
    }

    const isMockChat = chatId.startsWith('mock-');
    setIsSending(true);

    // Frontend assigns local nanoids for optimistic UI. After the backend
    // POST returns we swap the user msg id for the Firestore uuid; after
    // the SSE `message_start` event we swap the bot msg id. Without these
    // swaps, /regenerate and target_user_message_id never resolve because
    // the backend has no record of the local nanoids. All updateMessage
    // calls below reference the *Live vars (not the original nanoids) so
    // they keep targeting the same store row across the swap.
    let userMessageIdLive = nanoid();
    addMessage({
      id: userMessageIdLive,
      message: text,
      sender: 'user',
      files: attachments,
      timestamp: new Date().toISOString(),
    });
    setLastUserMessageId(userMessageIdLive);

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

    // One controller for the whole send lifecycle (POST + SSE). Aborting
    // it cancels both the HTTP fetch and the SSE reader. Stored in
    // component state so the unmount cleanup in useChatWindowState can
    // call abort() on it.
    const controller = new AbortController();
    setStreamingController(controller);

    try {
      if (!isMockChat && !useMockService) {
        const backendUserId = await sendChatMessage(token!, chatId, messageText, attachments, controller.signal);
        if (backendUserId && backendUserId !== userMessageIdLive) {
          updateMessage(userMessageIdLive, { id: backendUserId });
          userMessageIdLive = backendUserId;
          setLastUserMessageId(backendUserId);
        }
      }

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
              console.error('[useMessageSending] Failed to parse widget data:', error);
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
        },
        (error: any) => {
          console.error('Error in SSE stream:', error);
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
        },
        useMockService || isMockChat,
        text,
        selectedAgent,
        controller.signal,
        null, // targetUserMessageId — fresh send, not a regenerate
        // onAssistantId: backend's stable assistant uuid arrives here.
        // Swap our local nanoid for it so /regenerate and Retry resolve
        // server-side. Mutating aiMessageIdLive here is what justifies the
        // `let` declaration above — without the reassignment the linter
        // would (correctly) demand `const`.
        (backendBotId: string) => {
          if (backendBotId && backendBotId !== aiMessageIdLive) {
            updateMessage(aiMessageIdLive, { id: backendBotId });
            aiMessageIdLive = backendBotId;
          }
        },
      );
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return;
      }
      const isTimeout = error?.name === 'TimeoutError' || /timed out/i.test(error?.message || '');
      console.error('Failed to send message:', error);
      updateMessage(aiMessageIdLive, {
        message: '',
        streamingContent: '',
        error: isTimeout
          ? 'Request timed out. Tap Retry to try again.'
          : "Couldn't get a response. Tap Retry to try again.",
        isStreaming: false,
      });
      setIsSending(false);
    }
  };

  return { handleSend };
}
