// components/chat/chat-window.tsx
import { ChatMessageList } from '@/components/chat/message-list';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatMessages } from '@/hooks/use-chat-messages';
import { useChatSession } from '@/hooks/use-chat-session';
import { useJwtToken } from '@/hooks/use-jwt-token';
import { useMessageActions } from '@/hooks/use-message-actions';
import { createChatSession, fetchChatHistory, listenToChatStream, sendChatMessage } from '@/services/chat-service';
import { useChatStore } from '@/store/chat';
import { ChatWindowProps, Message, MessageFile, SuggestionTileData } from '@/types';
import { Copy, RefreshCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { nanoid } from 'nanoid';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AiLoadingIndicator } from './ai-loading-indicator';
import { ChatEmptyState } from './chat-empty-state';
import { PromptInputWithActions } from "./chat-input";
import { SuggestionTiles } from './chat-suggestion-tiles';
import { FilePreviewModal } from './file-preview-modal';
import { ChatLoadingSkeleton } from './chat-loading-skeleton';

const suggestionTiles: SuggestionTileData[] = [
  { id: 1, title: "Show me sales data", description: "Generate content or brainstorm ideas" },
  { id: 2, title: "Analyze my user demographics", description: "Get assistance with any topic" },
  { id: 3, title: "Show me my product list", description: "Condense long documents" },
  { id: 4, title: "Code assistance", description: "Debug or create new code" }
];

