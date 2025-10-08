import { useEffect, useRef } from 'react';
import { Message, MessageFile } from '@/types';
import { fetchChatHistory } from '@/services/chat-service';
import { useChatStore } from '@/store/chat';

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
  
        // Only clear messages if we have loaded messages (existing chat)
        // Don't clear if it's a new chat with no history yet
        if (loadedMessages.length > 0) {
          setIsHistoryLoading(true);
          clearMessages();
  
          // Add loaded messages one by one (preserving order)
          loadedMessages.forEach((m) => addMessage(m));
          
          // Mark this chat as loaded
          loadedChatsRef.current.add(chatId);
          console.log("[useChatHistory] History loaded successfully, marked chat as loaded");
        } else {
          console.log("[useChatHistory] No messages in history, skipping");
          // Still mark as loaded to prevent trying again
          loadedChatsRef.current.add(chatId);
        }
        setIsHistoryLoading(false);
      } catch (err) {
        console.error('Failed to load chat history:', err);
        setIsHistoryLoading(false);
      }
    };
  
    loadChatHistory();
  }, [chatId, token, clearMessages, addMessage, isProcessingPendingMessage, setIsHistoryLoading, getStoreMessageCount, currentMessageCount]);
}