// src/components/ChatWindow.tsx
import { useUser } from '@clerk/clerk-react';
import { Copy, RefreshCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { nanoid } from 'nanoid';
import { JSX, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

// Local/UI component imports
import { ScrollArea } from "@/components/ui/scroll-area";
import { PromptInputWithActions } from "./chat-input";

// Store import
import { useChatStore } from '@/store/chat';

// Modular Chat Components
import { ActionIconDefinition, AiGraphContent, AiTableContent, Message, MessageFile, SuggestionTileData, UserInfo } from '@/types/chat';
import { AiLoadingIndicator } from './ai-loading-indicator';
import { ChatBubble } from './chat-bubbles';
import { ChatEmptyState } from './chat-empty-state';
import { ChatLoadingSkeleton } from './chat-loading-skeleton';
import { SuggestionTiles } from './chat-suggestion-tiles';
import { ImageModal } from './image-modal';

interface ChatWindowProps {
  chatId?: string;
}

export default function ChatWindow({ chatId: chatIdProp }: ChatWindowProps): JSX.Element {
  const { isSignedIn, user } = useUser();
  const navigate = useNavigate();
  
  // Zustand store
  const { 
    addMessage, 
    getMessages, 
    setPendingMessage, 
    getPendingMessage, 
    clearPendingMessage,
  } = useChatStore();

  const [currentChatId, setCurrentChatId] = useState<string | undefined>(chatIdProp);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isFirstMessage, setIsFirstMessage] = useState<boolean>(!chatIdProp);
  const [isLoadingHistory, setIsLoadingHistory] = useState(!!chatIdProp);
  const [isSending, setIsSending] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const revokeFileObjectURLs = (messageList: Message[]) => {
    messageList.forEach(msg => {
      msg.files?.forEach(file => {
        if (file.url && file.url.startsWith('blob:')) {
          URL.revokeObjectURL(file.url);
        }
      });
    });
  };

  // Component unmount cleanup
  useEffect(() => {
    return () => {
      revokeFileObjectURLs(messagesRef.current);
    };
  }, []);

  const suggestionTiles: SuggestionTileData[] = [
    { id: 1, title: "Show me sales data", description: "Generate content or brainstorm ideas" },
    { id: 2, title: "Analyze my user demographics", description: "Get assistance with any topic" },
    { id: 3, title: "Show me my product list", description: "Condense long documents" },
    { id: 4, title: "Code assistance", description: "Debug or create new code" }
  ];

  const handleCopy = (messageId: string) => {
    const messageToCopy = messages.find(m => m.id === messageId)?.message;
    if (messageToCopy) {
      navigator.clipboard.writeText(messageToCopy)
        .then(() => console.log("Message copied!"))
        .catch(err => console.error("Failed to copy message: ", err));
    }
  };

  const handleLike = (messageId: string): void => {
    console.log("Liked", messageId);
  };
  
  const handleDislike = (messageId: string): void => {
    console.log("Disliked", messageId);
  };

  const handleImageClick = (url: string) => {
    setSelectedImageUrl(url);
  };

  const closeImageModal = () => {
    setSelectedImageUrl(null);
  };

  const simulateAiResponse = async (userText: string, userFiles: MessageFile[], chatId: string) => {
    console.log(`Simulating AI response for chat ${chatId}...`);
    const aiResponseId = nanoid();
    setIsSending(true);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (!scrollAreaRef.current) {
      console.log("ChatWindow unmounted during AI simulation, aborting state update.");
      setIsSending(false);
      return;
    }

    let responseText = `Okay, I received: "${userText}". `;
    if (userFiles.length > 0) {
      responseText += `And ${userFiles.length} file(s): ${userFiles.map(f => f.name).join(', ')}. `;
    }

    let structuredContentDemo: AiGraphContent | AiTableContent | undefined = undefined;

    // Example: Based on user text, decide to send a graph or table
    if (userText.toLowerCase().includes("sales data")) {
      responseText += "Here's a sample of sales data:";
      structuredContentDemo = {
        contentType: 'graph',
        graphType: 'bar',
        title: "Quarterly Sales (USD)",
        data: [
          { quarter: 'Q1', sales: 12000, expenses: 8000 },
          { quarter: 'Q2', sales: 18000, expenses: 9500 },
          { quarter: 'Q3', sales: 15000, expenses: 9000 },
          { quarter: 'Q4', sales: 21000, expenses: 11000 },
        ],
        options: {
          categoryKey: 'quarter',
          dataKeys: ['sales', 'expenses'],
          colors: ['#82ca9d', '#FA8072'],
          xAxisLabel: 'Fiscal Quarter',
          yAxisLabel: 'Amount (USD)',
        },
        description: "This bar chart shows sales and expenses per quarter. Q4 shows highest sales."
      };
    } else if (userText.toLowerCase().includes("user demographics")) {
      responseText += "Here is a breakdown of user demographics by region:";
      structuredContentDemo = {
        contentType: 'graph',
        graphType: 'pie',
        title: "User Demographics by Region",
        data: [
          { region: 'North America', users: 4500 },
          { region: 'Europe', users: 3200 },
          { region: 'Asia', users: 2800 },
          { region: 'South America', users: 1500 },
          { region: 'Other', users: 800 },
        ],
        options: {
          categoryKey: 'region',
          dataKeys: ['users'],
          colors: ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AA00FF'],
        },
        description: "North America has the largest user base."
      };
    } else if (userText.toLowerCase().includes("product list")) {
        responseText += "Here is our current product list:";
        structuredContentDemo = {
            contentType: 'table',
            title: "Product Inventory",
            data: [
                { id: 'P1001', name: 'Laptop Pro X', category: 'Electronics', price: 1299.99, stock: 50 },
                { id: 'P1002', name: 'Wireless Mouse G5', category: 'Accessories', price: 49.99, stock: 250 },
                { id: 'P1003', name: 'Mechanical Keyboard K7', category: 'Accessories', price: 119.50, stock: 120 },
                { id: 'P1004', name: '4K Monitor U27', category: 'Electronics', price: 399.00, stock: 75 },
            ],
            columns: [
                { accessorKey: 'id', header: 'Product ID' },
                { accessorKey: 'name', header: 'Product Name' },
                { accessorKey: 'category', header: 'Category' },
                { accessorKey: 'price', header: 'Price (USD)' },
                { accessorKey: 'stock', header: 'In Stock' },
            ],
            description: "Prices and stock levels are subject to change."
        };
    } else {
      responseText += "How can I assist you further?";
    }

    const aiResponse: Message = {
      id: aiResponseId,
      message: responseText,
      sender: "bot",
      structuredContent: structuredContentDemo,
      timestamp: new Date().toISOString(),
    };

    // Add to both local state and Zustand store
    addMessage(chatId, aiResponse);
    setMessages(prev => [...prev, aiResponse]);
  };

  const handleRegenerate = (messageId: string) => {
    const botMessageIndex = messages.findIndex(m => m.id === messageId);
    if (botMessageIndex > 0 && messages[botMessageIndex].sender === 'bot') {
      const userMessage = messages[botMessageIndex - 1];
      if (userMessage?.sender === 'user') {
        if (!currentChatId) { 
          console.error("Cannot regenerate, chat ID is missing."); 
          return; 
        }
        console.log(`Regenerating response for prompt: "${userMessage.message}" in chat ${currentChatId}`);
        setIsSending(true);
        setMessages(prev => prev.filter(m => m.id !== messageId));

        simulateAiResponse(userMessage.message, userMessage.files || [], currentChatId)
          .catch(error => {
            console.error("Error regenerating response:", error);
            const errorMsgId = nanoid();
            const errorMsg: Message = { 
              id: errorMsgId, 
              message: "Error regenerating response.", 
              sender: 'bot', 
              error: 'Failed to regenerate' 
            };
            addMessage(currentChatId, errorMsg);
            setMessages(prev => [...prev, errorMsg]);
          })
          .finally(() => setIsSending(false));
      } else { 
        console.warn("Could not find preceding user message for regeneration."); 
      }
    }
  };

  const actionIcons: ActionIconDefinition[] = [
    { icon: Copy, type: "Copy", action: handleCopy },
    { icon: RefreshCcw, type: "Regenerate", action: handleRegenerate },
    { icon: ThumbsUp, type: "Like", action: handleLike },
    { icon: ThumbsDown, type: "Dislike", action: handleDislike },
  ];

  useEffect(() => {
    console.log("ChatWindow: chatIdProp received:", chatIdProp);
    revokeFileObjectURLs(messagesRef.current);

    setCurrentChatId(chatIdProp);
    const isNewChat = !chatIdProp;
    setIsFirstMessage(isNewChat);
    setIsLoadingHistory(!!chatIdProp);

    if (isNewChat) {
      console.log("ChatWindow: Detected new chat state (no chatId prop). Clearing messages.");
      setMessages([]);
    }
  }, [chatIdProp]);

  const checkAndSendPendingMessage = (idToCheck: string) => {
    const pending = getPendingMessage(idToCheck);
    if (pending) {
      console.log(`ChatWindow: Found pending message for ${idToCheck}, initiating AI response...`);
      clearPendingMessage();
      setIsSending(true);
      simulateAiResponse(pending.text, pending.files, idToCheck)
        .catch(error => {
          console.error("Error sending pending message:", error);
          const errorMsgId = nanoid();
          const errorMsg: Message = { 
            id: errorMsgId, 
            message: "Error sending message.", 
            sender: 'bot', 
            error: 'Failed to send' 
          };
          addMessage(idToCheck, errorMsg);
          setMessages(prev => [...prev, errorMsg]);
        })
        .finally(() => setIsSending(false));
    }
  };

  useEffect(() => {
    if (currentChatId && isLoadingHistory) {
      console.log(`ChatWindow: useEffect - Loading history for chat: ${currentChatId}`);
      revokeFileObjectURLs(messagesRef.current);
      
      // Load messages from Zustand store first
      const storedMessages = getMessages(currentChatId);
      
      const timer = setTimeout(() => {
        let fetchedMessages: Message[] = storedMessages;
        
        // If no stored messages, simulate fetching from API
        if (fetchedMessages.length === 0 && currentChatId === 'existing-chat-1') {
          fetchedMessages = [
            { id: nanoid(), message: "Hello from history!", sender: 'user' },
            { id: nanoid(), message: "Hi user, this is a historical reply.", sender: 'bot' },
          ];
        }
        
        console.log(`ChatWindow: History fetch complete for ${currentChatId}. Found ${fetchedMessages.length} messages.`);
        setMessages(fetchedMessages);
        setIsLoadingHistory(false);
        checkAndSendPendingMessage(currentChatId);
      }, 500);
      
      return () => clearTimeout(timer);
    } else if (!currentChatId) {
      if (messagesRef.current.length > 0) {
        revokeFileObjectURLs(messagesRef.current);
        setMessages([]);
      }
      setIsFirstMessage(true);
      setIsLoadingHistory(false);
    }
  }, [currentChatId, isLoadingHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block:"start" });
  }, [messages]);

  const handleSendMessage = async (text: string, files: File[]) => {
    if (!text.trim() && files.length === 0) return;

    const fileMetadata: MessageFile[] = files.map(f => {
      let objectUrl: string | undefined = undefined;
      if (f.type.startsWith('image/') || f.type === 'application/pdf') {
        try {
          objectUrl = URL.createObjectURL(f);
        } catch (error) {
          console.error("Error creating object URL for file:", f.name, error);
        }
      }
      return {
        name: f.name,
        type: f.type,
        size: f.size,
        url: objectUrl,
      };
    });

    const newUserMessage: Message = { 
      id: nanoid(), 
      message: text, 
      sender: "user", 
      files: fileMetadata,
      timestamp: new Date().toISOString()
    };

    if (isFirstMessage) {
      console.log("ChatWindow: First message send initiated...");
      const newChatId = `chat_${nanoid(12)}`;

      // Add user message to both local state and store
      addMessage(newChatId, newUserMessage);
      setMessages(prev => [...prev, newUserMessage]);
      setIsSending(true);
      setIsFirstMessage(false);

      // Store pending message in Zustand store
      setPendingMessage(text, fileMetadata, newChatId);

      try {
        console.log(`ChatWindow: Simulating registration of new chat: ${newChatId}...`);
        await new Promise(resolve => setTimeout(resolve, 200));
        console.log(`ChatWindow: Navigating to /chat/${newChatId}`);
        navigate(`/chat/${newChatId}`, { replace: true });
      } catch (error) {
        console.error("ChatWindow: Failed to create/register new chat session:", error);
        clearPendingMessage();
        revokeFileObjectURLs([newUserMessage]);
        setMessages(prev => prev.filter(m => m.id !== newUserMessage.id));
        const errorMsgId = nanoid();
        const errorMsg: Message = { 
          id: errorMsgId, 
          message: "Error starting new chat.", 
          sender: 'bot', 
          error: 'Failed to start chat' 
        };
        addMessage(newChatId, errorMsg);
        setMessages(prev => [...prev, errorMsg]);
        setIsSending(false);
        setIsFirstMessage(true);
      }
    } else {
      if (!currentChatId) {
        console.error("ChatWindow: Cannot send message, currentChatId is missing for an existing chat.");
        const errorMsgId = nanoid();
        const errorMsg: Message = { 
          id: errorMsgId, 
          message: "Error: Chat session not found.", 
          sender: 'bot', 
          error: 'Chat ID missing' 
        };
        setMessages(prev => [...prev, errorMsg]);
        return;
      }

      console.log(`ChatWindow: Sending message to existing chat ${currentChatId}`);
      // Add user message to both local state and store
      addMessage(currentChatId, newUserMessage);
      setMessages(prev => [...prev, newUserMessage]);
      setIsSending(true);

      try {
        await simulateAiResponse(text, fileMetadata, currentChatId);
      } catch (error) {
        console.error("ChatWindow: Error sending message/getting response:", error);
        const errorMsgId = nanoid();
        const errorMsg: Message = { 
          id: errorMsgId, 
          message: "Error getting AI response.", 
          sender: 'bot', 
          error: 'Failed response' 
        };
        addMessage(currentChatId, errorMsg);
        setMessages(prev => [...prev, errorMsg]);
      } finally {
        setIsSending(false);
      }
    }
  };

  const handleSuggestionClick = (title: string): void => {
    handleSendMessage(title, []);
  };

  const clerkUser: UserInfo | undefined = user ? {
    firstName: user.firstName,
    imageUrl: user.imageUrl,
  } : undefined;

  return (
    <>
      <ImageModal 
        isOpen={!!selectedImageUrl} 
        onClose={closeImageModal} 
        imageUrl={selectedImageUrl} 
      />
      <div className="flex flex-col h-full bg-background dark:bg-zinc-800 w-full min-w-0">
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {isLoadingHistory ? (
            <ChatLoadingSkeleton />
          ) : (
            <ScrollArea className="h-[60vh]" type="scroll"  ref={scrollAreaRef}>
              <div className="p-4 md:p-6 space-y-6">
                <div className="max-w-3xl mx-auto w-full space-y-8">
                  {messages.length === 0 && !isSending && (
                    <ChatEmptyState
                      isFirstMessage={isFirstMessage}
                      isSignedIn={!!isSignedIn}
                      userName={user?.firstName}
                    />
                  )}
                  {messages.map((message) => (
                    <ChatBubble
                      key={message.id}
                      message={message}
                      currentUser={clerkUser}
                      actionIcons={actionIcons}
                      botAvatarSrc='/logo.svg'
                      onImageClick={handleImageClick}
                    />
                  ))}
                  {isSending && (messages.length === 0 || messages[messages.length -1]?.sender === 'user') && (
                    <AiLoadingIndicator />
                  )}
                  <div ref={messagesEndRef} className="h-[1px]" />
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
        <div className="p-4 border-t border-border bg-background dark:bg-zinc-800 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            {isFirstMessage && messages.length === 0 && !isSending && !isLoadingHistory && (
              <SuggestionTiles
                tiles={suggestionTiles}
                onSuggestionClick={handleSuggestionClick}
                disabled={isSending}
              />
            )}
            <div className="max-w-3xl mx-auto">
              <PromptInputWithActions onSubmit={handleSendMessage} isLoading={isSending} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}