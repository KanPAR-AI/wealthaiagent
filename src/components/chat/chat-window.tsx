// components/chat/chat-window.tsx (Corrected)
import { ChatMessageList } from '@/components/chat/message-list';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatMessages } from '@/hooks/use-chat-messages';
import { useChatSession } from '@/hooks/use-chat-session';
import { useJwtToken } from '@/hooks/use-jwt-token';
import { useMessageActions } from '@/hooks/use-message-actions';
import { fileToDataURL } from '@/lib/files';
import { createChatSession, listenToChatStream, sendChatMessage } from '@/services/chat-service'; // Ensure this path is correct
import { useChatStore } from '@/store/chat';
import { ChatWindowProps, Message, MessageFile, SuggestionTileData } from '@/types/chat'; // Ensure ChatWindowProps is imported
import { useUser } from '@clerk/clerk-react';
import { Copy, RefreshCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { nanoid } from 'nanoid';
import { useEffect, useRef, useState } from 'react';
import { AiLoadingIndicator } from './ai-loading-indicator';
import { ChatEmptyState } from './chat-empty-state';
import { PromptInputWithActions } from "./chat-input";
import { SuggestionTiles } from './chat-suggestion-tiles';
import { FilePreviewModal } from './file-preview-modal';
// import { DebugPanel } from '../ui/debug'; // Commented out as it might not exist or be needed immediately

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
  // Correctly destructure addMessage and updateMessage from useChatMessages
  const { messages, addMessage, updateMessage, clearMessages } = useChatMessages(chatId || '');
  const { getPendingMessage, clearPendingMessage } = useChatStore();
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

  // Effect to handle pending messages after chat ID and token are available
  useEffect(() => {
    // Only process if token and chat ID are valid, and not already sending a message
    if (token && chatId && !isSending && !isLoadingToken) {
      const pendingMsg = getPendingMessage(chatId);
      if (pendingMsg) {
        // Use a flag to prevent re-entry if handlePendingMessage itself sets isSending
        // This structure relies on handlePendingMessage to clear pending and manage state
        handlePendingMessage(pendingMsg.text, pendingMsg.files);
      }
    }
  }, [token, chatId, isSending, isLoadingToken, getPendingMessage]);


  useEffect(() => {
    if (isFirstMessage && chatId) {
      clearMessages();
    }
  }, [isFirstMessage, chatId, clearMessages]);

  const handlePendingMessage = async (text: string, files: MessageFile[]) => {
    clearPendingMessage(); // Clear pending message once we start processing it
    
    const userMessageId = nanoid();
    const userMessage: Message = {
      id: userMessageId,
      message: text,
      sender: "user",
      files,
      timestamp: new Date().toISOString()
    };
    addMessage(userMessage); // Add user message immediately
    setLastUserMessageId(userMessageId);

    setIsSending(true); // Indicate sending process has started

    // Add a placeholder AI response message
    const aiMessageId = nanoid();
    addMessage({ id: aiMessageId, message: '', sender: 'bot', timestamp: new Date().toISOString(), isStreaming: true });

    try {
      if (!token) {
        throw new Error("Authentication token not available for pending message.");
      }
      if (!chatId) {
        throw new Error("Chat ID not available for pending message.");
      }

      // After the initial chat is created (which set the chatId), now listen to stream
      let receivedText = '';
      streamingControllerRef.current = new AbortController();

      await listenToChatStream(
        token,
        chatId, // Use the actual chatId that was set
        (chunk: string, type: string) => { // Added structuredContent parameter
          if (type === 'text_chunk') {
            receivedText += chunk;
            updateMessage(aiMessageId, { message: receivedText });
          } 
          // else if (structuredContent) { // Handle structured content if your SSE sends it
          //   updateMessage(aiMessageId, { structuredContent: structuredContent });
          // }
          // You might combine text and structured content or handle them separately based on your UI needs
        },
        () => {
          updateMessage(aiMessageId, { isStreaming: false });
          setIsSending(false);
        },
        (error) => {
          console.error("Error in SSE stream for pending message:", error);
          updateMessage(aiMessageId, {
            message: receivedText || "Error getting AI response",
            error: "Failed response",
            isStreaming: false
          });
          setIsSending(false);
        }
      );

    } catch (error) {
      console.error("Error processing pending message flow:", error);
      updateMessage(aiMessageId, {
        message: "Error during initial chat AI response.",
        sender: "bot",
        error: "Failed response",
        isStreaming: false
      });
      setIsSending(false);
    }
  };

  const handleSend = async (text: string, files: File[]) => {
    if (!text.trim() && files.length === 0) return;
    if (!token) {
      console.error("JWT Token not available. Cannot send message.");
      // Potentially show a login/error message to the user
      return;
    }
    if (isLoadingToken) {
      console.log("Token is still loading. Please wait.");
      return;
    }
    if (isSending || isRegenerating) { // Prevent sending if already busy
        console.log("Already sending or regenerating. Please wait.");
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

    setIsSending(true); // Indicate sending process has started

    const userMessageId = nanoid();
    const userMessage: Message = {
      id: userMessageId,
      message: text,
      sender: "user",
      files: fileMetadata,
      timestamp: new Date().toISOString()
    };
    addMessage(userMessage); // Add user message immediately
    setLastUserMessageId(userMessageId);

    // Add a placeholder AI response message
    const aiMessageId = nanoid();
    addMessage({ id: aiMessageId, message: '', sender: 'bot', timestamp: new Date().toISOString(), isStreaming: true });

    try {
      if (isFirstMessage) {
        // If it's the first message, create a new chat session
        const newChatId = await createChatSession(token, "Postman E2E Test Chat", text, fileMetadata);
        setCurrentChatId(newChatId); // This will trigger the useEffect for pending messages
        onNewChatCreated?.(newChatId);
        // The rest of the AI response handling for the first message will be managed
        // by handlePendingMessage which is triggered by the `chatId` change.
        // We set isSending here and it will be reset by handlePendingMessage's finally block.
      } else if (chatId) {
        // For subsequent messages, send to the existing chat
        await sendChatMessage(token, chatId, text, fileMetadata);

        // After sending message, start listening to the stream for AI response
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
            // else if (structuredContent) { // Handle structured content if your SSE sends it
            //     updateMessage(aiMessageId, { structuredContent: structuredContent });
            // }
          },
          () => {
            updateMessage(aiMessageId, { isStreaming: false });
            setIsSending(false); // Reset sending state on stream completion
          },
          (error) => {
            console.error("Error in SSE stream:", error);
            updateMessage(aiMessageId, {
              message: receivedText || "Error getting AI response",
              error: "Failed response",
              isStreaming: false
            });
            setIsSending(false); // Reset sending state on stream error
          }
        );
      }
    } catch (error) {
      console.error("Failed to send message or start session:", error);
      updateMessage(aiMessageId, {
        message: "Error processing message.",
        sender: "bot",
        error: "Failed response",
        isStreaming: false
      });
      setIsSending(false); // Ensure sending state is reset on any error
    }
    // No `finally` block here that unconditionally sets setIsSending(false)
    // because it's managed by the stream callbacks or handlePendingMessage
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
        if (!scrollViewport) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setLastUserMessageId(null);
          return;
        }

        const messageRect = messageElement.getBoundingClientRect();
        const containerRect = scrollViewport.getBoundingClientRect();
        const currentScrollTop = scrollViewport.scrollTop;

        const offset = messageRect.top - containerRect.top;

        scrollViewport.scrollTo({
          top: currentScrollTop + offset,
          behavior: 'smooth',
        });

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

      {/* <DebugPanel
        onDebugMessage={handleDebugMessage}
        disabled={isSending || isRegenerating}
        isVisible={true}
      /> */}

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