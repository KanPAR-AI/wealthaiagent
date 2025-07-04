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
  const getPendingMessage = useChatStore(state => state.getPendingMessage);
  const clearPendingMessage = useChatStore(state => state.clearPendingMessage);
  
  // Memoize the pending message to avoid repeated calls
  const pendingMessage = useMemo(() => {
    if (chatId) {
      return getPendingMessage(chatId);
    }
    return null;
  }, [chatId, getPendingMessage]);
  
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
    const processPendingMessage = async (text: string, files: MessageFile[]) => {
      // Clear the pending message immediately to prevent re-processing
      clearPendingMessage();
      isProcessingRef.current = true;
      
      const userMessageId = nanoid();
      addMessage({
        id: userMessageId,
        message: text,
        sender: "user",
        files,
        timestamp: new Date().toISOString()
      });
      setLastUserMessageId(userMessageId);
      setIsSending(true);

      const aiMessageId = nanoid();
      addMessage({ id: aiMessageId, message: '', sender: 'bot', timestamp: new Date().toISOString(), isStreaming: true });

      try {
        if (!token) throw new Error("Authentication token not available for pending message.");
        if (!chatId) throw new Error("Chat ID not available for pending message.");

        await sendChatMessage(token, chatId, text, files);

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
          () => {
            updateMessage(aiMessageId, { isStreaming: false });
            setIsSending(false);
            isProcessingRef.current = false;
          },
          (error) => {
            console.error("Error in SSE stream for pending message:", error);
            updateMessage(aiMessageId, {
              message: receivedText || "Error getting AI response",
              error: "Failed response",
              isStreaming: false
            });
            setIsSending(false);
            isProcessingRef.current = false;
          }
        );
      } catch (error) {
        console.error("Error processing pending message flow:", error);
        updateMessage(aiMessageId, {
          message: "Error during initial chat AI response.",
          error: "Failed response",
          isStreaming: false
        });
        setIsSending(false);
        isProcessingRef.current = false;
      }
    };

    // This guard prevents the effect from running if a message is already being sent or regenerated,
    // or if the necessary credentials are not yet available.
    if (token && chatId && !isProcessingRef.current && !isSending && !isRegenerating && !isLoadingToken && pendingMessage) {
      console.log("Found pending message, attempting to process:", pendingMessage);
      processPendingMessage(pendingMessage.text, pendingMessage.files);
    }
  }, [
    token,
    chatId,
    isLoadingToken,
    isSending,
    isRegenerating,
    pendingMessage,
    clearPendingMessage,
    addMessage,
    updateMessage
  ]);

  useEffect(() => {
    if (isFirstMessage && chatId) {
      console.log("Detected first message for new chat ID, clearing messages.");
      clearMessages();
    }
  }, [isFirstMessage, chatId, clearMessages]);

  const handleSend = async (text: string, files: File[]) => {
    if (!text.trim() && files.length === 0) return;
    if (isSending || isRegenerating) {
      console.log("Already sending or regenerating. Please wait.");
      return;
    }
    if (isLoadingToken || !token) {
      console.error("Token not available or still loading. Cannot send message.");
      return;
    }

    const fileMetadata: MessageFile[] = await Promise.all(
      files.map(async (f) => ({
        name: f.name,
        type: f.type,
        size: f.size,
        url: f.type.startsWith('image/') ? await fileToDataURL(f) : undefined
      }))
    );

    setIsSending(true);

    const userMessageId = nanoid();
    addMessage({
      id: userMessageId,
      message: text,
      sender: "user",
      files: fileMetadata,
      timestamp: new Date().toISOString()
    });
    setLastUserMessageId(userMessageId);

    const aiMessageId = nanoid();
    addMessage({ id: aiMessageId, message: '', sender: 'bot', timestamp: new Date().toISOString(), isStreaming: true });

    let currentChatIdForStream: string | undefined = chatId;

    try {
      if (isFirstMessage) {
        const newChatId = await createChatSession(token, "Postman E2E Test Chat", text, fileMetadata);
        setCurrentChatId(newChatId);
        onNewChatCreated?.(newChatId);
        currentChatIdForStream = newChatId;
      } else if (chatId) {
        await sendChatMessage(token, chatId, text, fileMetadata);
      } else {
        throw new Error("Chat ID is not available and it's not the first message.");
      }

      if (!currentChatIdForStream) {
        throw new Error("Cannot listen to chat stream: Chat ID is not defined.");
      }

      let receivedText = '';
      streamingControllerRef.current = new AbortController();

      await listenToChatStream(
        token,
        currentChatIdForStream,
        (chunk: string, type: string) => {
          if (type === 'text_chunk') {
            receivedText += chunk;
            updateMessage(aiMessageId, { message: receivedText });
          }
        },
        () => {
          updateMessage(aiMessageId, { isStreaming: false });
          setIsSending(false);
        },
        (error) => {
          console.error("Error in SSE stream:", error);
          updateMessage(aiMessageId, {
            message: receivedText || "Error getting AI response",
            error: "Failed response",
            isStreaming: false
          });
          setIsSending(false);
        }
      );
    } catch (error) {
      console.error("Failed to send message or start session:", error);
      updateMessage(aiMessageId, {
        message: "Error processing message.",
        error: "Failed response",
        isStreaming: false
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
