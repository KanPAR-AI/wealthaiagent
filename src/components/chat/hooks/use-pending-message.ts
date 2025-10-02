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

  useEffect(() => {
    if (token && chatId && pendingMessage && pendingMessage.chatId === chatId && !isProcessingRef.current) {
      const { text, files } = pendingMessage;

      isProcessingRef.current = true;
      setIsProcessingPendingMessage(true);
      console.log("Processing pending message for new chat:", pendingMessage);

      clearPendingMessage();

      const userMessageId = nanoid();
      addMessage({
        id: userMessageId,
        message: text,
        sender: "user",
        files,
        timestamp: new Date().toISOString()
      });

      setIsSending(true);

      const aiMessageId = nanoid();
      addMessage({ id: aiMessageId, message: '', sender: 'bot', timestamp: new Date().toISOString(), isStreaming: true });

      const startListening = async () => {
        try {
          let receivedText = '';
          setStreamingController(new AbortController());

          await listenToChatStream(
            token,
            chatId,
            (chunk: string, type: string) => {
              if (type === 'text_chunk') {
                receivedText += chunk;
                updateMessage(aiMessageId, { message: receivedText });
              }
            },
            () => { // onComplete
              updateMessage(aiMessageId, { isStreaming: false });
              setIsSending(false);
              isProcessingRef.current = false;
              setIsProcessingPendingMessage(false);
            },
            (error) => { // onError
              console.error("Error in SSE stream for pending message:", error);
              updateMessage(aiMessageId, {
                message: receivedText || "Error receiving AI response.",
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
