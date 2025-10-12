// services/repositories/chats-repository.ts
// Repository for chat sessions management

import { db } from '../db';
import { CachedRepository } from './base-repository';
import type { CachedChat } from '@/types/db';
import type { Chat } from '@/types/chat';
import { getCacheTimes } from '../cache-config';

/**
 * Chats Repository
 * Manages chat session caching and synchronization
 */
class ChatsRepository extends CachedRepository<CachedChat, 'id'> {
  protected table = db.chats;
  protected tableName = 'ChatsRepository';

  /**
   * Get chats by user ID
   */
  async getByUserId(userId: string): Promise<CachedChat[]> {
    try {
      return await this.table
        .where('userId')
        .equals(userId)
        .reverse()
        .sortBy('updatedAt');
    } catch (error) {
      console.error('[ChatsRepository] Error getting chats by user ID:', error);
      return [];
    }
  }

  /**
   * Get favorite chats by user ID
   */
  async getFavoritesByUserId(userId: string): Promise<CachedChat[]> {
    try {
      return await this.table
        .where('[userId+isFavorite]')
        .equals([userId, true])
        .reverse()
        .sortBy('updatedAt');
    } catch (error) {
      console.error('[ChatsRepository] Error getting favorite chats:', error);
      return [];
    }
  }

  /**
   * Get recent chats (sorted by updatedAt)
   */
  async getRecent(limit: number = 20): Promise<CachedChat[]> {
    try {
      return await this.table
        .orderBy('updatedAt')
        .reverse()
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error('[ChatsRepository] Error getting recent chats:', error);
      return [];
    }
  }

  /**
   * Cache a chat from backend response
   */
  async cacheChat(chatData: {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    userId: string;
    messageCount: number;
    lastMessage: any;
    isFavorite?: boolean;
  }): Promise<string> {
    try {
      // Check if chat already exists
      const existing = await this.get(chatData.id);
      
      const times = getCacheTimes('chatList');
      
      const cachedChat: CachedChat = {
        id: chatData.id,
        title: chatData.title,
        createdAt: chatData.createdAt,
        updatedAt: chatData.updatedAt,
        userId: chatData.userId,
        messageCount: chatData.messageCount,
        lastMessage: chatData.lastMessage,
        isFavorite: chatData.isFavorite ?? existing?.isFavorite ?? false,
        ...times,
        syncedAt: Date.now(),
        isDirty: false,
        deletedLocally: false,
        localChanges: existing?.localChanges,
      };

      await this.put(cachedChat);
      
      console.log('[ChatsRepository] Cached chat:', chatData.id);
      return chatData.id;
    } catch (error) {
      console.error('[ChatsRepository] Error caching chat:', error);
      throw error;
    }
  }

