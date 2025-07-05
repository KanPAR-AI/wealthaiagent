// components/chat/chat-window.tsx (Corrected and Refactored)
import { ChatMessageList } from '@/components/chat/message-list';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatMessages } from '@/hooks/use-chat-messages';
import { useChatSession } from '@/hooks/use-chat-session';
import { useJwtToken } from '@/hooks/use-jwt-token';
import { useMessageActions } from '@/hooks/use-message-actions';
import { fileToDataURL } from '@/lib/files';
// Ensure these paths are correct and the functions are implemented
import { createChatSession, listenToChatStream, sendChatMessage } from '@/services/chat-service';
import { useChatStore } from '@/store/chat';
// Ensure ChatWindowProps, Message, MessageFile, SuggestionTileData are correctly defined in your types
import { ChatWindowProps, MessageFile, SuggestionTileData } from '@/types/chat';
import { useUser } from '@clerk/clerk-react';
import { Copy, RefreshCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { nanoid } from 'nanoid';
import { useEffect, useRef, useState, useMemo } from 'react';
import { AiLoadingIndicator } from './ai-loading-indicator';
import { ChatEmptyState } from './chat-empty-state';
import { PromptInputWithActions } from "./chat-input";
import { SuggestionTiles } from './chat-suggestion-tiles';
import { FilePreviewModal } from './file-preview-modal';
import { useNavigate } from 'react-router-dom';

const suggestionTiles: SuggestionTileData[] = [
  { id: 1, title: "Show me sales data", description: "Generate content or brainstorm ideas" },
  { id: 2, title: "Analyze my user demographics", description: "Get assistance with any topic" },
  { id: 3, title: "Show me my product list", description: "Condense long documents" },
  { id: 4, title: "Code assistance", description: "Debug or create new code" }
];

export default function ChatWindow({
  chatId: chatIdProp,
  onNewChatCreated,
  className = ''
}: ChatWindowProps) {
  const { user, isSignedIn } = useUser();
  const { token, isLoadingToken, tokenError } = useJwtToken();
  const [selectedFile, setSelectedFile] = useState<MessageFile | null>(null);

  const { chatId, isFirstMessage, setCurrentChatId } = useChatSession(chatIdProp);
  const { messages, addMessage, updateMessage, clearMessages } = useChatMessages(chatId || '');
  const navigate = useNavigate();
  
  // Memoize the pending message to avoid repeated calls
  const pendingMessage = useChatStore(state => state.pendingMessage);
  const clearPendingMessage = useChatStore(state => state.clearPendingMessage);
  
  const {
    handleCopy,
    handleLike,
    handleDislike,
    handleRegenerate,
    isRegenerating
  } = useMessageActions(chatId || '');

  const [isSending, setIsSending] = useState(false);
  const [lastUserMessageId, setLastUserMessageId] = useState<string | null>(null);
  const streamingControllerRef = useRef<AbortController | null>(null);
  const isProcessingRef = useRef(false);

  // Effect to handle pending messages.
  useEffect(() => {
    // Guard to ensure we only process a pending message meant for the *current* chat
    if (token && chatId && pendingMessage && pendingMessage.chatId === chatId && !isProcessingRef.current) {
      
      const { text, files } = pendingMessage;
  
      // --- Start processing ---
      isProcessingRef.current = true;
      console.log("Processing pending message for new chat:", pendingMessage);
  
      // 1. Clear the pending message from the store IMMEDIATELY to prevent loops.
      clearPendingMessage();
  
      // 2. Add the user's message to the UI.
      const userMessageId = nanoid();
      addMessage({
        id: userMessageId,
        message: text,
        sender: "user",
        files,
        timestamp: new Date().toISOString()
      });
      setLastUserMessageId(userMessageId);
      
      // 3. Set loading state for the UI
      setIsSending(true);
  
      // 4. Add a placeholder for the AI's streaming response.
      const aiMessageId = nanoid();
      addMessage({ id: aiMessageId, message: '', sender: 'bot', timestamp: new Date().toISOString(), isStreaming: true });
      
      // 5. DO NOT send the message again. Just listen for the stream.
      const startListening = async () => {
        try {
          // THE FIX IS HERE: The call to `sendChatMessage` has been REMOVED.
          // We immediately listen for the stream that was already started by `createChatSession`.

          let receivedText = '';
          streamingControllerRef.current = new AbortController();
  
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
              setIsSending(false); // This will now be called correctly.
              isProcessingRef.current = false;
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
        }
      };
  
      startListening();
    }
  }, [
    chatId,
    pendingMessage, // Correctly listen for changes to the pending message object
    token,
    addMessage,
    updateMessage,
    clearPendingMessage
  ]);

  useEffect(() => {
    if (isFirstMessage && chatId) {
      console.log("Detected first message for new chat ID, clearing messages.");
      clearMessages();
    }
  }, [isFirstMessage, chatId, clearMessages]);


const handleSend = async (text: string, files: File[]) => {
  // Prevent sending empty messages or actions while busy
  if (!text.trim() && files.length === 0) return;
  if (isSending || isRegenerating || isLoadingToken || !token) {
    console.warn("Send aborted: busy, loading, or no token.");
    return;
  }

  // Set loading state immediately
  setIsSending(true);

  const fileMetadata: MessageFile[] = await Promise.all(
    files.map(async (f) => ({
      name: f.name,
      type: f.type,
      size: f.size,
      url: f.type.startsWith('image/') ? await fileToDataURL(f) : undefined,
    }))
  );

  // --- 1. Logic for a NEW CHAT ---
  // If there's no chatId, we create a new session and redirect.
  // No messages are added to the UI here.
  if (!chatId) {
    try {
      // Create the session on the backend to get a chat ID.
      // The API call itself sends the first message content.
      const newChatId = await createChatSession(token, "New Chat", text, fileMetadata);
      
      // Set the message as 'pending' for the new page to process.
      useChatStore.getState().setPendingMessage(text, fileMetadata, newChatId);
      
      // Redirect to the new chat page.
      navigate(`/chat/${newChatId}`);
      
      // Note: We intentionally DO NOT call addMessage or setIsSending(false) here.
      // The new page load will handle the UI state.
    } catch (error) {
      console.error("Failed to create new chat session:", error);
      // Display an error to the user if session creation fails.
      setIsSending(false); 
    }
    return; // Stop execution for new chats
  }

  // --- 2. Logic for an EXISTING CHAT ---
  // This code only runs if a chatId already exists.
  const userMessageId = nanoid();
  addMessage({
    id: userMessageId,
    message: text,
    sender: "user",
    files: fileMetadata,
    timestamp: new Date().toISOString(),
  });
  setLastUserMessageId(userMessageId);

  const aiMessageId = nanoid();
  addMessage({
    id: aiMessageId,
    message: '',
    sender: 'bot',
    timestamp: new Date().toISOString(),
    isStreaming: true, // This will show the bubble with the blinking cursor
  });

  try {
    await sendChatMessage(token, chatId, text, fileMetadata);
    
    let receivedText = '';
    streamingControllerRef.current = new AbortController();

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
      },
      (error) => { // onError
        console.error("Error in SSE stream:", error);
        updateMessage(aiMessageId, {
          message: receivedText || "Error getting AI response",
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
      error: "Failed response",
      isStreaming: false,
    });
    setIsSending(false);
  }
};
  const actionIcons = [
    { icon: Copy, type: "Copy", action: handleCopy },
    { icon: RefreshCcw, type: "Regenerate", action: handleRegenerate },
    { icon: ThumbsUp, type: "Like", action: handleLike },
    { icon: ThumbsDown, type: "Dislike", action: handleDislike },
  ];

  useEffect(() => {
    if (lastUserMessageId) {
      const timeout = setTimeout(() => {
        const messageElement = document.querySelector(`[data-message-id="${lastUserMessageId}"]`);
        if (!messageElement) return;

        const scrollViewport = messageElement.closest('[data-radix-scroll-area-viewport]');
        if (scrollViewport) {
          const messageRect = messageElement.getBoundingClientRect();
          const containerRect = scrollViewport.getBoundingClientRect();
          const offset = messageRect.top - containerRect.top;
          scrollViewport.scrollTo({
            top: scrollViewport.scrollTop + offset,
            behavior: 'smooth',
          });
        } else {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        setLastUserMessageId(null);
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [lastUserMessageId]);

  if (tokenError) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        Authentication Error: {tokenError}. Please refresh or try again later.
      </div>
    );
  }

  if (isLoadingToken) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading authentication...
      </div>
    );
  }

  return (
    <>
      <FilePreviewModal
        isOpen={!!selectedFile}
        onClose={() => setSelectedFile(null)}
        file={selectedFile}
      />

      <div className={`flex flex-col h-dvh bg-background dark:bg-zinc-800 w-full min-w-0 ${className}`}>
        <div className="h-full overflow-hidden pb-4 mt-12 sm:mt-0">
          <ScrollArea className="h-full" type="scroll">
            <div className="p-4 md:p-6 space-y-6">
              <div className="max-w-3xl mx-auto w-full space-y-8">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full space-y-4 md:space-y-6 py-8">
                    <ChatEmptyState
                      isFirstMessage={isFirstMessage}
                      isSignedIn={!!isSignedIn}
                      userName={user?.firstName}
                    />
                    <div className="w-full max-w-md md:max-w-none">
                      <SuggestionTiles
                        tiles={suggestionTiles}
                        onSuggestionClick={(title) => handleSend(title, [])}
                        disabled={isSending || isRegenerating}
                      />
                    </div>
                  </div>
                ) : (
                  <ChatMessageList
                    messages={messages}
                    currentUser={user ? {
                      firstName: user.firstName,
                      imageUrl: user.imageUrl
                    } : undefined}
                    onFileClick={(file: MessageFile) => setSelectedFile(file)}
                    actionIcons={actionIcons}
                    addMessageId={true}
                  />
                )}
                {(isSending || isRegenerating) && <AiLoadingIndicator />}
                <div className="h-40 md:h-32" />
              </div>
            </div>
          </ScrollArea>
        </div>

        <div className="fixed sm:sticky bottom-0 left-0 right-0 bg-background dark:bg-zinc-800 border-t border-border/5 backdrop-blur-sm">
          <div className="w-full sm:px-4 sm:pb-4">
            <div className="max-w-3xl mx-auto">
              <PromptInputWithActions
                onSubmit={handleSend}
                isLoading={isSending || isRegenerating || isLoadingToken}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}