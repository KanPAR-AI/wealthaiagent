// components/chat/chat-window.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, RefreshCcw, ThumbsDown, ThumbsUp, ChevronDown } from "lucide-react";

import { ChatMessageList } from '@/components/chat/message-list';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatMessages } from '@/hooks/use-chat-messages';
import { useChatSession } from '@/hooks/use-chat-session';
import { useJwtToken } from '@/hooks/use-jwt-token';
import { useMessageActions } from '@/hooks/use-message-actions';
import { useChatStore } from '@/store/chat';
import { ChatWindowProps, MessageFile, SuggestionTileData } from '@/types';

import { AiLoadingIndicator } from './ai-loading-indicator';
import { ChatEmptyState } from './chat-empty-state';
import { PromptInputWithActions, PromptInputRef } from "./chat-input";
import { SuggestionTiles } from './chat-suggestion-tiles';
import { FilePreviewModal } from './file-preview-modal';
import { ChatLoadingSkeleton } from './chat-loading-skeleton';

// Custom hooks
import { useChatWindowState } from './hooks/use-chat-window-state';
import { useChatHistory } from './hooks/use-chat-history';
import { usePendingMessage } from './hooks/use-pending-message';
import { useMessageSending } from './hooks/use-message-sending';

const suggestionTiles: SuggestionTileData[] = [
  { 
    id: 1, 
    title: "Show my portfolio allocation", 
    description: "View asset breakdown",
    useMockService: true,
  },
  {
    id: 2,
    title: "Analyze my portfolio performance",
    description: "Monthly growth trends",
    useMockService: true,
  },
  { 
    id: 3, 
    title: "What are my top holdings?", 
    description: "View stock positions",
    useMockService: true,
  },
  { 
    id: 4, 
    title: "Explain SIP with examples", 
    description: "Investment strategy visualization",
    useMockService: true,
  },
  { 
    id: 5, 
    title: "Compare mutual fund types", 
    description: "Performance comparison",
    useMockService: true,
  },
  { 
    id: 6, 
    title: "Show compound interest growth", 
    description: "Investment projection",
    useMockService: true,
  }
];

