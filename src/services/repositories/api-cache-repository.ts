// services/repositories/api-cache-repository.ts
// Repository for generic API response caching

import { db } from '../db';
import { CachedRepository } from './base-repository';
import type { ApiCacheEntry } from '@/types/db';
import { getCacheTimes } from '../cache-config';

/**
 * API Cache Repository
 * Manages caching of generic API responses
 */
class ApiCacheRepository extends CachedRepository<ApiCacheEntry, 'key'> {
  protected table = db.apiCache;
  protected tableName = 'ApiCacheRepository';

  /**
   * Generate cache key from endpoint and params
   */
  private generateKey(endpoint: string, params: Record<string, any> = {}): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, any>);

    const paramsString = JSON.stringify(sortedParams);
    const combined = `${endpoint}__${paramsString}`;
    
    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return `api_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Cache an API response
   */
  async cacheResponse(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    params: Record<string, any>,
    response: any,
    statusCode: number = 200,
    options?: {
      staleTimeMs?: number;
      etag?: string;
      lastModified?: string;
    }
  ): Promise<string> {
    try {
      const key = this.generateKey(endpoint, params);
      const existing = await this.get(key);
      
      const times = options?.staleTimeMs
        ? {
            cachedAt: Date.now(),
            staleAfter: Date.now() + options.staleTimeMs,
            expiresAt: Date.now() + (options.staleTimeMs * 3),
          }
        : getCacheTimes('default');

      const cacheEntry: ApiCacheEntry = {
        key,
        endpoint,
        method,
        params,
        response,
        statusCode,
        etag: options?.etag,
        lastModified: options?.lastModified,
        ...times,
        hitCount: existing ? existing.hitCount + 1 : 1,
        lastAccessedAt: Date.now(),
      };

      await this.put(cacheEntry);
      
      console.log('[ApiCacheRepository] Cached API response:', key);
      return key;
    } catch (error) {
      console.error('[ApiCacheRepository] Error caching response:', error);
      throw error;
    }
  }

  /**
   * Get cached API response
   */
  async getCachedResponse(
    endpoint: string,
    params: Record<string, any> = {}
  ): Promise<ApiCacheEntry | undefined> {
    try {
      const key = this.generateKey(endpoint, params);
      const cached = await this.get(key);
      
      if (cached) {
        // Update access tracking
        await this.update(key, {
          hitCount: cached.hitCount + 1,
          lastAccessedAt: Date.now(),
        } as Partial<ApiCacheEntry>);
      }
      
      return cached;
    } catch (error) {
      console.error('[ApiCacheRepository] Error getting cached response:', error);
      return undefined;
    }
  }

  /**
   * Get responses by endpoint
   */
  async getByEndpoint(endpoint: string): Promise<ApiCacheEntry[]> {
    try {
      return await this.table
        .where('endpoint')
        .equals(endpoint)
        .reverse()
        .sortBy('cachedAt');
    } catch (error) {
      console.error('[ApiCacheRepository] Error getting by endpoint:', error);
      return [];
    }
  }

  /**
   * Delete cached responses by endpoint
   */
  async deleteByEndpoint(endpoint: string): Promise<number> {
    try {
      const entries = await this.getByEndpoint(endpoint);
      await this.deleteMany(entries.map(e => e.key));
      
      console.log(`[ApiCacheRepository] Deleted ${entries.length} entries for endpoint: ${endpoint}`);
      return entries.length;
    } catch (error) {
      console.error('[ApiCacheRepository] Error deleting by endpoint:', error);
      return 0;
    }
  }

  /**
   * Invalidate cache by endpoint pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const allEntries = await this.getAll();
      const matching = allEntries.filter(entry => 
        entry.endpoint.includes(pattern)
      );
      
      await this.deleteMany(matching.map(e => e.key));
      
      console.log(`[ApiCacheRepository] Invalidated ${matching.length} entries matching pattern: ${pattern}`);
      return matching.length;
    } catch (error) {
      console.error('[ApiCacheRepository] Error invalidating pattern:', error);
      return 0;
    }
  }

  /**
   * Get most accessed endpoints
   */
  async getMostAccessed(limit: number = 10): Promise<ApiCacheEntry[]> {
    try {
      const allEntries = await this.getAll();
      
      return allEntries
        .sort((a, b) => b.hitCount - a.hitCount)
        .slice(0, limit);
    } catch (error) {
      console.error('[ApiCacheRepository] Error getting most accessed:', error);
      return [];
    }
  }

  /**
   * Get least recently used entries
   */
  async getLeastRecentlyUsed(limit: number = 10): Promise<ApiCacheEntry[]> {
    try {
      return await this.table
        .orderBy('lastAccessedAt')
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error('[ApiCacheRepository] Error getting least recently used:', error);
      return [];
    }
  }

  /**
   * Clean up least recently used entries to stay under limit
   */
  async cleanupLRU(maxEntries: number): Promise<number> {
    try {
      const totalEntries = await this.count();
      
      if (totalEntries <= maxEntries) {
        return 0;
      }
      
      const entriesToDelete = totalEntries - maxEntries;
      const lruEntries = await this.getLeastRecentlyUsed(entriesToDelete);
      
      await this.deleteMany(lruEntries.map(e => e.key));
      
      console.log(`[ApiCacheRepository] Cleaned up ${lruEntries.length} LRU entries`);
      return lruEntries.length;
    } catch (error) {
      console.error('[ApiCacheRepository] Error cleaning up LRU:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    byMethod: Record<string, number>;
    totalHits: number;
    averageHitCount: number;
    mostPopularEndpoint?: string;
  }> {
    try {
      const allEntries = await this.getAll();

      if (allEntries.length === 0) {
        return {
          totalEntries: 0,
          byMethod: {},
          totalHits: 0,
          averageHitCount: 0,
        };
      }

      const byMethod = allEntries.reduce((acc, entry) => {
        acc[entry.method] = (acc[entry.method] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const totalHits = allEntries.reduce((sum, entry) => sum + entry.hitCount, 0);
      const averageHitCount = totalHits / allEntries.length;

      // Find most popular endpoint
      const endpointHits = allEntries.reduce((acc, entry) => {
        acc[entry.endpoint] = (acc[entry.endpoint] || 0) + entry.hitCount;
        return acc;
      }, {} as Record<string, number>);

      const mostPopularEndpoint = Object.entries(endpointHits)
        .sort(([, a], [, b]) => b - a)[0]?.[0];

      return {
        totalEntries: allEntries.length,
        byMethod,
        totalHits,
        averageHitCount,
        mostPopularEndpoint,
      };
    } catch (error) {
      console.error('[ApiCacheRepository] Error getting stats:', error);
      return {
        totalEntries: 0,
        byMethod: {},
        totalHits: 0,
        averageHitCount: 0,
      };
    }
  }

  /**
   * Get cache hit rate for an endpoint
   */
  async getHitRate(endpoint: string): Promise<{
    endpoint: string;
    totalRequests: number;
    totalHits: number;
    hitRate: number;
  }> {
    try {
      const entries = await this.getByEndpoint(endpoint);
      
      if (entries.length === 0) {
        return {
          endpoint,
          totalRequests: 0,
          totalHits: 0,
          hitRate: 0,
        };
      }

      const totalHits = entries.reduce((sum, entry) => sum + entry.hitCount, 0);
      const totalRequests = entries.length;
      const hitRate = totalHits / totalRequests;

      return {
        endpoint,
        totalRequests,
        totalHits,
        hitRate,
      };
    } catch (error) {
      console.error('[ApiCacheRepository] Error getting hit rate:', error);
      return {
        endpoint,
        totalRequests: 0,
        totalHits: 0,
        hitRate: 0,
      };
    }
  }

  /**
   * Export cache entries as JSON
   */
  async exportCache(): Promise<string> {
    try {
      const allEntries = await this.getAll();
      return JSON.stringify(allEntries, null, 2);
    } catch (error) {
      console.error('[ApiCacheRepository] Error exporting cache:', error);
      return '[]';
    }
  }

  /**
   * Import cache entries from JSON
   */
  async importCache(jsonData: string): Promise<number> {
    try {
      const entries = JSON.parse(jsonData) as ApiCacheEntry[];
      await this.putMany(entries);
      
      console.log(`[ApiCacheRepository] Imported ${entries.length} cache entries`);
      return entries.length;
    } catch (error) {
      console.error('[ApiCacheRepository] Error importing cache:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const apiCacheRepository = new ApiCacheRepository();

