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

  // Wipe everything — called on sign-out / account switch so the next user
  // doesn't inherit the previous user's open chat, pending message, or
  // agent selection.
  reset: () => void;
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

      // Dedup by id — if a message with this id already exists, this is a no-op.
      // Without this, a new-chat optimistic add (nanoid) followed later by a
      // backend-history refetch (uuid) doubles the bubble; or a hot-reload that
      // re-runs an effect can re-add the same row.
      if (currentMessages.some((m) => m.id === message.id)) {
        console.log('[Store] Skipping duplicate message id:', message.id);
        return state;
      }

      // Dedup user messages by sender+content+files within a 60s window. The
      // optimistic-add user message uses a frontend nanoid while the backend
      // saves under a UUID — without this, a refetch path that adds the
      // backend row on top of the optimistic one renders the same bubble twice.
      // Bot messages are NOT deduped this way: legitimate retries/regenerates
      // can produce two bot bubbles with identical (often empty) content.
      if (message.sender === 'user') {
        const filesKey = (message.files || []).map((f) => f.url).sort().join('|');
        const newTs = Date.parse(message.timestamp || '') || Date.now();
        const dup = currentMessages.find((m) => {
          if (m.sender !== 'user') return false;
          if ((m.message || '') !== (message.message || '')) return false;
          const mFilesKey = (m.files || []).map((f) => f.url).sort().join('|');
          if (mFilesKey !== filesKey) return false;
          const mTs = Date.parse(m.timestamp || '') || 0;
          return Math.abs(newTs - mTs) < 60_000;
        });
        if (dup) {
          console.log('[Store] Skipping duplicate user message (content match):', {
            existingId: dup.id,
            incomingId: message.id,
          });
          return state;
        }
      }

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

  reset: () => {
    set({ chats: {}, pendingMessage: null, selectedAgent: null });
  },
}));
