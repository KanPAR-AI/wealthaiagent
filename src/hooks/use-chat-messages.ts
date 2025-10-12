// hooks/use-chat-messages.ts
import { useChatStore } from '@/store/chat';
import { Message } from '@/types';
import { useCallback, useRef, useEffect } from 'react';
import { messagesRepository } from '@/services/repositories';

/**
 * A hook to manage messages for a specific chat ID,
 * interacting with the central Zustand chat store AND IndexedDB cache.
 */
export const useChatMessages = (chatId: string) => {
  // Use a ref to cache the empty array to prevent infinite loops
  const emptyArrayRef = useRef<Message[]>([]);
  
  // Use a stable selector to avoid the getSnapshot warning
  const selector = useCallback(
    (state: any) => {
      const messages = state.chats[chatId]?.messages;
      // Return the same empty array reference if messages don't exist
      return messages || emptyArrayRef.current;
    },
    [chatId]
  );
  
  const messages = useChatStore(selector);
  
  // Debug logging for message updates
  console.log('[useChatMessages] Current messages for chat', chatId, ':', messages.length, 'messages');
  
  const addMessageToStore = useChatStore(state => state.addMessage);
  const updateMessageInStore = useChatStore(state => state.updateMessage);
  const clearChatInStore = useChatStore(state => state.clearChat);

  /**
   * Adds a new message to the chat.
   * Also caches it to IndexedDB in the background.
   * @param message The message object to add.
   */
  const addMessage = useCallback((message: Message) => {
    if (chatId) {
      // Add to Zustand store (immediate UI update)
      addMessageToStore(chatId, message);
      
      // Cache to IndexedDB in background (don't await, non-blocking)
      messagesRepository.cacheMessage({
        id: message.id,
        message: message.message,
        sender: message.sender === 'bot' ? 'bot' : 'user',
        timestamp: message.timestamp || new Date().toISOString(),
        chatId: chatId,
        files: message.files,
        structuredContent: message.structuredContent,
        widgets: message.widgets,
        contentBlocks: message.contentBlocks,
        error: message.error,
        status: 'sent',
        metadata: {},
      }).catch(error => {
        console.error('[useChatMessages] Failed to cache message to IndexedDB:', error);
      });
    } else {
      console.warn("Attempted to add message without a valid chatId.");
    }
  }, [chatId, addMessageToStore]);

  /**
   * Updates an existing message in the chat by its ID.
   * Also updates it in IndexedDB cache.
   * @param messageId The ID of the message to update.
   * @param updates A partial Message object containing the properties to update.
   */
  const updateMessage = useCallback((messageId: string, updates: Partial<Message>) => {
    if (chatId) {
      // Update in Zustand store (immediate UI update)
      updateMessageInStore(chatId, messageId, updates);
      
      // Update in IndexedDB in background (don't await, non-blocking)
      messagesRepository.updateMessageContent(messageId, {
        message: updates.message,
        structuredContent: updates.structuredContent,
        widgets: updates.widgets,
        contentBlocks: updates.contentBlocks,
        error: updates.error,
      }).catch(error => {
        console.error('[useChatMessages] Failed to update message in IndexedDB:', error);
      });
    } else {
      console.warn("Attempted to update message without a valid chatId.");
    }
  }, [chatId, updateMessageInStore]);

  /**
   * Clears all messages for the current chat.
   * Also clears them from IndexedDB cache.
   */
  const clearMessages = useCallback(() => {
    if (chatId) {
      // Clear from Zustand store (immediate UI update)
      clearChatInStore(chatId);
      
      // Clear from IndexedDB in background (don't await, non-blocking)
      messagesRepository.deleteByChatId(chatId).catch(error => {
        console.error('[useChatMessages] Failed to clear messages from IndexedDB:', error);
      });
    } else {
      console.warn("Attempted to clear messages without a valid chatId.");
    }
  }, [chatId, clearChatInStore]);

  // Sync messages count to console for debugging
  useEffect(() => {
    if (chatId && messages.length > 0) {
      console.log(`[useChatMessages] Chat ${chatId} has ${messages.length} messages in memory`);
      
      // Also log IndexedDB count for comparison (don't await, just log)
      messagesRepository.getCountByChatId(chatId).then(count => {
        console.log(`[useChatMessages] Chat ${chatId} has ${count} messages in IndexedDB`);
      });
    }
  }, [chatId, messages.length]);

  return { messages, addMessage, updateMessage, clearMessages };
};