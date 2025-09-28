// Local type definitions to replace @wealthwise/types

export interface Message {
  id: string;
  content: string;
  attachments: MessageFile[];
  chatId: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  status: string;
  metadata?: any;
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
