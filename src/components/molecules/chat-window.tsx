import {
  ChatBubbleAvatar
} from "@/components/ui/chat-bubble";
import { Copy, RefreshCcw } from "lucide-react";
import { JSX, useState } from "react";
import Logo from "../ui/logo";
import { SidebarTrigger } from "../ui/sidebar";
import { PromptInputWithActions } from "./chat-input";

// Define types for messages and action icons
type MessageSender = "user" | "bot";

interface Message {
  id: number;
  message: string;
  sender: MessageSender;
}

interface SuggestionTile {
  id: number;
  title: string;
  description: string;
}

interface ActionIcon {
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  type: string;
}

export default function ChatWindow(): JSX.Element {
  // State for messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [isFirstMessage, setIsFirstMessage] = useState<boolean>(true);
  
  // Define suggestion tiles data
  const suggestionTiles: SuggestionTile[] = [
    { id: 1, title: "Help me write", description: "Generate content or brainstorm ideas" },
    { id: 2, title: "Answer questions", description: "Get assistance with any topic" },
    { id: 3, title: "Summarize text", description: "Condense long documents" },
    { id: 4, title: "Code assistance", description: "Debug or create new code" }
  ];

  // Action icons for AI messages
  const actionIcons: ActionIcon[] = [
    { icon: Copy, type: "Copy" },
    { icon: RefreshCcw, type: "Regenerate" },
  ];

  // Handle sending a new message
  const handleSendMessage = (text: string): void => {
    // Add user message
    const newUserMessage: Message = { id: Date.now(), message: text, sender: "user" };
    setMessages(prev => [...prev, newUserMessage]);
    
    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = { 
        id: Date.now() + 1, 
        message: "I'm here to help! How can I assist you with that?", 
        sender: "bot" 
      };
      setMessages(prev => [...prev, aiResponse]);
    }, 1000);
    
    if (isFirstMessage) {
      setIsFirstMessage(false);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (title: string): void => {
    handleSendMessage(title);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="sticky top-0 z-10 flex h-16 items-center border-b bg-background px-4">
        <SidebarTrigger className="mr-2" />
        <Logo />
      </div>
      <div className="flex flex-col flex-1 w-full">
        {isFirstMessage ? (
          // Empty state with suggestions
          <div className="flex items-center justify-center flex-1">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Select or create a chat</h1>
              <p className="text-muted-foreground">Choose from your recent chats or start a new conversation</p>
            </div>
          </div>
        ) : (
          // Chat messages
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-3xl mx-auto">
              {messages.map((message) => {
                const variant = message.sender === "user" ? "sent" : "received";
                return (
                  <div key={message.id} className="py-6 first:pt-0 last:pb-0">
                    <div className="flex gap-3">
                      <ChatBubbleAvatar
                        src={variant === "sent"
                          ? "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64&h=64&q=80&crop=faces&fit=crop"
                          : "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&q=80&crop=faces&fit=crop"
                        }
                        fallback={variant === "sent" ? "US" : "AI"}
                      />
                      <div className="flex-1">
                        {message.message}
                        {message.sender === "bot" && (
                          <div className="flex gap-2 mt-2">
                            {actionIcons.map(({ icon: Icon, type }) => (
                              <button
                                key={type}
                                onClick={() => console.log(`Action ${type} clicked for message ${message.id}`)}
                                className="p-1 hover:bg-muted rounded-md transition-colors"
                              >
                                <Icon className="size-3" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Suggestions and Input */}
        <div className="p-4 border-t">
          <div className="max-w-3xl mx-auto">
            {isFirstMessage && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {suggestionTiles.map((tile) => (
                  <button
                    key={tile.id}
                    className="bg-secondary/50 hover:bg-secondary/80 rounded-lg p-3 text-left transition-colors"
                    onClick={() => handleSuggestionClick(tile.title)}
                  >
                    <h3 className="font-medium text-sm">{tile.title}</h3>
                    <p className="text-xs text-muted-foreground">{tile.description}</p>
                  </button>
                ))}
              </div>
            )}
            <div className="w-full">
              <CustomPromptInput onSendMessage={handleSendMessage} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Props interface for CustomPromptInput
interface CustomPromptInputProps {
  onSendMessage: (text: string) => void;
}

// Custom wrapper for PromptInputWithActions that passes the message to the parent
function CustomPromptInput({ onSendMessage }: CustomPromptInputProps): JSX.Element {
  // You'll need to modify your PromptInputWithActions component to accept a callback
  return <PromptInputWithActions onSubmit={onSendMessage} />;
}