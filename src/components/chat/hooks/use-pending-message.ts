import { useEffect } from 'react';
// import { MessageFile } from '@/types';
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
  const pendingMessage = useChatStore(state => state.pendingMessage);

  console.log('[usePendingMessage] Hook render:', {
    chatId,
    hasPendingMessage: !!pendingMessage,
    pendingChatId: pendingMessage?.chatId,
    isProcessing: isProcessingRef.current
  });

  useEffect(() => {
    console.log('[usePendingMessage] Effect running with:', {
      hasToken: !!token,
      hasChatId: !!chatId,
      hasPendingMessage: !!pendingMessage,
      pendingChatId: pendingMessage?.chatId,
      chatIdMatches: pendingMessage?.chatId === chatId,
      isProcessing: isProcessingRef.current
    });
    
    if (token && chatId && pendingMessage && pendingMessage.chatId === chatId && !isProcessingRef.current) {
      const { text, files } = pendingMessage;

      isProcessingRef.current = true;
      setIsProcessingPendingMessage(true);
      console.log("[Pending Message] Processing pending message for new chat:", pendingMessage);
      console.log("[Pending Message] Chat ID:", chatId);

      clearPendingMessage();

      const userMessageId = nanoid();
      console.log("[Pending Message] Adding user message with ID:", userMessageId);
      addMessage({
        id: userMessageId,
        message: text,
        sender: "user",
        files,
        timestamp: new Date().toISOString()
      });

      setIsSending(true);

      const aiMessageId = nanoid();
      console.log("[Pending Message] Adding bot placeholder message with ID:", aiMessageId);
      console.log("[Pending Message] About to call addMessage for bot placeholder");
      
      // Add bot message
      addMessage({ 
        id: aiMessageId, 
        message: '', 
        sender: 'bot', 
        timestamp: new Date().toISOString(), 
        isStreaming: true,
        streamingContent: '',
        streamingChunks: [],
      });
      
      console.log("[Pending Message] Bot message addMessage() completed");
      console.log("[Pending Message] Bot message ID that will be updated:", aiMessageId);
      
      // Verify it was added
      setTimeout(() => {
        const storeMessages = useChatStore.getState().chats[chatId]?.messages || [];
        const botMessageInStore = storeMessages.find(m => m.id === aiMessageId);
        console.log("[Pending Message] Verification - Bot message in store?", !!botMessageInStore);
        console.log("[Pending Message] Total messages in store:", storeMessages.length);
        if (!botMessageInStore) {
          console.error("[Pending Message] ERROR: Bot message NOT found in store after adding!");
          alert("DEBUG: Bot message not in store! Check console.");
        }
      }, 100);

      const startListening = async () => {
        try {
          // CRITICAL: Wait for the message to be added to the store before starting stream
          // This prevents race condition where we try to update a non-existent message
          await new Promise(resolve => setTimeout(resolve, 50));
          console.log("[Pending Message] Bot message should be in store now, opening SSE stream for chat:", chatId);
          let receivedText = '';
          const streamingChunks: string[] = [];
          setStreamingController(new AbortController());

          await listenToChatStream(
            token,
            chatId,
            (chunk: string, type: string) => {
              if (type === 'text_chunk') {
                receivedText += chunk;
                streamingChunks.push(chunk);
                console.log('[Pending Message] Streaming chunk received:', chunk);
                console.log('[Pending Message] Total content so far:', receivedText);
                updateMessage(aiMessageId, { 
                  message: receivedText, // Keep for backward compatibility
                  streamingContent: receivedText,
                  streamingChunks: [...streamingChunks],
                });
              }
            },
            () => { // onComplete
              console.log('[Pending Message] Stream complete. Final content:', receivedText);
              updateMessage(aiMessageId, { 
                isStreaming: false,
                message: receivedText, // Ensure final content is in message field
                streamingContent: receivedText,
              });
              setIsSending(false);
              isProcessingRef.current = false;
              setIsProcessingPendingMessage(false);
            },
            (error) => { // onError
              console.error("Error in SSE stream for pending message:", error);
              updateMessage(aiMessageId, {
                message: receivedText || "Error receiving AI response.",
                streamingContent: receivedText || "Error receiving AI response.",
                error: "Failed response",
                isStreaming: false
              });
              setIsSending(false);
              isProcessingRef.current = false;
              setIsProcessingPendingMessage(false);
            }
          );
        } catch (error) {
          console.error("Failed to listen to chat stream:", error);
          updateMessage(aiMessageId, {
            message: "Error connecting to AI.",
            streamingContent: "Error connecting to AI.",
            error: "Failed response",
            isStreaming: false
          });
          setIsSending(false);
          isProcessingRef.current = false;
          setIsProcessingPendingMessage(false);
        }
      };

      startListening();
    }
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
  ]);
}