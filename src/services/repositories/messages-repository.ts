// services/repositories/messages-repository.ts
// Repository for chat messages management

import { db } from '../db';
import { CachedRepository } from './base-repository';
import type { CachedMessage } from '@/types/db';
import type { Message } from '@/types/chat';
import { getCacheTimes } from '../cache-config';
import { CACHE_LIMITS } from '../cache-config';

/**
 * Messages Repository
 * Manages chat message caching, pagination, and synchronization
 */
class MessagesRepository extends CachedRepository<CachedMessage, 'id'> {
  protected table = db.messages;
  protected tableName = 'MessagesRepository';

  /**
   * Get messages by chat ID
   */
  async getByChatId(
    chatId: string,
    options?: {
      limit?: number;
      offset?: number;
      orderDirection?: 'asc' | 'desc';
    }
  ): Promise<CachedMessage[]> {
    try {
      const { limit, offset = 0, orderDirection = 'asc' } = options || {};

      let collection = this.table
        .where('chatId')
        .equals(chatId)
        .sortBy('timestamp');

      const results = await collection;

      if (orderDirection === 'desc') {
        results.reverse();
      }

      if (limit) {
        return results.slice(offset, offset + limit);
      }

      return results.slice(offset);
    } catch (error) {
      console.error('[MessagesRepository] Error getting messages by chat ID:', error);
      return [];
    }
  }

  /**
   * Get messages count for a chat
   */
  async getCountByChatId(chatId: string): Promise<number> {
    try {
      return await this.table
        .where('chatId')
        .equals(chatId)
        .count();
    } catch (error) {
      console.error('[MessagesRepository] Error getting message count:', error);
      return 0;
    }
  }

  /**
   * Get latest message for a chat
   */
  async getLatestMessage(chatId: string): Promise<CachedMessage | undefined> {
    try {
      const messages = await this.table
        .where('chatId')
        .equals(chatId)
        .reverse()
        .sortBy('timestamp');

      return messages[0];
    } catch (error) {
      console.error('[MessagesRepository] Error getting latest message:', error);
      return undefined;
    }
  }

  /**
   * Cache a message from backend or local creation
   */
  async cacheMessage(messageData: {
    id: string;
    message: string;
    sender: 'user' | 'bot';
    timestamp: string;
    chatId: string;
    files?: any[];
    structuredContent?: any;
    widgets?: any[];
    contentBlocks?: any[];
    error?: string;
    status?: string;
    metadata?: any;
  }): Promise<string> {
    try {
      // Check if message already exists
      const existing = await this.get(messageData.id);
      
      const times = getCacheTimes('chatMessages');
      
      const cachedMessage: CachedMessage = {
        id: messageData.id,
        message: messageData.message,
        sender: messageData.sender,
        timestamp: messageData.timestamp,
        chatId: messageData.chatId,
        files: messageData.files,
        structuredContent: messageData.structuredContent,
        widgets: messageData.widgets,
        contentBlocks: messageData.contentBlocks,
        error: messageData.error,
        status: messageData.status || 'sent',
        metadata: messageData.metadata || {},
        ...times,
        syncedAt: existing?.syncedAt || Date.now(),
        isDirty: existing?.isDirty || false,
        localOnly: existing?.localOnly || false,
        sendAttempts: existing?.sendAttempts || 0,
      };

      await this.put(cachedMessage);
      
      // Clean up old messages if needed
      await this.cleanupOldMessagesForChat(messageData.chatId);
      
      console.log('[MessagesRepository] Cached message:', messageData.id);
      return messageData.id;
    } catch (error) {
      console.error('[MessagesRepository] Error caching message:', error);
      throw error;
    }
  }

  /**
   * Cache multiple messages
   */
  async cacheMessages(messages: Array<{
    id: string;
    message: string;
    sender: 'user' | 'bot';
    timestamp: string;
    chatId: string;
    files?: any[];
    structuredContent?: any;
    widgets?: any[];
    contentBlocks?: any[];
    error?: string;
    status?: string;
    metadata?: any;
  }>): Promise<string[]> {
    try {
      const ids: string[] = [];
      
      for (const message of messages) {
        const id = await this.cacheMessage(message);
        ids.push(id);
      }
      
      console.log(`[MessagesRepository] Cached ${messages.length} messages`);
      return ids;
    } catch (error) {
      console.error('[MessagesRepository] Error caching multiple messages:', error);
      throw error;
    }
  }

  /**
   * Add a local-only message (not yet sent to backend)
   */
  async addLocalMessage(message: Message, chatId: string): Promise<string> {
    try {
      const times = getCacheTimes('chatMessages');
      
      const cachedMessage: CachedMessage = {
        id: message.id,
        message: message.message,
        sender: message.sender,
        timestamp: message.timestamp || new Date().toISOString(),
        chatId,
        files: message.files,
        structuredContent: message.structuredContent,
        widgets: message.widgets,
        contentBlocks: message.contentBlocks,
        error: message.error,
        status: 'pending',
        metadata: {},
        ...times,
        syncedAt: 0,
        isDirty: true,
        localOnly: true,
        sendAttempts: 0,
      };

      await this.put(cachedMessage);
      
      console.log('[MessagesRepository] Added local message:', message.id);
      return message.id;
    } catch (error) {
      console.error('[MessagesRepository] Error adding local message:', error);
      throw error;
    }
  }

