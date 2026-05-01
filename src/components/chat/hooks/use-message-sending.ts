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
  const setPendingMessage = useChatStore(state => state.setPendingMessage);
  const selectedAgent = useChatStore(state => state.selectedAgent);

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

    // Prepend context prompt if provided
    const messageText = contextPrompt 
      ? `${contextPrompt}\n\n${text.trim()}`
      : text.trim();
    
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
          const newChatId = await createChatSession(token!, "New Chat", messageText, attachments); // Use messageText with context
          console.log("[useMessageSending] Chat created with ID:", newChatId);
          console.log("[useMessageSending] Setting pending message for chatId:", newChatId);
          setPendingMessage(text, attachments, newChatId, false); // Store original text for display
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

    // One controller for the whole send lifecycle (POST + SSE). Aborting it
    // cancels both the HTTP fetch and the SSE reader. Stored in component
    // state so the unmount cleanup in useChatWindowState can call abort().
    const controller = new AbortController();
    setStreamingController(controller);

    try {
      // Only send message to backend if NOT a mock chat
      if (!isMockChat && !useMockService) {
        console.log("[useMessageSending] Sending message to real backend API");
        await sendChatMessage(token!, chatId, messageText, attachments, controller.signal);
      } else {
        console.log("[useMessageSending] Skipping real API call for mock chat");
      }

      let receivedText = '';
      const streamingChunks: string[] = [];
      const contentBlocks: any[] = [];
      let currentTextBlock = '';

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
            currentTextBlock += chunk;
            streamingChunks.push(chunk);
            console.log('[useMessageSending] Text accumulated:', {
              totalLength: receivedText.length,
              firstChars: receivedText.substring(0, 20),
              chunkCount: streamingChunks.length,
            });
            
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
            console.log('[useMessageSending] Widget event received:', type, chunk);
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
              
              console.log('[useMessageSending] Content blocks updated. Total blocks:', contentBlocks.length);
              updateMessage(aiMessageId, { 
                contentBlocks: [...contentBlocks],
              });
            } catch (error) {
              console.error('[useMessageSending] Failed to parse widget data:', error);
            }
          }
        },
        () => { // onComplete
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
        },
        (error: any) => { // onError
          console.error("Error in SSE stream:", error);
          const isTimeout = error?.name === "TimeoutError" || /timed out/i.test(error?.message || "");
          // Preserve any partial text the user already saw — don't replace it
          // with an error string. The Retry button on the bubble lets them
          // regenerate without losing what was streamed.
          updateMessage(aiMessageId, {
            message: receivedText,
            streamingContent: receivedText,
            error: isTimeout
              ? "Connection timed out. Tap Retry to continue."
              : "Response interrupted. Tap Retry to continue.",
            isStreaming: false,
          });
          setIsSending(false);
        },
        useMockService || isMockChat, // Pass mock service flag (true if explicitly set OR if chat ID is mock)
        text, // Pass prompt text for contextual mock responses
        selectedAgent, // Force specific agent if user selected one
        controller.signal,
      );
    } catch (error: any) {
      // AbortError from caller-cancellation (unmount, new send) is silent —
      // the new mount or the new send will own the UI from here.
      if (error?.name === "AbortError") {
        console.log("[useMessageSending] Send cancelled (abort)");
        return;
      }
      // Distinguish timeout vs generic failure so the user-visible error text
      // is informative without being noisy.
      const isTimeout = error?.name === "TimeoutError" || /timed out/i.test(error?.message || "");
      console.error("Failed to send message:", error);
      updateMessage(aiMessageId, {
        message: "",
        streamingContent: "",
        error: isTimeout
          ? "Request timed out. Tap Retry to try again."
          : "Couldn't get a response. Tap Retry to try again.",
        isStreaming: false,
      });
      setIsSending(false);
    }
  };

  return { handleSend };
}