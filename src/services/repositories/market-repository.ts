// services/repositories/market-repository.ts
// Repository for market data management (indices, news, sectors)

import { db } from '../db';
import { CachedRepository } from './base-repository';
import type { CachedMarketData, MarketDataContent } from '@/types/db';
import { getCacheTimes, getStaleTime } from '../cache-config';

/**
 * Market Data Repository
 * Manages market indices, news, sectors, and trends caching
 */
class MarketRepository extends CachedRepository<CachedMarketData, 'id'> {
  protected table = db.marketData;
  protected tableName = 'MarketRepository';

  /**
   * Cache market data
   */
  async cacheMarket(
    type: 'index' | 'news' | 'sector' | 'trend',
    data: MarketDataContent,
    symbol?: string,
    staleTimeOverride?: number
  ): Promise<string> {
    try {
      // Generate ID from type and symbol
      const id = symbol ? `${type}-${symbol}` : `${type}-${Date.now()}`;
      
      // Get appropriate cache times based on type
      const cacheType = type === 'index' ? 'indices' : 
                        type === 'news' ? 'news' : 
                        type === 'sector' ? 'sectors' : 'marketTrends';
      
      const times = staleTimeOverride
        ? {
            cachedAt: Date.now(),
            staleAfter: Date.now() + staleTimeOverride,
            expiresAt: Date.now() + (staleTimeOverride * 3),
          }
        : getCacheTimes(cacheType as any);

      const cachedMarket: CachedMarketData = {
        id,
        type,
        symbol,
        data,
        lastUpdated: Date.now(),
        ...times,
      };

      await this.put(cachedMarket);
      
      console.log('[MarketRepository] Cached market data:', id);
      return id;
    } catch (error) {
      console.error('[MarketRepository] Error caching market data:', error);
      throw error;
    }
  }

  /**
   * Cache market index
   */
  async cacheIndex(
    symbol: string,
    indexData: MarketDataContent['index']
  ): Promise<string> {
    return await this.cacheMarket('index', { index: indexData }, symbol);
  }

  /**
   * Cache market news
   */
  async cacheNews(newsItems: MarketDataContent['news']): Promise<string> {
    return await this.cacheMarket('news', { news: newsItems });
  }

  /**
   * Cache sector data
   */
  async cacheSector(
    sectorName: string,
    sectorData: MarketDataContent['sector']
  ): Promise<string> {
    return await this.cacheMarket('sector', { sector: sectorData }, sectorName);
  }

  /**
   * Get market data by type
   */
  async getByType(type: 'index' | 'news' | 'sector' | 'trend'): Promise<CachedMarketData[]> {
    try {
      return await this.table
        .where('type')
        .equals(type)
        .reverse()
        .sortBy('lastUpdated');
    } catch (error) {
      console.error('[MarketRepository] Error getting market data by type:', error);
      return [];
    }
  }

  /**
   * Get market data by type and symbol
   */
  async getByTypeAndSymbol(
    type: 'index' | 'news' | 'sector' | 'trend',
    symbol: string
  ): Promise<CachedMarketData | undefined> {
    const id = `${type}-${symbol}`;
    return await this.get(id);
  }

  /**
   * Get all market indices
   */
  async getAllIndices(): Promise<CachedMarketData[]> {
    return await this.getByType('index');
  }

  /**
   * Get specific index
   */
  async getIndex(symbol: string): Promise<CachedMarketData | undefined> {
    return await this.getByTypeAndSymbol('index', symbol);
  }

  /**
   * Get latest news
   */
  async getLatestNews(limit?: number): Promise<CachedMarketData[]> {
    try {
      const allNews = await this.getByType('news');
      
      if (limit) {
        return allNews.slice(0, limit);
      }
      
      return allNews;
    } catch (error) {
      console.error('[MarketRepository] Error getting latest news:', error);
      return [];
    }
  }

  /**
   * Get all sectors
   */
  async getAllSectors(): Promise<CachedMarketData[]> {
    return await this.getByType('sector');
  }

