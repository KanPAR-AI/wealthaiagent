// services/repositories/base-repository.ts
// Base repository class with common CRUD operations

import { db } from '../db';
import type { EntityTable } from 'dexie';
import type { CacheMetadata, PaginationOptions, PaginatedResult } from '@/types/db';
import { checkFreshness, getCachedResult } from '@/utils/staleness-checker';

/**
 * Base repository class with common operations
 * All specific repositories extend this class
 */
export abstract class BaseRepository<T extends { id: string | number }, TKey extends keyof T = 'id'> {
  protected abstract table: EntityTable<T, TKey>;
  protected abstract tableName: string;

  /**
   * Get a single item by ID
   */
  async get(id: T[TKey]): Promise<T | undefined> {
    try {
      return await this.table.get(id);
    } catch (error) {
      console.error(`[${this.tableName}] Error getting item:`, error);
      return undefined;
    }
  }

  /**
   * Get multiple items by IDs
   */
  async getMany(ids: T[TKey][]): Promise<T[]> {
    try {
      const items = await this.table.bulkGet(ids);
      return items.filter((item): item is T => item !== undefined);
    } catch (error) {
      console.error(`[${this.tableName}] Error getting multiple items:`, error);
      return [];
    }
  }

  /**
   * Get all items
   */
  async getAll(): Promise<T[]> {
    try {
      return await this.table.toArray();
    } catch (error) {
      console.error(`[${this.tableName}] Error getting all items:`, error);
      return [];
    }
  }

  /**
   * Add a single item
   */
  async add(item: T): Promise<T[TKey]> {
    try {
      const id = await this.table.add(item);
      console.log(`[${this.tableName}] Added item:`, id);
      return id as T[TKey];
    } catch (error) {
      console.error(`[${this.tableName}] Error adding item:`, error);
      throw error;
    }
  }

  /**
   * Add multiple items
   */
  async addMany(items: T[]): Promise<T[TKey][]> {
    try {
      const ids = await this.table.bulkAdd(items, { allKeys: true });
      console.log(`[${this.tableName}] Added ${items.length} items`);
      return ids as T[TKey][];
    } catch (error) {
      console.error(`[${this.tableName}] Error adding multiple items:`, error);
      throw error;
    }
  }

  /**
   * Update a single item
   */
  async update(id: T[TKey], updates: Partial<T>): Promise<T[TKey]> {
    try {
      await this.table.update(id, updates);
      console.log(`[${this.tableName}] Updated item:`, id);
      return id;
    } catch (error) {
      console.error(`[${this.tableName}] Error updating item:`, error);
      throw error;
    }
  }

  /**
   * Put (add or update) a single item
   */
  async put(item: T): Promise<T[TKey]> {
    try {
      const id = await this.table.put(item);
      console.log(`[${this.tableName}] Put item:`, id);
      return id as T[TKey];
    } catch (error) {
      console.error(`[${this.tableName}] Error putting item:`, error);
      throw error;
    }
  }

  /**
   * Put (add or update) multiple items
   */
  async putMany(items: T[]): Promise<T[TKey][]> {
    try {
      const ids = await this.table.bulkPut(items, { allKeys: true });
      console.log(`[${this.tableName}] Put ${items.length} items`);
      return ids as T[TKey][];
    } catch (error) {
      console.error(`[${this.tableName}] Error putting multiple items:`, error);
      throw error;
    }
  }

  /**
   * Delete a single item
   */
  async delete(id: T[TKey]): Promise<void> {
    try {
      await this.table.delete(id);
      console.log(`[${this.tableName}] Deleted item:`, id);
    } catch (error) {
      console.error(`[${this.tableName}] Error deleting item:`, error);
      throw error;
    }
  }

  /**
   * Delete multiple items
   */
  async deleteMany(ids: T[TKey][]): Promise<void> {
    try {
      await this.table.bulkDelete(ids);
      console.log(`[${this.tableName}] Deleted ${ids.length} items`);
    } catch (error) {
      console.error(`[${this.tableName}] Error deleting multiple items:`, error);
      throw error;
    }
  }

