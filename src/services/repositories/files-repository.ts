// services/repositories/files-repository.ts
// Repository for file cache management

import { db } from '../db';
import { CachedRepository } from './base-repository';
import type { CachedFile } from '@/types/db';
import type { MessageFile } from '@/types/chat';
import { getCacheTimes } from '../cache-config';
import { CACHE_LIMITS } from '../cache-config';

/**
 * Files Repository
 * Manages file blob caching in IndexedDB
 */
class FilesRepository extends CachedRepository<CachedFile, 'id'> {
  protected table = db.files;
  protected tableName = 'FilesRepository';

  /**
   * Get file by URL
   */
  async getByUrl(url: string): Promise<CachedFile | undefined> {
    try {
      return await this.table.where('url').equals(url).first();
    } catch (error) {
      console.error('[FilesRepository] Error getting file by URL:', error);
      return undefined;
    }
  }

  /**
   * Get files by message ID
   */
  async getByMessageId(messageId: string): Promise<CachedFile[]> {
    try {
      return await this.table.where('messageId').equals(messageId).toArray();
    } catch (error) {
      console.error('[FilesRepository] Error getting files by message ID:', error);
      return [];
    }
  }

  /**
   * Get files by chat ID
   */
  async getByChatId(chatId: string): Promise<CachedFile[]> {
    try {
      return await this.table.where('chatId').equals(chatId).toArray();
    } catch (error) {
      console.error('[FilesRepository] Error getting files by chat ID:', error);
      return [];
    }
  }

  /**
   * Cache a file from a fetch response
   */
  async cacheFile(
    url: string,
    blob: Blob,
    fileInfo: MessageFile,
    options?: {
      messageId?: string;
      chatId?: string;
    }
  ): Promise<string> {
    try {
      // Check if file already exists
      const existing = await this.getByUrl(url);
      
      const times = getCacheTimes('files');
      
      const cachedFile: CachedFile = {
        id: existing?.id || crypto.randomUUID(),
        url,
        blob,
        name: fileInfo.name,
        type: fileInfo.type,
        size: fileInfo.size,
        ...times,
        lastAccessedAt: Date.now(),
        accessCount: existing ? existing.accessCount + 1 : 1,
        messageId: options?.messageId,
        chatId: options?.chatId,
      };

      await this.put(cachedFile);
      
      // Clean up if over size limit
      await this.cleanupIfNeeded();
      
      return cachedFile.id;
    } catch (error) {
      console.error('[FilesRepository] Error caching file:', error);
      throw error;
    }
  }

  /**
   * Get blob URL for a file (creates temporary URL)
   */
  async getBlobUrl(url: string): Promise<string | null> {
    try {
      const file = await this.getByUrl(url);
      
      if (!file) {
        return null;
      }

      // Update access tracking
      await this.update(file.id, {
        lastAccessedAt: Date.now(),
        accessCount: file.accessCount + 1,
      } as Partial<CachedFile>);

      // Create and return blob URL
      return URL.createObjectURL(file.blob);
    } catch (error) {
      console.error('[FilesRepository] Error getting blob URL:', error);
      return null;
    }
  }

  /**
   * Get total cache size
   */
  async getTotalSize(): Promise<number> {
    return await db.getFileCacheSize();
  }

  /**
   * Clean up old files if over size limit
   */
  async cleanupIfNeeded(): Promise<number> {
    const totalSize = await this.getTotalSize();
    const maxSize = CACHE_LIMITS.maxFileSize;
    
    if (totalSize <= maxSize) {
      return 0;
    }

    console.log(`[FilesRepository] Cache size ${totalSize} exceeds limit ${maxSize}, cleaning up...`);
    return await db.cleanupFilesOverLimit(maxSize);
  }

  /**
   * Clean up files older than a certain date
   */
  async cleanupOlderThan(timestamp: number): Promise<number> {
    try {
      const deleted = await this.table
        .where('cachedAt')
        .below(timestamp)
        .delete();
      
      console.log(`[FilesRepository] Deleted ${deleted} files older than ${new Date(timestamp).toISOString()}`);
      return deleted;
    } catch (error) {
      console.error('[FilesRepository] Error cleaning up old files:', error);
      return 0;
    }
  }

  /**
   * Get least recently accessed files
   */
  async getLeastRecentlyAccessed(limit: number = 10): Promise<CachedFile[]> {
    try {
      return await this.table
        .orderBy('lastAccessedAt')
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error('[FilesRepository] Error getting least recently accessed files:', error);
      return [];
    }
  }

  /**
   * Delete file by URL
   */
  async deleteByUrl(url: string): Promise<void> {
    try {
      const file = await this.getByUrl(url);
      if (file) {
        await this.delete(file.id);
      }
    } catch (error) {
      console.error('[FilesRepository] Error deleting file by URL:', error);
    }
  }

  /**
   * Delete files by message ID
   */
  async deleteByMessageId(messageId: string): Promise<number> {
    try {
      const files = await this.getByMessageId(messageId);
      await this.deleteMany(files.map(f => f.id));
      return files.length;
    } catch (error) {
      console.error('[FilesRepository] Error deleting files by message ID:', error);
      return 0;
    }
  }

  /**
   * Delete files by chat ID
   */
  async deleteByChatId(chatId: string): Promise<number> {
    try {
      const files = await this.getByChatId(chatId);
      await this.deleteMany(files.map(f => f.id));
      return files.length;
    } catch (error) {
      console.error('[FilesRepository] Error deleting files by chat ID:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    averageFileSize: number;
    oldestFile?: Date;
    newestFile?: Date;
  }> {
    try {
      const files = await this.getAll();
      
      if (files.length === 0) {
        return {
          totalFiles: 0,
          totalSize: 0,
          averageFileSize: 0,
        };
      }

      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      const averageFileSize = totalSize / files.length;
      
      const sortedByDate = [...files].sort((a, b) => a.cachedAt - b.cachedAt);
      const oldestFile = new Date(sortedByDate[0].cachedAt);
      const newestFile = new Date(sortedByDate[sortedByDate.length - 1].cachedAt);

      return {
        totalFiles: files.length,
        totalSize,
        averageFileSize,
        oldestFile,
        newestFile,
      };
    } catch (error) {
      console.error('[FilesRepository] Error getting stats:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        averageFileSize: 0,
      };
    }
  }
}

// Export singleton instance
export const filesRepository = new FilesRepository();

