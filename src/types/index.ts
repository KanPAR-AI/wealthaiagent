// Local type definitions to replace @wealthwise/types

export interface Message {
  id: string;
  message: string;
  sender: 'user' | 'bot';
  timestamp?: string;
  files?: MessageFile[];
  isStreaming?: boolean;
  error?: string;
  structuredContent?: any;
}

export interface MessageFile {
  name: string;
  type: string;
  url: string;
  size: number;
}

export interface ChatResponse {
  chat: {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    userId: string;
    messageCount: number;
    lastMessage: any;
  };
  messages: Message[];
  hasMoreMessages: boolean;
}

export interface ChatWindowProps {
  chatId?: string;
  className?: string;
}

export interface SuggestionTileData {
  id: number;
  title: string;
  description: string;
}
