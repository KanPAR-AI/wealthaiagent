// store/chat.ts

import { create } from 'zustand';
import { Message, MessageFile } from '@/types'; // Import from local types

// --- Chat State Management ---
interface ChatState {
  chats: Record<string, { messages: Message[] }>;
  // pendingMessage now correctly includes MessageFile[] and useMockService flag
  pendingMessage: { chatId: string; text: string; files: MessageFile[]; useMockService?: boolean } | null;

  // Agent selection (null = auto/smart routing)
  selectedAgent: string | null;
  setSelectedAgent: (agentId: string | null) => void;

  // Message management
  addMessage: (chatId: string, message: Message) => void;
  updateMessage: (chatId: string, messageId: string, updates: Partial<Message>) => void;
  clearChat: (chatId: string) => void;
  getMessages: (chatId: string) => Message[];

  // Pending message management for new chats
  setPendingMessage: (text: string, files: MessageFile[], targetChatId: string, useMockService?: boolean) => void;
  getPendingMessage: (chatId: string) => { text: string; files: MessageFile[]; useMockService?: boolean } | null;
  clearPendingMessage: () => void;
}

// Create the Zustand store
export const useChatStore = create<ChatState>((set, get) => ({
  chats: {},
  pendingMessage: null,
  selectedAgent: null,
  setSelectedAgent: (agentId) => set({ selectedAgent: agentId }),

  // Add a message to a specific chat
  addMessage: (chatId, message) => {
    console.log('[Store] addMessage called:', {
      chatId,
      messageId: message.id,
      sender: message.sender,
      isStreaming: message.isStreaming
    });
    set((state) => {
      const currentMessages = state.chats[chatId]?.messages || [];
      console.log('[Store] Current message count before add:', currentMessages.length);
      const newMessages = [...currentMessages, message];
      // Sort by timestamp to ensure correct order regardless of insertion order
      newMessages.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
      console.log('[Store] New message count after add:', newMessages.length);

      return {
        chats: {
          ...state.chats,
          [chatId]: {
            messages: newMessages,
          },
        },
      };
    });
  },

  // Update a specific message in a chat
  updateMessage: (chatId, messageId, updates) => {
    console.log('[Store] updateMessage called:', { 
      chatId, 
      messageId, 
      updates: {
        ...updates,
        streamingContent: updates.streamingContent?.substring(0, 50) + '...' || 'N/A'
      }
    });
    set((state) => {
      const messages = state.chats[chatId]?.messages || [];
      const foundMessage = messages.find(m => m.id === messageId);
      console.log('[Store] Message found in store:', !!foundMessage);
      if (foundMessage) {
        console.log('[Store] Current message length:', foundMessage.message?.length || 0);
        console.log('[Store] New message length:', updates.message?.length || 0);
      }
      
      const updatedMessages = messages.map(msg =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      );
      
      console.log('[Store] Messages array reference changed:', updatedMessages !== messages);
      console.log('[Store] Updated messages count:', updatedMessages.length);
      
      return {
        chats: {
          ...state.chats,
          [chatId]: {
            messages: updatedMessages,
          },
        },
      };
    });
  },

  // Clear all messages from a specific chat
  clearChat: (chatId) => {
    console.log('[Store] clearChat called for chatId:', chatId);
    console.trace('[Store] clearChat stack trace');
    set((state) => ({
      chats: {
        ...state.chats,
        [chatId]: { messages: [] }, // Ensure messages array is empty
      },
    }));
  },

  // Get messages for a specific chat
  getMessages: (chatId) => {
    const state = get();
    return state.chats[chatId]?.messages || []; // Access messages property
  },

  // Set a pending message for a new chat
  setPendingMessage: (text, files, targetChatId, useMockService) => {
    console.log('[Store] setPendingMessage called:', { 
      chatId: targetChatId, 
      text: text.substring(0, 50), 
      fileCount: files.length,
      useMockService 
    });
    set({
      pendingMessage: { chatId: targetChatId, text, files, useMockService },
    });
    console.log('[Store] Pending message set in store');
  },

  // Get the pending message for a given chat ID
  getPendingMessage: (chatId) => {
    const state = get();
    if (state.pendingMessage?.chatId === chatId) {
      return {
        text: state.pendingMessage.text,
        files: state.pendingMessage.files,
      };
    }
    return null;
  },

  // Clear any pending message
  clearPendingMessage: () => {
    console.log('[Store] clearPendingMessage called');
    set({ pendingMessage: null });
  },
}));