  /**
   * Clear all items
   */
  async clear(): Promise<void> {
    try {
      await this.table.clear();
      console.log(`[${this.tableName}] Cleared all items`);
    } catch (error) {
      console.error(`[${this.tableName}] Error clearing table:`, error);
      throw error;
    }
  }

  /**
   * Count total items
   */
  async count(): Promise<number> {
    try {
      return await this.table.count();
    } catch (error) {
      console.error(`[${this.tableName}] Error counting items:`, error);
      return 0;
    }
  }

  /**
   * Check if an item exists
   */
  async exists(id: T[TKey]): Promise<boolean> {
    try {
      const item = await this.table.get(id);
      return item !== undefined;
    } catch (error) {
      console.error(`[${this.tableName}] Error checking if item exists:`, error);
      return false;
    }
  }

  /**
   * Get paginated results
   */
  async getPaginated(options: PaginationOptions = {}): Promise<PaginatedResult<T>> {
    const {
      limit = 50,
      offset = 0,
      orderBy = 'id',
      orderDirection = 'asc',
    } = options;

    try {
      const total = await this.table.count();
      
      let collection = this.table.orderBy(orderBy);
      
      if (orderDirection === 'desc') {
        collection = collection.reverse();
      }

      const items = await collection
        .offset(offset)
        .limit(limit)
        .toArray();

      const hasMore = offset + limit < total;
      const nextOffset = hasMore ? offset + limit : undefined;

      return {
        items,
        total,
        hasMore,
        nextOffset,
      };
    } catch (error) {
      console.error(`[${this.tableName}] Error getting paginated results:`, error);
      return {
        items: [],
        total: 0,
        hasMore: false,
      };
    }
  }
}

/**
 * Base repository for cached items with staleness checking
 */
export abstract class CachedRepository<
  T extends CacheMetadata & { id: string | number },
  TKey extends keyof T = 'id'
> extends BaseRepository<T, TKey> {
  
  /**
   * Get item with freshness check
   */
  async getWithFreshness(id: T[TKey]) {
    const item = await this.get(id);
    return getCachedResult(item);
  }

  /**
   * Get items that are fresh (not stale or expired)
   */
  async getFreshItems(): Promise<T[]> {
    try {
      const allItems = await this.table.toArray();
      const now = Date.now();
      
      return allItems.filter(item => {
        const freshness = checkFreshness(item.cachedAt, item.staleAfter, item.expiresAt);
        return freshness === 'fresh';
      });
    } catch (error) {
      console.error(`[${this.tableName}] Error getting fresh items:`, error);
      return [];
    }
  }

  /**
   * Get items that are stale (need background refresh)
   */
  async getStaleItems(): Promise<T[]> {
    try {
      const allItems = await this.table.toArray();
      const now = Date.now();
      
      return allItems.filter(item => {
        const freshness = checkFreshness(item.cachedAt, item.staleAfter, item.expiresAt);
        return freshness === 'stale';
      });
    } catch (error) {
      console.error(`[${this.tableName}] Error getting stale items:`, error);
      return [];
    }
  }

  /**
   * Delete expired items
   */
  async deleteExpired(): Promise<number> {
    try {
      const now = Date.now();
      // @ts-ignore - expiresAt exists on CacheMetadata
      const deleted = await this.table.where('expiresAt').below(now).delete();
      console.log(`[${this.tableName}] Deleted ${deleted} expired items`);
      return deleted;
    } catch (error) {
      console.error(`[${this.tableName}] Error deleting expired items:`, error);
      return 0;
    }
  }

  /**
   * Update cache timestamps
   */
  async updateCacheTimestamps(
    id: T[TKey],
    cachedAt: number,
    staleAfter: number,
    expiresAt: number
  ): Promise<void> {
    await this.update(id, {
      cachedAt,
      staleAfter,
      expiresAt,
    } as Partial<T>);
  }
}

