import { create } from 'zustand';
import { Message, MessageFile } from '@/types/chat';

// Define the ChatState interface for Zustand
interface ChatState {
  chats: Record<string, Message[]>;
  pendingMessage: { chatId: string; text: string; files: MessageFile[] } | null;
  
  // Message management
  addMessage: (chatId: string, message: Message) => void;
  updateMessage: (chatId: string, messageId: string, updates: Partial<Message>) => void;
  clearChat: (chatId: string) => void;
  getMessages: (chatId: string) => Message[];
  
  // Pending message management for new chats
  setPendingMessage: (text: string, files: MessageFile[], targetChatId: string) => void;
  getPendingMessage: (chatId: string) => { text: string; files: MessageFile[] } | null;
  clearPendingMessage: () => void;
}

// Create the Zustand store
export const useChatStore = create<ChatState>((set, get) => ({
  chats: {},
  pendingMessage: null,
  
  addMessage: (chatId, message) =>
    set((state) => ({
      chats: {
        ...state.chats,
        [chatId]: [...(state.chats[chatId] || []), message],
      },
    })),
    
  updateMessage: (chatId, messageId, updates) =>
    set((state) => ({
      chats: {
        ...state.chats,
        [chatId]: (state.chats[chatId] || []).map(msg => 
          msg.id === messageId ? { ...msg, ...updates } : msg
        ),
      },
    })),
    
  clearChat: (chatId) =>
    set((state) => ({
      chats: {
        ...state.chats,
        [chatId]: [],
      },
    })),
    
  getMessages: (chatId) => {
    const state = get();
    return state.chats[chatId] || [];
  },
  
  setPendingMessage: (text, files, targetChatId) =>
    set({
      pendingMessage: { chatId: targetChatId, text, files }
    }),
    
  getPendingMessage: (chatId) => {
    const state = get();
    if (state.pendingMessage?.chatId === chatId) {
      return {
        text: state.pendingMessage.text,
        files: state.pendingMessage.files
      };
    }
    return null;
  },
  
  clearPendingMessage: () =>
    set({ pendingMessage: null }),
}));