  /**
   * Get specific sector
   */
  async getSector(sectorName: string): Promise<CachedMarketData | undefined> {
    return await this.getByTypeAndSymbol('sector', sectorName);
  }

  /**
   * Get market trends
   */
  async getTrends(): Promise<CachedMarketData[]> {
    return await this.getByType('trend');
  }

  /**
   * Update index value (quick update)
   */
  async updateIndexValue(
    symbol: string,
    value: number,
    change: number,
    changePercent: number
  ): Promise<void> {
    try {
      const index = await this.getIndex(symbol);
      
      if (!index || !index.data.index) {
        throw new Error(`Index ${symbol} not found in cache`);
      }

      const updatedIndex = {
        ...index.data.index,
        value,
        change,
        changePercent,
      };

      await this.cacheIndex(symbol, updatedIndex);
    } catch (error) {
      console.error('[MarketRepository] Error updating index value:', error);
      throw error;
    }
  }

  /**
   * Delete old news (older than a certain date)
   */
  async deleteOldNews(olderThanTimestamp: number): Promise<number> {
    try {
      const allNews = await this.getByType('news');
      const oldNews = allNews.filter(news => news.lastUpdated < olderThanTimestamp);
      
      await this.deleteMany(oldNews.map(n => n.id));
      
      console.log(`[MarketRepository] Deleted ${oldNews.length} old news items`);
      return oldNews.length;
    } catch (error) {
      console.error('[MarketRepository] Error deleting old news:', error);
      return 0;
    }
  }

  /**
   * Search news by keyword
   */
  async searchNews(keyword: string): Promise<CachedMarketData[]> {
    try {
      const allNews = await this.getByType('news');
      const lowercaseKeyword = keyword.toLowerCase();
      
      return allNews.filter(newsItem => {
        if (!newsItem.data.news) return false;
        
        return newsItem.data.news.some(article => 
          article.title.toLowerCase().includes(lowercaseKeyword) ||
          article.summary.toLowerCase().includes(lowercaseKeyword)
        );
      });
    } catch (error) {
      console.error('[MarketRepository] Error searching news:', error);
      return [];
    }
  }

  /**
   * Get top performing sectors
   */
  async getTopSectors(limit: number = 5): Promise<CachedMarketData[]> {
    try {
      const allSectors = await this.getAllSectors();
      
      return allSectors
        .filter(s => s.data.sector)
        .sort((a, b) => (b.data.sector?.performance || 0) - (a.data.sector?.performance || 0))
        .slice(0, limit);
    } catch (error) {
      console.error('[MarketRepository] Error getting top sectors:', error);
      return [];
    }
  }

  /**
   * Get market data statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    indices: number;
    newsItems: number;
    sectors: number;
    trends: number;
  }> {
    try {
      const [indices, news, sectors, trends] = await Promise.all([
        this.getByType('index'),
        this.getByType('news'),
        this.getByType('sector'),
        this.getByType('trend'),
      ]);

      return {
        totalEntries: indices.length + news.length + sectors.length + trends.length,
        indices: indices.length,
        newsItems: news.length,
        sectors: sectors.length,
        trends: trends.length,
      };
    } catch (error) {
      console.error('[MarketRepository] Error getting stats:', error);
      return {
        totalEntries: 0,
        indices: 0,
        newsItems: 0,
        sectors: 0,
        trends: 0,
      };
    }
  }

  /**
   * Cleanup market data by type (delete all of a certain type)
   */
  async cleanupByType(type: 'index' | 'news' | 'sector' | 'trend'): Promise<number> {
    try {
      const items = await this.getByType(type);
      await this.deleteMany(items.map(item => item.id));
      
      console.log(`[MarketRepository] Cleaned up ${items.length} ${type} entries`);
      return items.length;
    } catch (error) {
      console.error('[MarketRepository] Error cleaning up by type:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const marketRepository = new MarketRepository();

