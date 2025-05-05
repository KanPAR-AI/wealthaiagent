import { create } from 'zustand';

// Define base type for all message content
interface BaseMessageContent {
  type: string;
}

// Specific message content types
interface TextMessageContent extends BaseMessageContent {
  type: 'text';
  text: string;
}

interface ImageMessageContent extends BaseMessageContent {
  type: 'image';
  url: string;
  altText?: string;
}

interface GraphMessageContent extends BaseMessageContent {
  type: 'graph';
  data: any; // Adjust based on your graph data structure
  options?: any; // Adjust based on your graph options
}

interface TableMessageContent extends BaseMessageContent {
  type: 'table';
  headers: string[];
  rows: string[][];
}

// Union type for all possible message content
export type MessageContent =
  | TextMessageContent
  | ImageMessageContent
  | GraphMessageContent
  | TableMessageContent;

// Define sender types
export type SenderType = 'user' | 'bot' | 'system';

// Define the structure for message metadata (optional but good practice)
interface MessageMetadata {
  timestamp: Date;
  [key: string]: any; // Allows for adding other metadata if needed
}

// Define the main Message interface
export interface ChatMessage {
  id: string;
  sender: SenderType;
  content: MessageContent;
  metadata?: MessageMetadata;
}

// Define the ChatState interface for Zustand
interface ChatState {
  chats: Record<string, ChatMessage[]>;
  addMessage: (chatId: string, message: ChatMessage) => void;
  clearChat: (chatId: string) => void;
}

// Create the Zustand store
export const useChatStore = create<ChatState>((set) => ({
  chats: {},
  addMessage: (chatId, message) =>
    set((state) => ({
      chats: {
        ...state.chats,
        [chatId]: [...(state.chats[chatId] || []), message],
      },
    })),
  clearChat: (chatId) =>
    set((state) => ({
      chats: {
        ...state.chats,
        [chatId]: [],
      },
    })),
}));

