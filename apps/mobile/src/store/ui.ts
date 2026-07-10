// Mobile UI state — which conversation the chat screen is showing.
// Lives in a tiny zustand store (not screen state) so the history screen
// can select a chat and the chat screen reacts, without param-passing
// gymnastics through the router.

import { create } from 'zustand';

interface UiState {
  currentChatId: string | null;
  setCurrentChatId: (id: string | null) => void;
  /** Start a fresh conversation (ChatGPT's pencil button). */
  newChat: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  currentChatId: null,
  setCurrentChatId: (id) => set({ currentChatId: id }),
  newChat: () => set({ currentChatId: null }),
}));