export default function ChatWindow({
  chatId,
  className = ''
}: ChatWindowProps) {
  const { token, isLoadingToken, tokenError } = useJwtToken();
  const { isFirstMessage } = useChatSession(chatId);
  const { messages, addMessage, updateMessage, clearMessages } = useChatMessages(chatId || '');
  const _navigate = useNavigate();

  // Scroll to bottom functionality
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  const clearPendingMessage = useChatStore(state => state.clearPendingMessage);

  const {
    handleCopy,
    handleLike,
    handleDislike,
    handleRegenerate,
    isRegenerating
  } = useMessageActions(chatId || '');

  // Custom hooks for state management
  const {
    selectedFile,
    isHistoryLoading,
    isSending,
    isNewChatInitiating,
    lastUserMessageId,
    isProcessingPendingMessage,
    streamingController: _streamingController,
    isProcessingRef,
    setSelectedFile,
    setIsHistoryLoading,
    setIsSending,
    setIsNewChatInitiating,
    setLastUserMessageId,
    setIsProcessingPendingMessage,
    setStreamingController,
  } = useChatWindowState(chatId);

  // Custom hooks for business logic
  useChatHistory({
    chatId,
    token,
    isProcessingPendingMessage,
    setIsHistoryLoading,
    clearMessages,
    addMessage,
    currentMessageCount: messages.length,
  });

  usePendingMessage({
    chatId,
    token,
    isProcessingRef,
    setIsProcessingPendingMessage,
    setIsSending,
    setStreamingController,
    addMessage,
    updateMessage,
    clearPendingMessage,
  });

  const { handleSend } = useMessageSending({
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
  });

  // Handle first message clearing
  useEffect(() => {
    if (isFirstMessage && chatId) {
      if (isProcessingPendingMessage) {
        console.log("Skipping first message clear - pending message being processed");
        return;
      }
      console.log("Detected first message for new chat ID, clearing messages.");
      clearMessages();
    }
  }, [isFirstMessage, chatId, clearMessages, isProcessingPendingMessage]);

  // Scroll to bottom function
  const scrollToBottom = () => {
    const scrollViewport = scrollViewportRef.current || document.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollViewport) {
      scrollViewport.scrollTo({
        top: scrollViewport.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  // Handle scroll events to show/hide scroll to bottom button
  const handleScroll = () => {
    const scrollViewport = scrollViewportRef.current || document.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollViewport) {
      const { scrollTop, scrollHeight, clientHeight } = scrollViewport;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollToBottom(!isNearBottom && scrollHeight > clientHeight);
    }
  };

  // Handle auto-scrolling to new messages
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
  }, [lastUserMessageId, setLastUserMessageId]);

  // Add scroll event listener
  useEffect(() => {
    const scrollViewport = document.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollViewport) {
      scrollViewportRef.current = scrollViewport as HTMLDivElement;
      scrollViewport.addEventListener('scroll', handleScroll);
      
      // Initial check
      handleScroll();
      
      return () => {
        scrollViewport.removeEventListener('scroll', handleScroll);
      };
    }
  }, [messages.length]); // Re-run when messages change

  const actionIcons = [
    { icon: Copy as React.FC<React.SVGProps<SVGSVGElement>>, type: "Copy", action: handleCopy },
    { icon: RefreshCcw as React.FC<React.SVGProps<SVGSVGElement>>, type: "Regenerate", action: handleRegenerate },
    { icon: ThumbsUp as React.FC<React.SVGProps<SVGSVGElement>>, type: "Like", action: handleLike },
    { icon: ThumbsDown as React.FC<React.SVGProps<SVGSVGElement>>, type: "Dislike", action: handleDislike },
  ];

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

  console.log('[ChatWindow] Rendering with:', {
    messageCount: messages.length,
    isHistoryLoading,
    chatId,
    showEmptyState: messages.length === 0 && !isHistoryLoading
  });

  return (
    <>
      <FilePreviewModal
        isOpen={!!selectedFile}
        onClose={() => setSelectedFile(null)}
        file={selectedFile}
      />
      <div className={`flex flex-col ios-keyboard-fix bg-background dark:bg-zinc-800 w-full min-w-0 ${className}`}>
        {messages.length === 0 && !isHistoryLoading ? (
          // Empty state with centered input
          <div className="flex flex-col items-center justify-center h-full min-h-[80vh] px-4 md:px-6 space-y-8">
            <div className="max-w-3xl mx-auto w-full space-y-8 min-w-0">
              <div className="flex flex-col items-center justify-center space-y-4 md:space-y-6">
                <ChatEmptyState />
                <div className="w-full max-w-md md:max-w-none">

                </div>
              </div>
              
                {/* Centered input bar for empty state */}
                <div className="w-full max-w-3xl mx-auto flex flex-col gap-4">
                  <PromptInputWithActions
                    onSubmit={handleSend}
                    // Disable input if sending, regenerating, loading token, OR if a new chat is initiating
                    isLoading={isSending || isRegenerating || isLoadingToken || isNewChatInitiating}
                    isInEmptyState={true}
                  />
                  <SuggestionTiles
                    tiles={suggestionTiles}
                    onSuggestionClick={(title, useMockService) => handleSend(title, [], useMockService)}
                    // Disable suggestions if sending or regenerating OR if a new chat is initiating
                    disabled={isSending || isRegenerating || isNewChatInitiating}
                  />
              </div>
            </div>
          </div>
        ) : (
          // Chat with messages - original layout
          <>
            <div className="h-full overflow-hidden pb-4 mt-12 sm:mt-0 chat-content relative">
              <ScrollArea ref={scrollAreaRef} className="h-[80vh]" type="scroll">
                <div className="p-4 md:p-6 space-y-6 min-w-0">
                  <div className="max-w-3xl mx-auto w-full space-y-8 min-w-0">
                    {isHistoryLoading ? (
                      <ChatLoadingSkeleton />
                    ) : (
                      <ChatMessageList
                        messages={messages}
                        currentUser={{
                          firstName: "User",
                          imageUrl: undefined,
                        }}
                        onFileClick={(file: MessageFile) => setSelectedFile(file)}
                        actionIcons={actionIcons}
                        addMessageId={true}
                      />
                    )}
                    {/* Conditionally render AiLoadingIndicator based on isSending AND NOT isNewChatInitiating */}
                    {(isSending || isRegenerating) && !isNewChatInitiating && <AiLoadingIndicator />}
                    <div className="h-40 md:h-32" />
                  </div>
                </div>
              </ScrollArea>
              
              {/* Scroll to Bottom Button */}
              {showScrollToBottom && (
                <button
                  onClick={scrollToBottom}
                  className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-primary/70 text-primary-foreground hover:bg-primary/90 rounded-full p-2 shadow-lg transition-all duration-200 hover:scale-105 z-10"
                  aria-label="Scroll to bottom"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="fixed sm:sticky bottom-0 left-0 right-0 bg-background dark:bg-zinc-800 border-t border-border/5 backdrop-blur-sm ios-input-container">
              <div className="w-full sm:px-4 sm:pb-4">
                <div className="max-w-3xl mx-auto">
                  <PromptInputWithActions
                    onSubmit={handleSend}
                    // Disable input if sending, regenerating, loading token, OR if a new chat is initiating
                    isLoading={isSending || isRegenerating || isLoadingToken || isNewChatInitiating}
                    isInEmptyState={false}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}