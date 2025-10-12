import { useEffect, useRef } from 'react';
import { Message, MessageFile } from '@/types';
import { fetchChatHistory } from '@/services/chat-service';
import { useChatStore } from '@/store/chat';
import { messagesRepository } from '@/services/repositories';
import { isFresh, isStale } from '@/utils/staleness-checker';

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
        newlyCreated: newlyCreatedChatsRef.current.has(chatId)
      });
      
      // Don't load history if we already have messages (from pending message or previous load)
      if (storeMessageCount > 0) {
        console.log("[useChatHistory] Skipping - already have", storeMessageCount, "messages in store");
        // Mark as loaded so we don't try again
        loadedChatsRef.current.add(chatId);
        return;
      }
      
      // Don't reload history for a chat we've already loaded
      if (loadedChatsRef.current.has(chatId)) {
        console.log("[useChatHistory] Skipping - history already loaded for chatId:", chatId);
        return;
      }
      
      console.log("[useChatHistory] Starting to load chat history for chatId:", chatId);
  
      try {
        // First, try to load from IndexedDB cache
        const cachedMessages = await messagesRepository.getByChatId(chatId, {
          orderDirection: 'asc',
        });
        
        console.log(`[useChatHistory] Found ${cachedMessages.length} messages in IndexedDB cache`);
        
        // Check if cached messages are fresh
        const hasCachedMessages = cachedMessages.length > 0;
        const allFresh = hasCachedMessages && cachedMessages.every(msg => isFresh(msg));
        const anyStale = hasCachedMessages && cachedMessages.some(msg => isStale(msg));
        
        if (hasCachedMessages && allFresh) {
          // Use cached messages immediately (instant load!)
          console.log("[useChatHistory] Using fresh cached messages from IndexedDB");
          setIsHistoryLoading(true);
          clearMessages();
          
          // Convert to UI format and add to store
          const uiMessages = messagesRepository.toUIMessageTypes(cachedMessages);
          uiMessages.forEach((m) => addMessage(m));
          
          loadedChatsRef.current.add(chatId);
          setIsHistoryLoading(false);
          return; // Don't fetch from backend
        }
        
        if (hasCachedMessages && anyStale) {
          // Use cached messages but refetch in background
          console.log("[useChatHistory] Using stale cached messages, will refetch in background");
          setIsHistoryLoading(true);
          clearMessages();
          
          // Show cached messages immediately
          const uiMessages = messagesRepository.toUIMessageTypes(cachedMessages);
          uiMessages.forEach((m) => addMessage(m));
          
          setIsHistoryLoading(false);
          // Continue to fetch from backend below to update cache
        }
        
        // Fetch from backend (cache miss or stale data)
        console.log("[useChatHistory] Fetching chat history from backend");
        const chatResponse = await fetchChatHistory(token, chatId);
  
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

          return {
            id: msg.id,
            message: msg.content,
            sender: msg.sender === 'assistant' ? 'bot' : 'user',
            timestamp: msg.timestamp,
            files: files.length > 0 ? files : undefined,
            // For history messages, streaming is complete
            isStreaming: false,
            streamingContent: msg.content,
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