export default function ChatWindow({
  chatId,
  className = ''
}: ChatWindowProps) {
  const { token, isLoadingToken, tokenError } = useJwtToken();
  const [selectedFile, setSelectedFile] = useState<MessageFile | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(!!chatId);


  const {isFirstMessage } = useChatSession(chatId);
  const { messages, addMessage, updateMessage, clearMessages } = useChatMessages(chatId || '');
  const navigate = useNavigate();

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
  // New state to manage loading specifically for new chat creation before redirect
  const [isNewChatInitiating, setIsNewChatInitiating] = useState(false); 
  const [lastUserMessageId, setLastUserMessageId] = useState<string | null>(null);
  const streamingControllerRef = useRef<AbortController | null>(null);
  const isProcessingRef = useRef(false);
  // State to track if we're processing a pending message to prevent interference
  const [isProcessingPendingMessage, setIsProcessingPendingMessage] = useState(false);

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
      setLastUserMessageId(userMessageId);

      setIsSending(true);

      const aiMessageId = nanoid();
      addMessage({ id: aiMessageId, message: '', sender: 'bot', timestamp: new Date().toISOString(), isStreaming: true });

      const startListening = async () => {
        try {
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
    clearPendingMessage
  ]);

  useEffect(() => {
    console.log("Loading chat history",chatId)
    const loadChatHistory = async () => {
      if (!chatId || !token) return;
      
      // Don't load history if we're processing a pending message
      if (isProcessingPendingMessage) {
        console.log("Skipping chat history load - pending message being processed");
        return;
      }
  
      try {
        const chatResponse = await fetchChatHistory(token, chatId);
  
        const loadedMessages:Message[] = chatResponse.messages.map((msg) => {
          const files: MessageFile[] = (msg.attachments || []).map((att: any) => {
            console.log('Processing attachment:', att);
            
            // Handle both string URLs and object attachments
            if (typeof att === 'string') {
              // Backend sends just URL strings
              const fileName = att.split('/').pop() || 'Unknown file';
              return {
                name: fileName,
                type: 'application/octet-stream', // Default type, will be detected by FileRenderer
                url: att,
                size: 0, // Unknown size
              };
            } else {
              // Backend sends attachment objects
              return {
                name: att.name || 'Unknown file',
                type: att.type || 'application/octet-stream',
                url: att.url,
                size: att.size || 0,
              };
            }
          });

          console.log('Loaded message with files:', { messageId: msg.id, fileCount: files.length, files });

          return {
            id: msg.id,
            message: msg.content,
            sender: msg.sender === 'assistant' ? 'bot' : 'user',
            timestamp: msg.timestamp,
            files: files.length > 0 ? files : undefined,
          };
        });
  
        // Only clear messages if we have loaded messages (existing chat)
        // Don't clear if it's a new chat with no history yet
        if (loadedMessages.length > 0) {
          setIsHistoryLoading(true);
          clearMessages();
  
          // Add loaded messages one by one (preserving order)
          loadedMessages.forEach((m) => addMessage(m));
        }
        setIsHistoryLoading(false)
      } catch (err) {
        console.error('Failed to load chat history:', err);
        setIsHistoryLoading(false)
      }
    };
  
    loadChatHistory();
  }, [chatId, token, clearMessages, addMessage, isProcessingPendingMessage]);
  
  

  useEffect(() => {
    if (isFirstMessage && chatId) {
      // Don't clear messages if we're processing a pending message
      if (isProcessingPendingMessage) {
        console.log("Skipping first message clear - pending message being processed");
        return;
      }
      console.log("Detected first message for new chat ID, clearing messages.");
      clearMessages();
    }
  }, [isFirstMessage, chatId, clearMessages, isProcessingPendingMessage]);

  const handleSend = async (text: string, attachments: MessageFile[]) => {
    console.log("message:",text,attachments)
    if (!text.trim() && attachments.length === 0) {
      console.warn("Send aborted: No text and no files to send.");
      return;
    }
    if (isSending || isRegenerating || isLoadingToken || !token || isNewChatInitiating) { // Add isNewChatInitiating to guard
      console.warn("Send aborted: busy, loading, or no token, or new chat initiating.");
      return;
    }

    if (!chatId) {
      // Logic for a NEW CHAT
      try {
        setIsNewChatInitiating(true); // Set new state for initiating a new chat
        const newChatId = await createChatSession(token, "New Chat", text, attachments);
        useChatStore.getState().setPendingMessage(text, attachments, newChatId);
        navigate(`/chat/${newChatId}`);
        // setIsNewChatInitiating will be reset by the new page load and subsequent useEffect for pending message
      } catch (error) {
        console.error("Failed to create new chat session:", error);
        setIsNewChatInitiating(false); // Reset if creation fails
      }
      return;
    }

    // Logic for an EXISTING CHAT
    setIsSending(true); // Only set isSending for existing chats

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
    });

    try {
      await sendChatMessage(token, chatId, text, attachments);

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
    { icon: Copy as React.FC<React.SVGProps<SVGSVGElement>>, type: "Copy", action: handleCopy },
    { icon: RefreshCcw as React.FC<React.SVGProps<SVGSVGElement>>, type: "Regenerate", action: handleRegenerate },
    { icon: ThumbsUp as React.FC<React.SVGProps<SVGSVGElement>>, type: "Like", action: handleLike },
    { icon: ThumbsDown as React.FC<React.SVGProps<SVGSVGElement>>, type: "Dislike", action: handleDislike },
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
      <div className={`flex flex-col ios-keyboard-fix bg-background dark:bg-zinc-800 w-full min-w-0 ${className}`}>
        <div className="h-full overflow-hidden pb-4 mt-12 sm:mt-0 chat-content">
          <ScrollArea className="h-[80vh]" type="scroll">
            <div className="p-4 md:p-6 space-y-6 min-w-0">
              <div className="max-w-3xl mx-auto w-full space-y-8 min-w-0">
                {isHistoryLoading ? (
                  <ChatLoadingSkeleton />
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full space-y-4 md:space-y-6 py-8">
                    <ChatEmptyState
                      isFirstMessage={isFirstMessage}
                      isSignedIn={true}
                      userName="User"
                    />
                    <div className="w-full max-w-md md:max-w-none">
                      <SuggestionTiles
                        tiles={suggestionTiles}
                        onSuggestionClick={(title) => handleSend(title, [])}
                        // Disable suggestions if sending or regenerating OR if a new chat is initiating
                        disabled={isSending || isRegenerating || isNewChatInitiating}
                      />
                    </div>
                  </div>
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
        </div>

        <div className="fixed sm:sticky bottom-0 left-0 right-0 bg-background dark:bg-zinc-800 border-t border-border/5 backdrop-blur-sm ios-input-container">
          <div className="w-full sm:px-4 sm:pb-4">
            <div className="max-w-3xl mx-auto">
              <PromptInputWithActions
                onSubmit={handleSend}
                // Disable input if sending, regenerating, loading token, OR if a new chat is initiating
                isLoading={isSending || isRegenerating || isLoadingToken || isNewChatInitiating} 
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}