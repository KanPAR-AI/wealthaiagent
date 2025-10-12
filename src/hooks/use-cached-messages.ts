// hooks/use-cached-messages.ts
// Hook for managing cached messages with IndexedDB

import { useState, useEffect, useCallback } from 'react';
import { messagesRepository } from '@/services/repositories';
import { Message } from '@/types/chat';
import { isFresh, isStale } from '@/utils/staleness-checker';

interface UseCachedMessagesOptions {
  limit?: number;
  enableBackgroundSync?: boolean;
  onStaleData?: () => void;
}

interface UseCachedMessagesResult {
  messages: Message[];
  isLoading: boolean;
  isStale: boolean;
  hasMore: boolean;
  error: Error | null;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
  addMessage: (message: Message) => Promise<void>;
  updateMessage: (messageId: string, updates: Partial<Message>) => Promise<void>;
  clearMessages: () => Promise<void>;
}

/**
 * Hook for managing cached messages with background sync
 */
export function useCachedMessages(
  chatId: string | null,
  options: UseCachedMessagesOptions = {}
): UseCachedMessagesResult {
  const {
    limit = 50,
    enableBackgroundSync = true,
    onStaleData,
  } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [offset, setOffset] = useState(0);

  /**
   * Load messages from cache
   */
  const loadMessagesFromCache = useCallback(async (resetOffset: boolean = false) => {
    if (!chatId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const currentOffset = resetOffset ? 0 : offset;

      // Get messages from cache
      const cachedMessages = await messagesRepository.getByChatId(chatId, {
        limit: limit,
        offset: currentOffset,
        orderDirection: 'asc',
      });

      // Convert to UI message format
      const uiMessages = messagesRepository.toUIMessageTypes(cachedMessages);

      // Check for staleness
      if (cachedMessages.length > 0) {
        const allFresh = cachedMessages.every(msg => isFresh(msg));
        const anyStale = cachedMessages.some(msg => isStale(msg));

        setIsStale(anyStale);

        if (anyStale && enableBackgroundSync && onStaleData) {
          onStaleData();
        }
      }

      // Update messages
      if (resetOffset) {
        setMessages(uiMessages);
        setOffset(limit);
      } else {
        setMessages(prev => [...prev, ...uiMessages]);
        setOffset(prev => prev + limit);
      }

      // Check if there are more messages
      const totalCount = await messagesRepository.getCountByChatId(chatId);
      setHasMore(currentOffset + limit < totalCount);

      setIsLoading(false);
    } catch (err) {
      console.error('[useCachedMessages] Error loading messages:', err);
      setError(err as Error);
      setIsLoading(false);
    }
  }, [chatId, limit, offset, enableBackgroundSync, onStaleData]);

  /**
   * Load more messages (pagination)
   */
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) {
      return;
    }

    await loadMessagesFromCache(false);
  }, [isLoading, hasMore, loadMessagesFromCache]);

  /**
   * Refetch messages (reload from start)
   */
  const refetch = useCallback(async () => {
    setOffset(0);
    await loadMessagesFromCache(true);
  }, [loadMessagesFromCache]);

  /**
   * Add a new message
   */
  const addMessage = useCallback(async (message: Message) => {
    if (!chatId) return;

    try {
      // Cache the message
      await messagesRepository.addLocalMessage(message, chatId);

      // Update local state immediately (optimistic)
      setMessages(prev => [...prev, message]);
    } catch (err) {
      console.error('[useCachedMessages] Error adding message:', err);
      setError(err as Error);
    }
  }, [chatId]);

  /**
   * Update an existing message
   */
  const updateMessage = useCallback(async (messageId: string, updates: Partial<Message>) => {
    try {
      // Update in cache
      await messagesRepository.updateMessageContent(messageId, updates);

      // Update local state
      setMessages(prev =>
        prev.map(msg => msg.id === messageId ? { ...msg, ...updates } : msg)
      );
    } catch (err) {
      console.error('[useCachedMessages] Error updating message:', err);
      setError(err as Error);
    }
  }, []);

  /**
   * Clear all messages for the chat
   */
  const clearMessages = useCallback(async () => {
    if (!chatId) return;

    try {
      // Clear from cache
      await messagesRepository.deleteByChatId(chatId);

      // Clear local state
      setMessages([]);
      setOffset(0);
      setHasMore(false);
    } catch (err) {
      console.error('[useCachedMessages] Error clearing messages:', err);
      setError(err as Error);
    }
  }, [chatId]);

  // Initial load
  useEffect(() => {
    setOffset(0);
    loadMessagesFromCache(true);
  }, [chatId]); // Only depend on chatId to avoid infinite loops

  return {
    messages,
    isLoading,
    isStale,
    hasMore,
    error,
    loadMore,
    refetch,
    addMessage,
    updateMessage,
    clearMessages,
  };
}

