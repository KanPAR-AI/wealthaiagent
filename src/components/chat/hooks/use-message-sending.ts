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
}: UseMessageSendingProps) {
  const navigate = useNavigate();
  const setPendingMessage = useChatStore(state => state.setPendingMessage);

  const handleSend = async (text: string, attachments: MessageFile[]) => {
    console.log("message:", text, attachments);
    if (!text.trim() && attachments.length === 0) {
      console.warn("Send aborted: No text and no files to send.");
      return;
    }
    if (isSending || isRegenerating || isLoadingToken || !token || isNewChatInitiating) {
      console.warn("Send aborted: busy, loading, or no token, or new chat initiating.");
      return;
    }

    if (!chatId) {
      // Logic for a NEW CHAT
      try {
        setIsNewChatInitiating(true);
        const newChatId = await createChatSession(token, "New Chat", text, attachments);
        setPendingMessage(text, attachments, newChatId);
        navigate(`/chat/${newChatId}`);
      } catch (error) {
        console.error("Failed to create new chat session:", error);
        setIsNewChatInitiating(false);
      }
      return;
    }

    // Logic for an EXISTING CHAT
    setIsSending(true);

    const userMessageId = nanoid();
    addMessage({
      id: userMessageId,
      message: text,
      sender: "user",
      files: attachments,
      timestamp: new Date().toISOString(),
    });
    setLastUserMessageId(userMessageId);

    const aiMessageId = nanoid();
    addMessage({
      id: aiMessageId,
      message: '',
      sender: 'bot',
      timestamp: new Date().toISOString(),
      isStreaming: true,
      streamingContent: '',
      streamingChunks: [],
    });

    try {
      await sendChatMessage(token, chatId, text, attachments);

      let receivedText = '';
      let streamingChunks: string[] = [];
      setStreamingController(new AbortController());

      await listenToChatStream(
        token,
        chatId,
        (chunk: string, type: string) => {
          if (type === 'text_chunk') {
            receivedText += chunk;
            streamingChunks.push(chunk);
            console.log('Streaming chunk received:', chunk);
            console.log('Total content so far:', receivedText);
            updateMessage(aiMessageId, { 
              message: receivedText, // Keep for backward compatibility
              streamingContent: receivedText,
              streamingChunks: [...streamingChunks],
            });
          }
        },
        () => { // onComplete
          updateMessage(aiMessageId, { 
            isStreaming: false,
            message: receivedText, // Ensure final content is in message field
            streamingContent: receivedText,
          });
          setIsSending(false);
        },
        (error) => { // onError
          console.error("Error in SSE stream:", error);
          updateMessage(aiMessageId, {
            message: receivedText || "Error getting AI response",
            streamingContent: receivedText || "Error getting AI response",
            error: "Failed response",
            isStreaming: false,
          });
          setIsSending(false);
        }
      );
    } catch (error) {
      console.error("Failed to send message:", error);
      updateMessage(aiMessageId, {
        message: "Error processing message.",
        streamingContent: "Error processing message.",
        error: "Failed response",
        isStreaming: false,
      });
      setIsSending(false);
    }
  };

  return { handleSend };
}