// src/components/ChatWindow.tsx
import React, { JSX, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { nanoid } from 'nanoid';
import { Copy, RefreshCcw } from "lucide-react";
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from '@clerk/clerk-react';

// Local/UI component imports (adjust paths as needed)
import { ChatBubbleAvatar } from "@/components/ui/chat-bubble";
import Logo from "../ui/logo";
import { SidebarTrigger, useSidebar } from "../ui/sidebar";
import { PromptInputWithActions } from "./chat-input"; 
import { ScrollArea } from "../ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

// --- Type Definitions ---
type MessageSender = "user" | "bot";
interface Message { id: string; message: string; sender: MessageSender; files?: { name: string; type: string; size: number }[]; isLoading?: boolean; error?: string; }
interface SuggestionTile { id: number; title: string; description: string; }
interface ActionIcon { icon: React.FC<React.SVGProps<SVGSVGElement>>; type: string; action: (messageId: string) => void; }
interface ChatWindowProps { chatId?: string; } // chatId is OPTIONAL

// --- ChatWindow Component ---
export default function ChatWindow({ chatId: chatIdProp }: ChatWindowProps): JSX.Element {
  const { isSignedIn, user } = useUser();
  const navigate = useNavigate();
  const sidebarContext = useSidebar();

  // --- State ---
  const [currentChatId, setCurrentChatId] = useState<string | undefined>(chatIdProp);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isFirstMessage, setIsFirstMessage] = useState<boolean>(!chatIdProp);
  const [isLoadingHistory, setIsLoadingHistory] = useState(!!chatIdProp);
  const [isSending, setIsSending] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Data & Action Handlers ---
  const suggestionTiles: SuggestionTile[] = [
    { id: 1, title: "Help me write", description: "Generate content or brainstorm ideas" },
    { id: 2, title: "Answer questions", description: "Get assistance with any topic" },
    { id: 3, title: "Summarize text", description: "Condense long documents" },
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

  // Simulates sending data to AI and getting response
  const simulateAiResponse = async (userText: string, userFiles: { name: string; type: string; size: number }[]) => {
     // NOTE: This function *itself* should NOT set isSending.
     // The caller (handleSendMessage or checkAndSendPendingMessage) manages isSending.
     console.log(`Simulating AI response for chat ${currentChatId}...`);
     const aiResponseId = nanoid();

     // Simulate network delay + processing
     await new Promise(resolve => setTimeout(resolve, 1500));

     // Check if component is still mounted or relevant before setting state
     // (More robust check might involve AbortController or checking refs)
     if(!scrollAreaRef.current) {
         console.log("ChatWindow unmounted during AI simulation, aborting state update.");
         return;
     }

     let responseText = `Okay, I received: "${userText}"`;
     if (userFiles.length > 0) {
       responseText += ` And ${userFiles.length} file(s): ${userFiles.map(f => f.name).join(', ')}.`;
     }
     responseText += ` How can I assist further?`;

     const aiResponse: Message = {
       id: aiResponseId,
       message: responseText,
       sender: "bot"
     };

     setMessages(prev => [...prev, aiResponse]);
  };

  const handleRegenerate = (messageId: string) => {
      const botMessageIndex = messages.findIndex(m => m.id === messageId);
      if (botMessageIndex > 0 && messages[botMessageIndex].sender === 'bot') {
          const userMessage = messages[botMessageIndex - 1];
          if(userMessage?.sender === 'user') {
              if (!currentChatId) { console.error("Cannot regenerate, chat ID is missing."); return; }
              console.log(`Regenerating response for prompt: "${userMessage.message}" in chat ${currentChatId}`);
              setIsSending(true);
              // TODO: API Call
              simulateAiResponse(userMessage.message, userMessage.files || [])
                 .catch(error => {
                     console.error("Error regenerating response:", error);
                     setMessages(prev => [...prev, { id: nanoid(), message: "Error regenerating response.", sender: 'bot', error: 'Failed to regenerate' }]);
                 })
                 .finally(() => setIsSending(false));
          } else { console.warn("Could not find preceding user message."); }
      }
  };

  const actionIcons: ActionIcon[] = [
    { icon: Copy, type: "Copy", action: handleCopy },
    { icon: RefreshCcw, type: "Regenerate", action: handleRegenerate },
  ];

  // --- Effects ---

  // Update internal state when chatId prop changes
  useEffect(() => {
      console.log("ChatWindow: chatIdProp received:", chatIdProp);
      setCurrentChatId(chatIdProp);
      const isNewChat = !chatIdProp;
      setIsFirstMessage(isNewChat);
      setIsLoadingHistory(!!chatIdProp);
      if (isNewChat) {
          console.log("ChatWindow: Detected new chat state (no chatId prop). Clearing messages.");
          setMessages([]);
          sessionStorage.removeItem('pendingMessage'); // Clear pending on navigating to /new state
      }
  }, [chatIdProp]);

  // Function to check and send pending message (called after history load)
  const checkAndSendPendingMessage = (idToCheck: string | undefined) => {
      if (!idToCheck) return;
      const pending = sessionStorage.getItem('pendingMessage');
      if (pending) {
          const pendingData = JSON.parse(pending);
          if (pendingData.targetChatId === idToCheck) { // Ensure it's for THIS chat
              console.log(`ChatWindow: Found pending message for ${idToCheck}, initiating AI response...`);
              sessionStorage.removeItem('pendingMessage');
              setIsSending(true);
              simulateAiResponse(pendingData.text, pendingData.fileInfo || [])
                  .catch(error => { console.error(error) })
                  .finally(() => setIsSending(false));
          } else {
              console.warn("Cleared stale pending message from sessionStorage.");
              sessionStorage.removeItem('pendingMessage');
          }
      }
  };

  // Load chat history
  useEffect(() => {
    if (currentChatId && isLoadingHistory) {
      console.log(`ChatWindow: useEffect - Loading history for chat: ${currentChatId}`);
      setMessages([]);
      // --- TODO: API Call ---
      const timer = setTimeout(() => {
        let fetchedMessages: Message[] = [];
        if (currentChatId === 'existing-chat-1') { fetchedMessages = [ /* ... dummy messages ... */ ]; }
        console.log(`ChatWindow: History fetch complete for ${currentChatId}.`);
        setMessages(fetchedMessages);
        setIsLoadingHistory(false); // History loading complete
         // Check for pending message *after* history load attempt
        checkAndSendPendingMessage(currentChatId);
      }, 500);
      return () => clearTimeout(timer);
    } else if (!currentChatId) {
        setIsLoadingHistory(false); // Ensure loading is false if no ID
        setMessages([]);
    }
  }, [currentChatId, isLoadingHistory]); // Rerun if chatId changes or loading flag is explicitly set true

  // Auto-scroll to bottom
  useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);


  // --- Main Send Logic ---
  const handleSendMessage = async (text: string, files: File[]) => {
    if (!text.trim() && files.length === 0) return;

    const fileMetadata = files.map(f => ({ name: f.name, type: f.type, size: f.size }));
    const newUserMessage: Message = { id: nanoid(), message: text, sender: "user", files: fileMetadata };

    // --- Logic for FIRST message ---
    if (isFirstMessage) {
        console.log("ChatWindow: First message send initiated...");
        const newChatId = `chat_${nanoid(12)}`;
        setIsSending(true);
        setMessages(prev => [...prev, newUserMessage]); // Add user message optimistically

        // Store context needed for AI call AFTER navigation
        sessionStorage.setItem('pendingMessage', JSON.stringify({ text, fileInfo: fileMetadata, targetChatId: newChatId }));

        // --- Optional: API Call to create/register chat session ---
        try {
            console.log(`ChatWindow: Registering ${newChatId} (simulated)...`);
            // await fetch('/api/chats', { method: 'POST', ... });
            console.log(`ChatWindow: Navigating to /chat/${newChatId}`);
            navigate(`/chat/${newChatId}`, { replace: true });
            // State updates happen via useEffect based on prop change after nav
            // setIsFirstMessage(false); // Let useEffect handle this based on prop change
            // Keep isSending true until checkAndSendPendingMessage resets it
            return;
        } catch (error) {
            console.error("ChatWindow: Failed to create/register new chat session:", error);
            sessionStorage.removeItem('pendingMessage');
            setMessages(prev => prev.filter(m => m.id !== newUserMessage.id)); // Remove optimistic message
            setMessages(prev => [...prev, { id: nanoid(), message: "Error starting chat.", sender: 'bot', error: 'Failed to start' }]);
            setIsSending(false); // Reset loading on error
            return;
        }
    }

    // --- Logic for SUBSEQUENT messages ---
    if (!currentChatId) { console.error("ChatWindow: Cannot send message, currentChatId is missing."); return; }

    console.log(`ChatWindow: Sending message to chat ${currentChatId}`);
    setIsSending(true);
    setMessages(prev => [...prev, newUserMessage]); // Add message optimistically

    try {
        // --- TODO: API Call ---
        await simulateAiResponse(text, fileMetadata);
    } catch (error) {
         console.error("ChatWindow: Error sending message/getting response:", error);
         setMessages(prev => [...prev, { id: nanoid(), message: "Error getting response.", sender: 'bot', error: 'Failed to get response' }]);
    } finally {
        setIsSending(false);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (title: string): void => { handleSendMessage(title, []); };

  // --- Render ---
  return (
    <div className="flex flex-col h-full bg-background dark:bg-zinc-800 w-full min-w-0">

      {/* Header */}
      <div className="flex h-16 flex-shrink-0 items-center border-b border-border bg-background dark:bg-zinc-800 px-4 justify-between">
         {sidebarContext && <SidebarTrigger className="mr-2" />}
         <div className="flex items-center gap-2 overflow-hidden flex-1">
            <Logo />
            {/* You could fetch and display the actual chat title here */}
         </div>
         <div className="flex items-center gap-4 flex-shrink-0">
           <SignedOut><SignInButton mode="modal"><button className="btn-primary-sm">Sign In</button></SignInButton></SignedOut>
           <SignedIn><UserButton/></SignedIn>
         </div>
      </div>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

         {isLoadingHistory ? (
             <div className="flex-1 flex items-center justify-center p-4"> {/* Loading state */}
                 {/* Skeletons */}
                 <div className="w-full max-w-md space-y-4">
                     <div className="flex items-center space-x-3 justify-start"> <Skeleton className="h-10 w-10 rounded-full" /> <Skeleton className="h-6 w-3/4 rounded" /> </div>
                     <div className="flex items-center space-x-3 justify-end"> <Skeleton className="h-6 w-1/2 rounded" /> <Skeleton className="h-10 w-10 rounded-full" /> </div>
                     <div className="flex items-center space-x-3 justify-start"> <Skeleton className="h-10 w-10 rounded-full" /> <Skeleton className="h-6 w-2/3 rounded" /> </div>
                 </div>
             </div>
         ) : (
            // ScrollArea takes full space
            <ScrollArea className="h-[60vh]" type="scroll" ref={scrollAreaRef}>
                <div className="p-4 md:p-6 space-y-6">
                    <div className="max-w-3xl mx-auto"> {/* Constrains message width */}
                        {/* Initial Prompt / Empty State */}
                        {messages.length === 0 && !isSending && (
                            <div className="p-6 text-center text-muted-foreground dark:text-zinc-400">
                                {isFirstMessage ? (
                                    <>
                                        <h2 className="text-xl font-semibold mb-4 text-foreground dark:text-zinc-200">Hello, {isSignedIn ? user?.firstName : "User"}!</h2>
                                        <p>How can I help you today?</p>
                                    </>
                                ) : (
                                    <p>No messages in this chat yet.</p>
                                )}
                            </div>
                        )}

                        {/* Message Mapping */}
                        {messages.map((message) => (
                            <div key={message.id} className={`flex gap-3 ${message.sender === "user" ? 'justify-end' : 'justify-start'}`}>
                                {message.sender === 'bot' && ( <ChatBubbleAvatar src={"/logo.svg"} fallback={"AI"} className="flex-shrink-0"/> )}
                                <div className={`flex flex-col ${message.sender === "user" ? 'items-end' : 'items-start'} max-w-[85%] md:max-w-[80%]`}>
                                    <div className={`px-3 py-2 md:px-4 md:py-2 rounded-2xl break-words text-sm md:text-base ${ message.sender === "user" ? 'bg-primary text-primary-foreground' : 'bg-muted dark:bg-zinc-700 dark:text-zinc-200' }`}>
                                        {message.message || <span className="italic opacity-70">...</span>}
                                        {/* File attachments */}
                                        {message.files && message.files.length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-border/50 text-xs opacity-80"> /* ... */ </div>
                                        )}
                                    </div>
                                    {/* Action Buttons */}
                                    {message.sender === 'bot' && !message.isLoading && !message.error && (
                                        <div className="flex gap-1 mt-2">
                                            {actionIcons.map(({ icon: Icon, type, action }) => (
                                                <button key={type} onClick={() => action(message.id)} title={type} className="p-1 hover:bg-secondary dark:hover:bg-zinc-600 rounded-md transition-colors text-muted-foreground hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-100">
                                                    <Icon className="size-3.5" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {message.sender === 'user' && ( <ChatBubbleAvatar src={user?.imageUrl} fallback={user?.firstName?.substring(0, 2).toUpperCase() || "U"} className="flex-shrink-0"/> )}
                            </div>
                        ))}

                         {/* AI Loading Indicator */}
                        {isSending && messages[messages.length - 1]?.sender === 'user' && (
                             <div className="flex gap-3 justify-start mt-6">
                                <ChatBubbleAvatar src={"/logo.svg"} fallback={"AI"} className="flex-shrink-0" />
                                <div className="px-4 py-2 rounded-2xl bg-muted dark:bg-zinc-700 animate-pulse text-sm text-muted-foreground dark:text-zinc-400">Thinking...</div>
                             </div>
                         )}

                        {/* Scroll Target */}
                        <div ref={messagesEndRef} className="h-[1px]" />
                    </div>
                </div>
            </ScrollArea>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border bg-background dark:bg-zinc-800 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
           {/* Suggestions */}
          {isFirstMessage && messages.length === 0 && !isSending && !isLoadingHistory && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {suggestionTiles.map((tile) => (
                <button key={tile.id} /* ... */ onClick={() => handleSuggestionClick(tile.title)} disabled={isSending} >
                  <h3 className="font-medium text-sm ...">{tile.title}</h3>
                  <p className="text-xs ...">{tile.description}</p>
                </button>
              ))}
            </div>
          )}
          {/* Prompt Input */}
          <div className="w-full">
            <PromptInputWithActions onSubmit={handleSendMessage} isLoading={isSending} />
             <p className="text-xs text-center text-muted-foreground dark:text-zinc-400 pt-2">
                AI responses may be inaccurate. Use Shift+Enter for newline.
             </p>
          </div>
        </div>
      </div>
    </div> 
  );
}