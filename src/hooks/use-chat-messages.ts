// hooks/use-chat-messages.ts
import { useChatStore } from '@/store/chat';
import { Message } from '@/types';
import { useCallback, useRef } from 'react';

/**
 * A hook to manage messages for a specific chat ID,
 * interacting with the central Zustand chat store.
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
   * @param message The message object to add.
   */
  const addMessage = useCallback((message: Message) => {
    if (chatId) {
      addMessageToStore(chatId, message);
    } else {
      console.warn("Attempted to add message without a valid chatId.");
    }
    // No explicit cleanup return needed for simple add
  }, [chatId, addMessageToStore]);

  /**
   * Updates an existing message in the chat by its ID.
   * Useful for appending streaming content or updating status.
   * @param messageId The ID of the message to update.
   * @param updates A partial Message object containing the properties to update.
   */
  const updateMessage = useCallback((messageId: string, updates: Partial<Message>) => {
    if (chatId) {
      updateMessageInStore(chatId, messageId, updates);
    } else {
      console.warn("Attempted to update message without a valid chatId.");
    }
  }, [chatId, updateMessageInStore]);

  /**
   * Clears all messages for the current chat.
   */
  const clearMessages = useCallback(() => {
    if (chatId) {
      clearChatInStore(chatId);
    } else {
      console.warn("Attempted to clear messages without a valid chatId.");
    }
  }, [chatId, clearChatInStore]);

  // You might want an effect here if you need to load initial messages
  // from an API when the chatId changes and they are not in the store.
  // For this setup, `useChatSession` or `ChatWindow` handles initial loading.
  // This hook primarily provides an interface to manipulate messages in the store.

  return { messages, addMessage, updateMessage, clearMessages };
};