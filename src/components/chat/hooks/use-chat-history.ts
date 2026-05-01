import { useEffect, useRef } from 'react';
import { Message, MessageFile } from '@/types';
import { fetchChatHistory } from '@/services/chat-service';
import { useChatStore } from '@/store/chat';
import { messagesRepository } from '@/services/repositories';
import { isFresh, isStale } from '@/utils/staleness-checker';

/**
 * Scrub bot messages that were left mid-stream by a prior mount.
 *
 * When the chat window unmounts during a streaming response (user navigated
 * away, hot-reload, etc.), the unmount cleanup aborts the SSE controller —
 * but the bot message in the global Zustand store still has
 * `isStreaming: true` and partial content. On a subsequent mount that
 * "stuck-forever spinner" is what the user perceived as a frozen UI.
 *
 * This runs once at the start of useChatHistory: any pre-existing bot
 * message in the store with `isStreaming=true` is finalized (streaming off,
 * error+Retry surfaced). Returns true if anything was scrubbed so the
 * caller can force a backend refetch (server may have a partial-save with
 * a more complete version).
 */
function scrubStaleStreamingMessages(chatId: string): boolean {
  const state = useChatStore.getState();
  const stored = state.chats[chatId]?.messages || [];
  let scrubbed = false;
  for (const m of stored) {
    if (m.sender === 'bot' && m.isStreaming) {
      state.updateMessage(chatId, m.id, {
        isStreaming: false,
        error: 'Response interrupted. Tap Retry to continue.',
      });
      scrubbed = true;
    }
  }
  if (scrubbed) {
    console.log('[useChatHistory] Scrubbed stale streaming bot message(s) on mount');
  }
  return scrubbed;
}

interface UseChatHistoryProps {
  chatId?: string;
  token: string | null;
  isProcessingPendingMessage: boolean;
  setIsHistoryLoading: (loading: boolean) => void;
  clearMessages: () => void;
  addMessage: (message: Message) => void;
  currentMessageCount: number; // Number of messages currently in the store
}

