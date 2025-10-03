// services/file-cache.ts
import { MessageFile } from '@/types';

interface CachedFile {
  url: string;
  blob: Blob;
  type: string;
  name: string;
  size: number;
  cachedAt: number;
  expiresAt: number;
}

class FileCacheService {
  private dbName = 'FileCacheDB';
  private dbVersion = 1;
  private storeName = 'files';
  private maxCacheSize = 100 * 1024 * 1024; // 100MB
  private maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'url' });
          store.createIndex('cachedAt', 'cachedAt', { unique: false });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
        }
      };
    });
  }

  private async getTransaction(mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    if (!this.db) await this.init();
    const transaction = this.db!.transaction([this.storeName], mode);
    return transaction.objectStore(this.storeName);
  }

  async get(url: string): Promise<CachedFile | null> {
    try {
      const store = await this.getTransaction();
      const request = store.get(url);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const result = request.result as CachedFile | undefined;
          if (!result) {
            resolve(null);
            return;
          }

          // Check if expired
          if (Date.now() > result.expiresAt) {
            this.delete(url); // Clean up expired entry
            resolve(null);
            return;
          }

          resolve(result);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get cached file:', error);
      return null;
    }
  }

  async set(url: string, blob: Blob, file: MessageFile): Promise<void> {
    try {
      const store = await this.getTransaction('readwrite');
      const cachedFile: CachedFile = {
        url,
        blob,
        type: file.type,
        name: file.name,
        size: file.size,
        cachedAt: Date.now(),
        expiresAt: Date.now() + this.maxAge
      };

      const request = store.put(cachedFile);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          this.cleanup(); // Clean up old entries
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to cache file:', error);
    }
  }

  async delete(url: string): Promise<void> {
    try {
      const store = await this.getTransaction('readwrite');
      const request = store.delete(url);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to delete cached file:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      const store = await this.getTransaction('readwrite');
      const request = store.clear();
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  async getCacheSize(): Promise<number> {
    try {
      const store = await this.getTransaction();
      const request = store.getAll();
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const files = request.result as CachedFile[];
          const totalSize = files.reduce((sum, file) => sum + file.size, 0);
          resolve(totalSize);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get cache size:', error);
      return 0;
    }
  }

  private async cleanup(): Promise<void> {
    try {
      const store = await this.getTransaction('readwrite');
      const request = store.getAll();
      
      request.onsuccess = () => {
        const files = request.result as CachedFile[];
        const now = Date.now();
        
        // Remove expired files
        const validFiles = files.filter(file => now <= file.expiresAt);
        
        // Sort by access time (oldest first)
        validFiles.sort((a, b) => a.cachedAt - b.cachedAt);
        
        // Calculate total size
        let totalSize = validFiles.reduce((sum, file) => sum + file.size, 0);
        
        // Remove oldest files if over size limit
        while (totalSize > this.maxCacheSize && validFiles.length > 0) {
          const oldestFile = validFiles.shift()!;
          totalSize -= oldestFile.size;
          this.delete(oldestFile.url);
        }
      };
    } catch (error) {
      console.error('Failed to cleanup cache:', error);
    }
  }

  // Get a blob URL for immediate use
  async getBlobUrl(url: string): Promise<string | null> {
    const cached = await this.get(url);
    if (cached) {
      return URL.createObjectURL(cached.blob);
    }
    return null;
  }

  // Cache a file from a fetch response
  async cacheFromResponse(url: string, response: Response, file: MessageFile): Promise<string> {
    const blob = await response.blob();
    await this.set(url, blob, file);
    return URL.createObjectURL(blob);
  }
}

// Singleton instance
export const fileCache = new FileCacheService();

// Initialize cache on module load
fileCache.init().catch(console.error);
