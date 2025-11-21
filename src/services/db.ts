// services/db.ts
// Dexie database definition with all tables

import Dexie, { type EntityTable } from 'dexie';
import type {
  CachedFile,
  CachedChat,
  CachedMessage,
  CachedStockData,
  CachedPortfolioData,
  CachedMarketData,
  ApiCacheEntry,
} from '@/types/db';

/**
 * WealthAI Database
 * IndexedDB database for caching app data
 */
export class WealthAIDatabase extends Dexie {
  // Tables
  files!: EntityTable<CachedFile, 'id'>;
  chats!: EntityTable<CachedChat, 'id'>;
  messages!: EntityTable<CachedMessage, 'id'>;
  stockData!: EntityTable<CachedStockData, 'symbol'>;
  portfolioData!: EntityTable<CachedPortfolioData, 'id'>;
  marketData!: EntityTable<CachedMarketData, 'id'>;
  apiCache!: EntityTable<ApiCacheEntry, 'key'>;

  constructor() {
    super('WealthAIDB');
    
    // Define database schema
    this.version(1).stores({
      // Files table
      // Primary: id
      // Indexes: url (unique), cachedAt, expiresAt, messageId, chatId
      files: '++id, &url, cachedAt, expiresAt, messageId, chatId',
      
      // Chats table
      // Primary: id
      // Indexes: updatedAt, userId, isFavorite, cachedAt, staleAfter, isDirty
      chats: 'id, updatedAt, userId, isFavorite, cachedAt, staleAfter, isDirty',
      
      // Messages table
      // Primary: id
      // Indexes: [chatId+timestamp] (compound), chatId, sender, timestamp, cachedAt, isDirty, localOnly
      messages: 'id, [chatId+timestamp], chatId, sender, timestamp, cachedAt, isDirty, localOnly',
      
      // Stock data table
      // Primary: symbol
      // Indexes: lastUpdated, staleAfter, expiresAt
      stockData: 'symbol, lastUpdated, staleAfter, expiresAt',
      
      // Portfolio data table
      // Primary: id
      // Indexes: userId, type, lastUpdated, staleAfter
      portfolioData: 'id, userId, type, lastUpdated, staleAfter',
      
      // Market data table
      // Primary: id
      // Indexes: type, symbol, lastUpdated, staleAfter
      marketData: 'id, type, symbol, lastUpdated, staleAfter',
      
      // API cache table
      // Primary: key
      // Indexes: endpoint, cachedAt, expiresAt, lastAccessedAt
      apiCache: 'key, endpoint, cachedAt, expiresAt, lastAccessedAt',
    });
  }

  /**
   * Clear all data from the database
   */
  async clearAll(): Promise<void> {
    await Promise.all([
      this.files.clear(),
      this.chats.clear(),
      this.messages.clear(),
      this.stockData.clear(),
      this.portfolioData.clear(),
      this.marketData.clear(),
      this.apiCache.clear(),
    ]);
    console.log('[Database] All tables cleared');
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    files: number;
    chats: number;
    messages: number;
    stockData: number;
    portfolioData: number;
    marketData: number;
    apiCache: number;
    totalSize?: number;
  }> {
    const [
      filesCount,
      chatsCount,
      messagesCount,
      stockDataCount,
      portfolioDataCount,
      marketDataCount,
      apiCacheCount,
    ] = await Promise.all([
      this.files.count(),
      this.chats.count(),
      this.messages.count(),
      this.stockData.count(),
      this.portfolioData.count(),
      this.marketData.count(),
      this.apiCache.count(),
    ]);

    return {
      files: filesCount,
      chats: chatsCount,
      messages: messagesCount,
      stockData: stockDataCount,
      portfolioData: portfolioDataCount,
      marketData: marketDataCount,
      apiCache: apiCacheCount,
    };
  }

  /**
   * Clean up expired entries from all tables
   */
  async cleanupExpired(): Promise<{
    filesDeleted: number;
    chatsDeleted: number;
    messagesDeleted: number;
    stockDataDeleted: number;
    portfolioDataDeleted: number;
    marketDataDeleted: number;
    apiCacheDeleted: number;
  }> {
    const now = Date.now();
    
    const [
      filesDeleted,
      stockDataDeleted,
      portfolioDataDeleted,
      marketDataDeleted,
      apiCacheDeleted,
    ] = await Promise.all([
      // Delete expired files
      this.files.where('expiresAt').below(now).delete(),
      
      // Delete expired stock data
      this.stockData.where('expiresAt').below(now).delete(),
      
      // Delete expired portfolio data
      this.portfolioData.where('expiresAt').below(now).delete(),
      
      // Delete expired market data
      this.marketData.where('expiresAt').below(now).delete(),
      
      // Delete expired API cache
      this.apiCache.where('expiresAt').below(now).delete(),
    ]);

    console.log('[Database] Cleanup completed:', {
      filesDeleted,
      stockDataDeleted,
      portfolioDataDeleted,
      marketDataDeleted,
      apiCacheDeleted,
    });

    return {
      filesDeleted,
      chatsDeleted: 0, // Chats don't expire
      messagesDeleted: 0, // Messages don't expire
      stockDataDeleted,
      portfolioDataDeleted,
      marketDataDeleted,
      apiCacheDeleted,
    };
  }

  /**
   * Get total file cache size
   */
  async getFileCacheSize(): Promise<number> {
    const files = await this.files.toArray();
    return files.reduce((total, file) => total + file.size, 0);
  }

  /**
   * Clean up oldest files to stay under size limit
   */
  async cleanupFilesOverLimit(maxSize: number): Promise<number> {
    const totalSize = await this.getFileCacheSize();
    
    if (totalSize <= maxSize) {
      return 0;
    }
    
    // Get all files sorted by last access time (oldest first)
    const files = await this.files
      .orderBy('lastAccessedAt')
      .toArray();
    
    let deletedCount = 0;
    let currentSize = totalSize;
    
    for (const file of files) {
      if (currentSize <= maxSize) break;
      
      await this.files.delete(file.id);
      currentSize -= file.size;
      deletedCount++;
    }
    
    console.log(`[Database] Cleaned up ${deletedCount} files to stay under ${maxSize} bytes limit`);
    return deletedCount;
  }
}

// Create singleton instance
export const db = new WealthAIDatabase();

// Log database initialization
console.log('[Database] WealthAI Database initialized');

