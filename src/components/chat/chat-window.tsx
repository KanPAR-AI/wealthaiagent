import { useUser } from '@clerk/clerk-react';
import { useRef, useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PromptInputWithActions } from "./chat-input";
import { ChatEmptyState } from './chat-empty-state';
import { SuggestionTiles } from './chat-suggestion-tiles';
import { AiLoadingIndicator } from './ai-loading-indicator';
import { ImageModal } from './image-modal';
import { ChatMessageList } from '@/components/chat/message-list';
import { useChatMessages } from '@/hooks/use-chat-messages';
import { useChatSession } from '@/hooks/use-chat-session';
import { generateAiResponse } from '@/services/ai-service';
import { ChatWindowProps, Message, MessageFile, SuggestionTileData } from '@/types/chat';
import { Copy, RefreshCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { nanoid } from 'nanoid';
import { useMessageActions } from '@/hooks/use-message-actions';
import { useChatStore } from '@/store/chat';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Handle chat changes and pending messages
  useEffect(() => {
    if (chatId) {
      // Check for pending message when chatId changes
      const pendingMessage = getPendingMessage(chatId);
      if (pendingMessage && !isSending) {
        // Process the pending message
        handlePendingMessage(pendingMessage.text, pendingMessage.files);
      }
    }
  }, [chatId]);

  // Clear messages when starting a new chat
  useEffect(() => {
    if (isFirstMessage && chatId) {
      clearMessages();
    }
  }, [isFirstMessage, chatId, clearMessages]);

  const handlePendingMessage = async (text: string, files: MessageFile[]) => {
    clearPendingMessage();
    
    const userMessage: Message = {
      id: nanoid(),
      message: text,
      sender: "user",
      files: files,
      timestamp: new Date().toISOString()
    };

    const cleanup = addMessage(userMessage);
    setIsSending(true);

    try {
      const aiResponse = await generateAiResponse(text, files);
      addMessage({
        ...aiResponse,
        id: nanoid(),
        timestamp: new Date().toISOString()
      });
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

    const fileMetadata: MessageFile[] = files.map(f => ({
      name: f.name,
      type: f.type,
      size: f.size,
      url: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined
    }));

    // Handle first message in new chat
    if (isFirstMessage) {
      // Store as pending message first
      const newChatId = nanoid(); // Generate new chat ID
      setPendingMessage(text, fileMetadata, newChatId);
      
      try {
        const targetChatId = await startNewSession(text, fileMetadata);
        if (targetChatId) {
          setCurrentChatId(targetChatId);
          onNewChatCreated?.(targetChatId);
          // The useEffect will handle the pending message when chatId changes
        }
      } catch (error) {
        clearPendingMessage();
        console.error('Failed to start new session:', error);
      }
      return;
    }

    // Handle regular message
    if (!chatId) return;

    const userMessage: Message = {
      id: nanoid(),
      message: text,
      sender: "user",
      files: fileMetadata,
      timestamp: new Date().toISOString()
    };

    const cleanup = addMessage(userMessage);
    setIsSending(true);

    try {
      const aiResponse = await generateAiResponse(text, fileMetadata);
      addMessage({
        ...aiResponse,
        id: nanoid(),
        timestamp: new Date().toISOString()
      });
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

  // Scroll to bottom effect
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <>
      <ImageModal 
        isOpen={!!selectedImageUrl} 
        onClose={() => setSelectedImageUrl(null)} 
        imageUrl={selectedImageUrl} 
      />
      <div className={`flex flex-col h-screen bg-background dark:bg-zinc-800 w-full min-w-0 ${className}`}>
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-hidden">
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
                  />
                )}
                {(isSending || isRegenerating) && <AiLoadingIndicator />}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </ScrollArea>
        </div>

        <div className="max-w-3xl mx-auto w-full px-4 pb-4">
          <PromptInputWithActions 
            onSubmit={handleSend} 
            isLoading={isSending || isRegenerating} 
          />
        </div>
      </div>
      </div>
    </>
  );
}