  /**
   * Update message content (for streaming)
   */
  async updateMessageContent(
    messageId: string,
    updates: {
      message?: string;
      structuredContent?: any;
      widgets?: any[];
      contentBlocks?: any[];
      error?: string;
    }
  ): Promise<void> {
    try {
      await this.update(messageId, updates as Partial<CachedMessage>);
    } catch (error) {
      console.error('[MessagesRepository] Error updating message content:', error);
      throw error;
    }
  }

  /**
   * Mark message as synced with backend
   */
  async markAsSynced(messageId: string): Promise<void> {
    try {
      await this.update(messageId, {
        isDirty: false,
        localOnly: false,
        syncedAt: Date.now(),
        status: 'sent',
      } as Partial<CachedMessage>);

      console.log(`[MessagesRepository] Marked message ${messageId} as synced`);
    } catch (error) {
      console.error('[MessagesRepository] Error marking message as synced:', error);
      throw error;
    }
  }

  /**
   * Increment send attempts for failed message
   */
  async incrementSendAttempts(messageId: string): Promise<number> {
    try {
      const message = await this.get(messageId);
      
      if (!message) {
        throw new Error('Message not found');
      }

      const newAttempts = message.sendAttempts + 1;
      
      await this.update(messageId, {
        sendAttempts: newAttempts,
      } as Partial<CachedMessage>);

      return newAttempts;
    } catch (error) {
      console.error('[MessagesRepository] Error incrementing send attempts:', error);
      throw error;
    }
  }

  /**
   * Get local-only messages (not yet sent)
   */
  async getLocalOnlyMessages(chatId?: string): Promise<CachedMessage[]> {
    try {
      if (chatId) {
        return await this.table
          .where('[chatId+localOnly]')
          .equals([chatId, true])
          .toArray();
      }
      
      return await this.table
        .where('localOnly')
        .equals(true)
        .toArray();
    } catch (error) {
      console.error('[MessagesRepository] Error getting local-only messages:', error);
      return [];
    }
  }

  /**
   * Get messages that need syncing
   */
  async getDirtyMessages(chatId?: string): Promise<CachedMessage[]> {
    try {
      if (chatId) {
        return await this.table
          .where('[chatId+isDirty]')
          .equals([chatId, true])
          .toArray();
      }
      
      return await this.table
        .where('isDirty')
        .equals(true)
        .toArray();
    } catch (error) {
      console.error('[MessagesRepository] Error getting dirty messages:', error);
      return [];
    }
  }

  /**
   * Delete messages for a chat
   */
  async deleteByChatId(chatId: string): Promise<number> {
    try {
      const deleted = await this.table
        .where('chatId')
        .equals(chatId)
        .delete();

      console.log(`[MessagesRepository] Deleted ${deleted} messages for chat ${chatId}`);
      return deleted;
    } catch (error) {
      console.error('[MessagesRepository] Error deleting messages by chat ID:', error);
      return 0;
    }
  }

  /**
   * Clean up old messages for a chat (keep only last N messages)
   */
  async cleanupOldMessagesForChat(chatId: string): Promise<number> {
    try {
      const messages = await this.getByChatId(chatId, {
        orderDirection: 'desc',
      });

      const maxMessages = CACHE_LIMITS.maxMessagesPerChat;
      
      if (messages.length <= maxMessages) {
        return 0;
      }

      // Keep the latest messages, delete the rest
      const messagesToDelete = messages.slice(maxMessages);
      const idsToDelete = messagesToDelete.map(m => m.id);
      
      await this.deleteMany(idsToDelete);
      
      console.log(`[MessagesRepository] Cleaned up ${idsToDelete.length} old messages for chat ${chatId}`);
      return idsToDelete.length;
    } catch (error) {
      console.error('[MessagesRepository] Error cleaning up old messages:', error);
      return 0;
    }
  }

  /**
   * Convert CachedMessage to UI Message type
   */
  toUIMessageType(cached: CachedMessage): Message {
    return {
      id: cached.id,
      message: cached.message,
      sender: cached.sender === 'bot' ? 'bot' : 'user',
      timestamp: cached.timestamp,
      files: cached.files,
      structuredContent: cached.structuredContent,
      widgets: cached.widgets,
      contentBlocks: cached.contentBlocks,
      error: cached.error,
      // Streaming fields are NOT included (UI-only state)
    };
  }

  /**
   * Convert multiple CachedMessages to UI Message types
   */
  toUIMessageTypes(cached: CachedMessage[]): Message[] {
    return cached.map(message => this.toUIMessageType(message));
  }

  /**
   * Get message statistics for a chat
   */
  async getChatStats(chatId: string): Promise<{
    totalMessages: number;
    userMessages: number;
    botMessages: number;
    localOnlyMessages: number;
    dirtyMessages: number;
  }> {
    try {
      const messages = await this.getByChatId(chatId);

      return {
        totalMessages: messages.length,
        userMessages: messages.filter(m => m.sender === 'user').length,
        botMessages: messages.filter(m => m.sender === 'bot').length,
        localOnlyMessages: messages.filter(m => m.localOnly).length,
        dirtyMessages: messages.filter(m => m.isDirty).length,
      };
    } catch (error) {
      console.error('[MessagesRepository] Error getting chat stats:', error);
      return {
        totalMessages: 0,
        userMessages: 0,
        botMessages: 0,
        localOnlyMessages: 0,
        dirtyMessages: 0,
      };
    }
  }
}

// Export singleton instance
export const messagesRepository = new MessagesRepository();