export function useChatHistory({
  chatId,
  token,
  isProcessingPendingMessage,
  setIsHistoryLoading,
  clearMessages,
  addMessage,
  currentMessageCount,
}: UseChatHistoryProps) {
  // Track which chats we've already loaded to prevent reloading
  const loadedChatsRef = useRef<Set<string>>(new Set());
  // Track newly created chats (don't load history for them)
  const newlyCreatedChatsRef = useRef<Set<string>>(new Set());
  
  // Get message count directly from store to avoid stale props
  const getStoreMessageCount = useChatStore(state => state.getMessages);
  
  // Listen for pending message processing to mark chat as newly created
  const pendingMessage = useChatStore(state => state.pendingMessage);
  useEffect(() => {
    if (pendingMessage && pendingMessage.chatId === chatId) {
      console.log("[useChatHistory] Marking chat as newly created (has pending message):", chatId);
      newlyCreatedChatsRef.current.add(chatId);
    }
  }, [pendingMessage, chatId]);
  
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!chatId || !token) return;

      // Mount-time recovery: any bot message left mid-stream by a prior
      // mount gets finalized + flagged for retry. Scrub-only — we keep the
      // local error/Retry state and don't refetch over it (refetching would
      // wipe the partial content the user already saw).
      const hadStaleStream = scrubStaleStreamingMessages(chatId);

      // Detect "user message without a bot reply" — last message in store is
      // a user message. This means a prior send errored before any chunks
      // arrived OR another device replied while we were offline. Either way
      // the server may have a reply we don't, so force a refetch. Safe
      // because there's no local bot state to overwrite.
      const storeForCheck = getStoreMessageCount(chatId);
      const lastMsg = storeForCheck[storeForCheck.length - 1];
      const trailingUserOrphan = lastMsg?.sender === 'user';

      if (trailingUserOrphan) {
        loadedChatsRef.current.delete(chatId);
      }

      // Don't load history for newly created chats
      if (newlyCreatedChatsRef.current.has(chatId)) {
        console.log("[useChatHistory] Skipping - chat is newly created");
        loadedChatsRef.current.add(chatId); // Mark as "loaded" so we don't try again
        setIsHistoryLoading(false); // Make sure loading state is false
        return;
      }

      // Don't load history if we're processing a pending message
      if (isProcessingPendingMessage) {
        console.log("[useChatHistory] Skipping chat history load - pending message being processed");
        setIsHistoryLoading(false); // Make sure loading state is false
        return;
      }

      // Check message count directly from store (more reliable than props)
      const storeMessages = getStoreMessageCount(chatId);
      const storeMessageCount = storeMessages.length;

      console.log("[useChatHistory] Checking conditions:", {
        chatId,
        currentMessageCount,
        storeMessageCount,
        alreadyLoaded: loadedChatsRef.current.has(chatId),
        newlyCreated: newlyCreatedChatsRef.current.has(chatId),
        hadStaleStream,
      });

      // Don't load history if we already have messages (from pending message
      // or previous load). EXCEPTION: trailing-user-orphan means local view
      // is incomplete, so fall through and refetch.
      if (storeMessageCount > 0 && !trailingUserOrphan) {
        console.log("[useChatHistory] Skipping - already have", storeMessageCount, "messages in store");
        loadedChatsRef.current.add(chatId);
        setIsHistoryLoading(false);
        return;
      }
      void hadStaleStream; // intentionally unused — scrub side-effect only

      // Don't reload history for a chat we've already loaded (but if we
      // scrubbed a stale stream just now, we deliberately invalidated this).
      if (loadedChatsRef.current.has(chatId)) {
        console.log("[useChatHistory] Skipping - history already loaded for chatId:", chatId);
        setIsHistoryLoading(false);
        return;
      }
      
      console.log("[useChatHistory] Starting to load chat history for chatId:", chatId);

      try {
        // Start backend fetch immediately (don't wait for IndexedDB)
        const backendPromise = fetchChatHistory(token, chatId);

        // Try IndexedDB cache in parallel
        let anyStale = false;
        try {
          const cachedMessages = await messagesRepository.getByChatId(chatId, {
            orderDirection: 'asc',
          });

          console.log(`[useChatHistory] Found ${cachedMessages.length} messages in IndexedDB cache`);

          const hasCachedMessages = cachedMessages.length > 0;
          const allFresh = hasCachedMessages && cachedMessages.every(msg => isFresh(msg));
          anyStale = hasCachedMessages && cachedMessages.some(msg => isStale(msg));

          if (hasCachedMessages && allFresh) {
            console.log("[useChatHistory] Using fresh cached messages from IndexedDB");
            clearMessages();
            const uiMessages = messagesRepository.toUIMessageTypes(cachedMessages);
            uiMessages.forEach((m) => addMessage(m));
            loadedChatsRef.current.add(chatId);
            setIsHistoryLoading(false);
            return; // Don't wait for backend
          }

          if (hasCachedMessages && anyStale) {
            console.log("[useChatHistory] Using stale cached messages, backend fetch in progress");
            clearMessages();
            const uiMessages = messagesRepository.toUIMessageTypes(cachedMessages);
            uiMessages.forEach((m) => addMessage(m));
            setIsHistoryLoading(false);
            // Continue to await backend below
          }
        } catch (cacheErr) {
          console.warn("[useChatHistory] IndexedDB cache failed, waiting for backend:", cacheErr);
        }

        // Await backend (already started above)
        console.log("[useChatHistory] Waiting for backend response");
        const chatResponse = await backendPromise;
  
        const loadedMessages: Message[] = chatResponse.messages.map((msg) => {
          const files: MessageFile[] = (msg.attachments || []).map((att: any) => {
            console.log('Processing attachment:', att);
            
            // Handle both string URLs and object attachments
            if (typeof att === 'string') {
              // Backend sends just URL strings
              const fileName = att.split('/').pop() || 'Unknown file';
              return {
                name: fileName,
                type: 'application/octet-stream', // Default type, will be detected by FileRenderer
                url: att,
                size: 0, // Unknown size
              };
            } else {
              // Backend sends attachment objects
              return {
                name: att.name || 'Unknown file',
                type: att.type || 'application/octet-stream',
                url: att.url,
                size: att.size || 0,
              };
            }
          });

          console.log('Loaded message with files:', { messageId: msg.id, fileCount: files.length, files });

          // Reconstruct contentBlocks from metadata.widgets_json (persisted during streaming)
          let contentBlocks: any[] | undefined;
          // Parse widgets from JSON string (avoids Firestore nesting limits)
          let widgets: any[] | undefined;
          if (msg.metadata?.widgets_json) {
            try {
              widgets = JSON.parse(msg.metadata.widgets_json);
            } catch (e) {
              console.warn('[useChatHistory] Failed to parse widgets_json:', e);
            }
          } else if (msg.metadata?.widgets) {
            // Backward compat: old messages may have nested widgets
            widgets = msg.metadata.widgets;
          }
          if (widgets && Array.isArray(widgets) && widgets.length > 0) {
            contentBlocks = [
              { type: 'text', content: msg.content },
              ...widgets.map((w: any) => ({ type: 'widget', widget: w })),
            ];
          }

          return {
            id: msg.id,
            message: msg.content,
            sender: msg.sender === 'assistant' ? 'bot' : 'user',
            timestamp: msg.timestamp,
            files: files.length > 0 ? files : undefined,
            // For history messages, streaming is complete
            isStreaming: false,
            streamingContent: msg.content,
            contentBlocks,
          };
        });
  
        // Only update UI if we didn't already show cached messages
        if (loadedMessages.length > 0 && !anyStale) {
          // We didn't have cached messages, so update UI now
          setIsHistoryLoading(true);
          clearMessages();
  
          // Add loaded messages one by one (preserving order)
          loadedMessages.forEach((m) => addMessage(m));
          
          setIsHistoryLoading(false);
        } else if (loadedMessages.length > 0 && anyStale) {
          // We already showed stale cache, now update with fresh data
          console.log("[useChatHistory] Updating UI with fresh messages from backend");
          clearMessages();
          loadedMessages.forEach((m) => addMessage(m));
        }
        
        // Mark this chat as loaded
        loadedChatsRef.current.add(chatId);
        console.log("[useChatHistory] History loaded successfully, marked chat as loaded");
        
        // Note: Messages are already cached to IndexedDB by addMessage() in useChatMessages hook
      } catch (err) {
        console.error('Failed to load chat history:', err);
        setIsHistoryLoading(false);
      }
    };
  
    loadChatHistory();
  }, [chatId, token, clearMessages, addMessage, isProcessingPendingMessage, setIsHistoryLoading, getStoreMessageCount, currentMessageCount]);
}