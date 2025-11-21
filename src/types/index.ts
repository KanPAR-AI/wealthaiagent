// Re-export types from chat.ts for backward compatibility
export * from './chat';
export * from './trade';

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
  messages: any[];
  hasMoreMessages: boolean;
}