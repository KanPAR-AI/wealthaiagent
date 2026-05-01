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
  const selectedAgent = useChatStore(state => state.selectedAgent);

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
    
    // Check if this is a mock chat
    const isMockChat = chatId?.startsWith('mock-');
    
    // For mock chats, we don't need a real token
    const canProcess = (token || isMockChat) && chatId && pendingMessage && pendingMessage.chatId === chatId && !isProcessingRef.current;
    
    if (canProcess) {
      const { text, files, useMockService } = pendingMessage;

      isProcessingRef.current = true;
      setIsProcessingPendingMessage(true);
      console.log("[Pending Message] Processing pending message for new chat:", pendingMessage);

      // Clear immediately so an HMR-induced remount doesn't fire a duplicate
      // SSE for the same first message. Hard refresh wipes the store anyway
      // (no persist middleware), so delaying the clear wouldn't help refresh
      // recovery — that's handled by the backend partial-save (Layer 2).
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
        // One controller for this stream. The unmount cleanup in
        // useChatWindowState will call abort() on this if the user navigates
        // away, causing listenToChatStream to exit cleanly.
        const controller = new AbortController();
        setStreamingController(controller);
        try {
          // CRITICAL: Wait for the message to be added to the store before starting stream
          // This prevents race condition where we try to update a non-existent message
          await new Promise(resolve => setTimeout(resolve, 50));
          console.log("[Pending Message] Bot message should be in store now, opening SSE stream for chat:", chatId);
          let receivedText = '';
          const streamingChunks: string[] = [];
          const contentBlocks: any[] = [];
          let currentTextBlock = '';

          await listenToChatStream(
            token || 'mock-token', // Use dummy token for mock service
            chatId,
            (chunk: string, type: string) => {
              console.log('[Pending Message] Chunk received:', {
                type,
                chunk: JSON.stringify(chunk),
                chunkLength: chunk.length,
              });
              
              if (type === 'text_chunk') {
                receivedText += chunk;
                currentTextBlock += chunk;
                streamingChunks.push(chunk);
                console.log('[Pending Message] Streaming chunk received:', chunk);
                console.log('[Pending Message] Total content so far:', receivedText);
                
                // Update content blocks with current streaming text
                const updatedBlocks = [...contentBlocks];
                
                // If we have a text block being accumulated, update or add it
                if (updatedBlocks.length > 0 && updatedBlocks[updatedBlocks.length - 1].type === 'text') {
                  // Update existing last text block
                  updatedBlocks[updatedBlocks.length - 1] = {
                    type: 'text',
                    content: currentTextBlock
                  };
                } else {
                  // Add new text block (happens after first widget or at start)
                  updatedBlocks.push({
                    type: 'text',
                    content: currentTextBlock
                  });
                }
                
                updateMessage(aiMessageId, { 
                  message: receivedText, // Keep for backward compatibility
                  streamingContent: receivedText,
                  streamingChunks: [...streamingChunks],
                  contentBlocks: updatedBlocks,
                });
              } else if (type.startsWith('widget_')) {
                // Handle widget events from mock service
                console.log('[Pending Message] Widget event received:', type, chunk);
                try {
                  // Finalize current text block before widget
                  if (currentTextBlock.trim()) {
                    // Update or add the last text block as finalized
                    const lastBlock = contentBlocks[contentBlocks.length - 1];
                    if (lastBlock && lastBlock.type === 'text') {
                      // Already added during text streaming, just finalize it
                      contentBlocks[contentBlocks.length - 1] = {
                        type: 'text',
                        content: currentTextBlock
                      };
                    } else {
                      // Add new text block
                      contentBlocks.push({ type: 'text', content: currentTextBlock });
                    }
                    currentTextBlock = ''; // Reset for next text segment
                  }
                  
                  // Add widget block
                  const widgetData = JSON.parse(chunk);
                  contentBlocks.push({ 
                    type: 'widget', 
                    widget: { ...widgetData, type } 
                  });
                  
                  console.log('[Pending Message] Content blocks updated. Total blocks:', contentBlocks.length);
                  updateMessage(aiMessageId, { 
                    contentBlocks: [...contentBlocks],
                  });
                } catch (error) {
                  console.error('[Pending Message] Failed to parse widget data:', error);
                }
              }
            },
            () => { // onComplete
              console.log('[Pending Message] Stream complete. Final content:', receivedText);
              
              // Add any remaining text as final block
              if (currentTextBlock.trim()) {
                contentBlocks.push({ type: 'text', content: currentTextBlock });
              }
              
              updateMessage(aiMessageId, { 
                isStreaming: false,
                message: receivedText, // Ensure final content is in message field
                streamingContent: receivedText,
                contentBlocks: [...contentBlocks],
              });
              setIsSending(false);
              isProcessingRef.current = false;
              setIsProcessingPendingMessage(false);
            },
            (error: any) => { // onError
              console.error("Error in SSE stream for pending message:", error);
              const isTimeout = error?.name === "TimeoutError" || /timed out/i.test(error?.message || "");
              updateMessage(aiMessageId, {
                message: receivedText,
                streamingContent: receivedText,
                error: isTimeout
                  ? "Connection timed out. Tap Retry to continue."
                  : "Response interrupted. Tap Retry to continue.",
                isStreaming: false
              });
              setIsSending(false);
              isProcessingRef.current = false;
              setIsProcessingPendingMessage(false);
            },
            useMockService || isMockChat,
            text,
            selectedAgent,
            controller.signal,
          );
        } catch (error: any) {
          if (error?.name === "AbortError") {
            // Cancelled by unmount — silent. The next mount/route will pick up state.
            return;
          }
          console.error("Failed to listen to chat stream:", error);
          updateMessage(aiMessageId, {
            message: '',
            streamingContent: '',
            error: "Couldn't connect. Tap Retry to try again.",
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