  /**
   * Cache multiple chats
   */
  async cacheChats(chats: Array<{
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    userId: string;
    messageCount: number;
    lastMessage: any;
    isFavorite?: boolean;
  }>): Promise<string[]> {
    try {
      const ids: string[] = [];
      
      for (const chat of chats) {
        const id = await this.cacheChat(chat);
        ids.push(id);
      }
      
      console.log(`[ChatsRepository] Cached ${chats.length} chats`);
      return ids;
    } catch (error) {
      console.error('[ChatsRepository] Error caching multiple chats:', error);
      throw error;
    }
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(chatId: string): Promise<boolean> {
    try {
      const chat = await this.get(chatId);
      
      if (!chat) {
        throw new Error('Chat not found');
      }

      const newFavoriteStatus = !chat.isFavorite;
      
      await this.update(chatId, {
        isFavorite: newFavoriteStatus,
        isDirty: true,
        localChanges: {
          ...chat.localChanges,
          isFavorite: newFavoriteStatus,
        },
      } as Partial<CachedChat>);

      console.log(`[ChatsRepository] Toggled favorite for chat ${chatId}: ${newFavoriteStatus}`);
      return newFavoriteStatus;
    } catch (error) {
      console.error('[ChatsRepository] Error toggling favorite:', error);
      throw error;
    }
  }

  /**
   * Update chat title
   */
  async updateTitle(chatId: string, newTitle: string): Promise<void> {
    try {
      const chat = await this.get(chatId);
      
      if (!chat) {
        throw new Error('Chat not found');
      }

      await this.update(chatId, {
        title: newTitle,
        isDirty: true,
        localChanges: {
          ...chat.localChanges,
          title: newTitle,
        },
      } as Partial<CachedChat>);

      console.log(`[ChatsRepository] Updated title for chat ${chatId}`);
    } catch (error) {
      console.error('[ChatsRepository] Error updating title:', error);
      throw error;
    }
  }

  /**
   * Soft delete a chat (mark as deleted locally)
   */
  async softDelete(chatId: string): Promise<void> {
    try {
      await this.update(chatId, {
        deletedLocally: true,
        isDirty: true,
      } as Partial<CachedChat>);

      console.log(`[ChatsRepository] Soft deleted chat ${chatId}`);
    } catch (error) {
      console.error('[ChatsRepository] Error soft deleting chat:', error);
      throw error;
    }
  }

  /**
   * Get chats that need syncing (have local changes)
   */
  async getDirtyChats(): Promise<CachedChat[]> {
    try {
      return await this.table
        .where('isDirty')
        .equals(true)
        .toArray();
    } catch (error) {
      console.error('[ChatsRepository] Error getting dirty chats:', error);
      return [];
    }
  }

  /**
   * Mark chat as synced
   */
  async markAsSynced(chatId: string): Promise<void> {
    try {
      await this.update(chatId, {
        isDirty: false,
        syncedAt: Date.now(),
        localChanges: undefined,
      } as Partial<CachedChat>);

      console.log(`[ChatsRepository] Marked chat ${chatId} as synced`);
    } catch (error) {
      console.error('[ChatsRepository] Error marking chat as synced:', error);
      throw error;
    }
  }

  /**
   * Get chats excluding soft-deleted ones
   */
  async getActiveChats(): Promise<CachedChat[]> {
    try {
      const allChats = await this.getAll();
      return allChats.filter(chat => !chat.deletedLocally);
    } catch (error) {
      console.error('[ChatsRepository] Error getting active chats:', error);
      return [];
    }
  }

  /**
   * Search chats by title
   */
  async searchByTitle(query: string): Promise<CachedChat[]> {
    try {
      const allChats = await this.getActiveChats();
      const lowercaseQuery = query.toLowerCase();
      
      return allChats.filter(chat => 
        chat.title.toLowerCase().includes(lowercaseQuery)
      );
    } catch (error) {
      console.error('[ChatsRepository] Error searching chats:', error);
      return [];
    }
  }

  /**
   * Convert CachedChat to UI Chat type
   */
  toUIChatType(cached: CachedChat): Chat {
    return {
      id: cached.id,
      title: cached.title,
      date: cached.updatedAt,
      isFavorite: cached.isFavorite,
    };
  }

  /**
   * Convert multiple CachedChats to UI Chat types
   */
  toUIChatTypes(cached: CachedChat[]): Chat[] {
    return cached.map(chat => this.toUIChatType(chat));
  }

  /**
   * Get chat statistics
   */
  async getStats(): Promise<{
    totalChats: number;
    favoriteChats: number;
    dirtyChats: number;
    deletedChats: number;
  }> {
    try {
      const [allChats, dirtyChats] = await Promise.all([
        this.getAll(),
        this.getDirtyChats(),
      ]);

      const favoriteChats = allChats.filter(chat => chat.isFavorite).length;
      const deletedChats = allChats.filter(chat => chat.deletedLocally).length;

      return {
        totalChats: allChats.length,
        favoriteChats,
        dirtyChats: dirtyChats.length,
        deletedChats,
      };
    } catch (error) {
      console.error('[ChatsRepository] Error getting stats:', error);
      return {
        totalChats: 0,
        favoriteChats: 0,
        dirtyChats: 0,
        deletedChats: 0,
      };
    }
  }
}

// Export singleton instance
export const chatsRepository = new ChatsRepository();

