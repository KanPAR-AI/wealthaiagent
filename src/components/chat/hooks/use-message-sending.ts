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

  const handleSend = async (text: string, attachments: MessageFile[], useMockService?: boolean) => {
    console.log("[handleSend] Called with:", { text, attachmentCount: attachments.length, chatId, useMockService });
    console.log("[handleSend] Current state:", { 
      isSending, 
      isRegenerating, 
      isLoadingToken, 
      hasToken: !!token, 
      isNewChatInitiating 
    });
    
    if (!text.trim() && attachments.length === 0) {
      console.warn("[handleSend] Send aborted: No text and no files to send.");
      return;
    }
    
    // For mock service, we don't need a real token
    if (isSending || isRegenerating || isNewChatInitiating) {
      console.warn("[handleSend] Send aborted: busy or new chat initiating.");
      return;
    }
    
    // Only check for token if NOT using mock service
    if (!useMockService && (isLoadingToken || !token)) {
      console.warn("[handleSend] Send aborted: loading token or no token (real service requires token).");
      return;
    }

    if (!chatId) {
      // Logic for a NEW CHAT
      console.log("[useMessageSending] Starting NEW CHAT creation", { useMockService });
      try {
        setIsNewChatInitiating(true);
        
        // If using mock service, skip creating real chat session
        if (useMockService) {
          console.log("[useMessageSending] Using mock service - creating mock chat ID");
          const mockChatId = `mock-${Date.now()}`;
          console.log("[useMessageSending] Mock chat ID:", mockChatId);
          console.log("[useMessageSending] Setting pending message with mock flag");
          setPendingMessage(text, attachments, mockChatId, true);
          console.log("[useMessageSending] Navigating to /chat/" + mockChatId);
          navigate(`/chat/${mockChatId}`);
        } else {
          console.log("[useMessageSending] Creating real chat session...");
          const newChatId = await createChatSession(token!, "New Chat", text, attachments); // Use non-null assertion since we checked token above
          console.log("[useMessageSending] Chat created with ID:", newChatId);
          console.log("[useMessageSending] Setting pending message for chatId:", newChatId);
          setPendingMessage(text, attachments, newChatId, false);
          console.log("[useMessageSending] Navigating to /chat/" + newChatId);
          navigate(`/chat/${newChatId}`);
        }
      } catch (error) {
        console.error("Failed to create new chat session:", error);
        setIsNewChatInitiating(false);
      }
      return;
    }

    // Logic for an EXISTING CHAT
    console.log("[useMessageSending] Starting message send for EXISTING chat:", chatId, { useMockService });
    
    // Check if this is a mock chat (chat ID starts with "mock-")
    const isMockChat = chatId.startsWith('mock-');
    console.log("[useMessageSending] Is mock chat:", isMockChat);
    
    setIsSending(true);

    const userMessageId = nanoid();
    console.log("[useMessageSending] Adding user message with ID:", userMessageId);
    addMessage({
      id: userMessageId,
      message: text,
      sender: "user",
      files: attachments,
      timestamp: new Date().toISOString(),
    });
    setLastUserMessageId(userMessageId);

    const aiMessageId = nanoid();
    console.log("[useMessageSending] Adding bot placeholder message with ID:", aiMessageId, "to chat:", chatId);
    addMessage({
      id: aiMessageId,
      message: '',
      sender: 'bot',
      timestamp: new Date().toISOString(),
      isStreaming: true,
      streamingContent: '',
      streamingChunks: [],
    });
    console.log("[useMessageSending] Bot message addMessage() called, should be in store now");

    try {
      // Only send message to backend if NOT a mock chat
      if (!isMockChat && !useMockService) {
        console.log("[useMessageSending] Sending message to real backend API");
        await sendChatMessage(token!, chatId, text, attachments); // Use non-null assertion since we checked token above
      } else {
        console.log("[useMessageSending] Skipping real API call for mock chat");
      }

      let receivedText = '';
      const streamingChunks: string[] = [];
      const widgets: any[] = [];
      setStreamingController(new AbortController());

      await listenToChatStream(
        token || 'mock-token', // Use dummy token for mock service
        chatId,
        (chunk: string, type: string) => {
          console.log('[useMessageSending] Chunk received:', {
            type,
            chunk: JSON.stringify(chunk),
            chunkLength: chunk.length,
            receivedTextLengthBefore: receivedText.length,
          });
          
          if (type === 'text_chunk') {
            receivedText += chunk;
            streamingChunks.push(chunk);
            console.log('[useMessageSending] Text accumulated:', {
              totalLength: receivedText.length,
              firstChars: receivedText.substring(0, 20),
              chunkCount: streamingChunks.length,
            });
            updateMessage(aiMessageId, { 
              message: receivedText, // Keep for backward compatibility
              streamingContent: receivedText,
              streamingChunks: [...streamingChunks],
            });
          } else if (type.startsWith('widget_')) {
            // Handle widget events from mock service
            console.log('[useMessageSending] Widget event received:', type, chunk);
            try {
              const widgetData = JSON.parse(chunk);
              widgets.push({ ...widgetData, type });
              console.log('[useMessageSending] Widget added. Total widgets:', widgets.length);
              updateMessage(aiMessageId, { 
                widgets: [...widgets],
              });
            } catch (error) {
              console.error('[useMessageSending] Failed to parse widget data:', error);
            }
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
        },
        useMockService || isMockChat, // Pass mock service flag (true if explicitly set OR if chat ID is mock)
        text // Pass prompt text for contextual mock responses
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