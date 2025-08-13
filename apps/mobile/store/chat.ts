import { create } from 'zustand';
import { Message, MessageFile } from '@wealthwise/types';

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
interface PendingMessage {
  text: string;
  files: MessageFile[];
  chatId: string;
}

interface ChatStore {
  pendingMessage: PendingMessage | null;
  setPendingMessage: (text: string, files: MessageFile[], chatId: string) => void;
  clearPendingMessage: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  pendingMessage: null,
  setPendingMessage: (text, files, chatId) =>
    set({ pendingMessage: { text, files, chatId } }),
  clearPendingMessage: () => set({ pendingMessage: null }),
}));
