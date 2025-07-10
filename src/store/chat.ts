// store/chat.ts

import { create } from 'zustand';
import { Message, MessageFile } from '@/types/chat'; // Import MessageFile

// --- Auth State Management ---
interface AuthState {
  token: string | null;
  tokenError: string | null;
  isLoadingToken: boolean;
  setToken: (token: string | null) => void;
  setTokenError: (error: string | null) => void;
  setIsLoadingToken: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  tokenError: null,
  isLoadingToken: true, // Initially true until the first token fetch
  setToken: (token) => set({ token, tokenError: null, isLoadingToken: false }),
  setTokenError: (error) => set({ tokenError: error, token: null, isLoadingToken: false }),
  setIsLoadingToken: (loading) => set({ isLoadingToken: loading }),
}));

// --- Chat State Management ---
interface ChatState {
  chats: Record<string, { messages: Message[] }>;
  // pendingMessage now correctly includes MessageFile[]
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

  // Add a message to a specific chat
  addMessage: (chatId, message) =>
    set((state) => ({
      chats: {
        ...state.chats,
        [chatId]: {
          messages: [...(state.chats[chatId]?.messages || []), message], // Ensure messages array exists
        },
      },
    })),

  // Update a specific message in a chat
  updateMessage: (chatId, messageId, updates) =>
    set((state) => ({
      chats: {
        ...state.chats,
        [chatId]: {
          messages: (state.chats[chatId]?.messages || []).map(msg => // Ensure messages array exists
            msg.id === messageId ? { ...msg, ...updates } : msg
          ),
        },
      },
    })),

  // Clear all messages from a specific chat
  clearChat: (chatId) =>
    set((state) => ({
      chats: {
        ...state.chats,
        [chatId]: { messages: [] }, // Ensure messages array is empty
      },
    })),

  // Get messages for a specific chat
  getMessages: (chatId) => {
    const state = get();
    return state.chats[chatId]?.messages || []; // Access messages property
  },

  // Set a pending message for a new chat
  setPendingMessage: (text, files, targetChatId) =>
    set({
      pendingMessage: { chatId: targetChatId, text, files },
    }),

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
  clearPendingMessage: () => set({ pendingMessage: null }),
}));
