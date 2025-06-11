import { ChatMessageList } from '@/components/chat/message-list';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatMessages } from '@/hooks/use-chat-messages';
import { useChatSession } from '@/hooks/use-chat-session';
import { useMessageActions } from '@/hooks/use-message-actions';
import { generateAiResponse } from '@/services/ai-service';
import { useChatStore } from '@/store/chat';
import { ChatWindowProps, Message, MessageFile, SuggestionTileData } from '@/types/chat';
import { useUser } from '@clerk/clerk-react';
import { Copy, RefreshCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { nanoid } from 'nanoid';
import { useEffect, useState } from 'react';
import { AiLoadingIndicator } from './ai-loading-indicator';
import { ChatEmptyState } from './chat-empty-state';
import { PromptInputWithActions } from "./chat-input";
import { SuggestionTiles } from './chat-suggestion-tiles';
import { ImageModal } from './image-modal';
import { fileToDataURL } from '@/lib/files';

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
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

 
  const { chatId, isFirstMessage, startNewSession, setCurrentChatId } = useChatSession(chatIdProp);
  const { messages, addMessage, clearMessages } = useChatMessages(chatId || '');
  const { setPendingMessage, getPendingMessage, clearPendingMessage } = useChatStore();
  const {
    handleCopy,
    handleLike,
    handleDislike,
    handleRegenerate,
    isRegenerating
  } = useMessageActions(chatId || '');

  const [isSending, setIsSending] = useState(false);
  const [lastUserMessageId, setLastUserMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (chatId) {
      const pendingMessage = getPendingMessage(chatId);
      if (pendingMessage && !isSending) {
        handlePendingMessage(pendingMessage.text, pendingMessage.files);
      }
    }
  }, [chatId]);

  useEffect(() => {
    if (isFirstMessage && chatId) {
      clearMessages();
    }
  }, [isFirstMessage, chatId, clearMessages]);

  const handlePendingMessage = async (text: string, files: MessageFile[]) => {
    clearPendingMessage();
    const userMessageId = nanoid();
    const userMessage: Message = {
      id: userMessageId,
      message: text,
      sender: "user",
      files,
      timestamp: new Date().toISOString()
    };
    const cleanup = addMessage(userMessage);
    setIsSending(true);
    setLastUserMessageId(userMessageId);

    try {
      const aiResponse = await generateAiResponse(text, files);
      addMessage({ ...aiResponse, id: nanoid(), timestamp: new Date().toISOString() });
    } catch (error) {
      console.error(error)
      addMessage({
        id: nanoid(),
        message: "Error getting AI response",
        sender: "bot",
        error: "Failed response",
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsSending(false);
      cleanup?.();
    }
  };

  const handleSend = async (text: string, files: File[]) => {
    if (!text.trim() && files.length === 0) return;
  
    const fileMetadata: MessageFile[] = await Promise.all(
      files.map(async (f) => ({
        name: f.name,
        type: f.type,
        size: f.size,
        url: f.type.startsWith('image/') ? await fileToDataURL(f) : undefined
      }))
    );
  
    if (isFirstMessage) {
      const newChatId = nanoid();
      setPendingMessage(text, fileMetadata, newChatId);
      try {
        const targetChatId = await startNewSession(text, fileMetadata);
        if (targetChatId) {
          setCurrentChatId(targetChatId);
          onNewChatCreated?.(targetChatId);
        }
      } catch (error) {
        clearPendingMessage();
        console.error('Failed to start new session:', error);
      }
      return;
    }
  
    if (!chatId) return;
  
    const userMessageId = nanoid();
    const userMessage: Message = {
      id: userMessageId,
      message: text,
      sender: "user",
      files: fileMetadata,
      timestamp: new Date().toISOString()
    };
  
    const cleanup = addMessage(userMessage);
    setIsSending(true);
    setLastUserMessageId(userMessageId);
  
    try {
      const aiResponse = await generateAiResponse(text, fileMetadata);
      addMessage({ ...aiResponse, id: nanoid(), timestamp: new Date().toISOString() });
    } catch (error) {
      console.error(error)
      addMessage({
        id: nanoid(),
        message: "Error getting AI response",
        sender: "bot",
        error: "Failed response",
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsSending(false);
      cleanup?.();
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
        if (!scrollViewport) {
          // fallback
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setLastUserMessageId(null);
          return;
        }
  
        const messageRect = messageElement.getBoundingClientRect();
        const containerRect = scrollViewport.getBoundingClientRect();
        const currentScrollTop = scrollViewport.scrollTop;
  
        // Calculate how far the message is from the top of the container
        const offset = messageRect.top - containerRect.top ;
  
        // Scroll so that the message aligns with top
        scrollViewport.scrollTo({
          top: currentScrollTop + offset,
          behavior: 'smooth',
        });

  
        setLastUserMessageId(null);
      }, 50); // Slight delay ensures layout is painted
  
      return () => clearTimeout(timeout);
    }
  }, [lastUserMessageId]);
  

  return (
    <>
      <ImageModal 
        isOpen={!!selectedImageUrl} 
        onClose={() => setSelectedImageUrl(null)} 
        imageUrl={selectedImageUrl} 
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
                    onImageClick={setSelectedImageUrl}
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
                isLoading={isSending || isRegenerating} 
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
