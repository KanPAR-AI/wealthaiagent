// services/repositories/stocks-repository.ts
// Repository for stock market data management

import { db } from '../db';
import { CachedRepository } from './base-repository';
import type { CachedStockData, StockDataPoint } from '@/types/db';
import { getCacheTimes } from '../cache-config';

/**
 * Stocks Repository
 * Manages stock market data caching with real-time updates
 */
class StocksRepository extends CachedRepository<CachedStockData, 'symbol'> {
  protected table = db.stockData;
  protected tableName = 'StocksRepository';

  /**
   * Cache stock data with optional sparkline
   */
  async cacheStock(
    symbol: string,
    data: StockDataPoint,
    source: string = 'unknown',
    staleTimeOverride?: number,
    sparkline?: Array<{ t: number; v: number }>
  ): Promise<string> {
    try {
      const times = staleTimeOverride
        ? {
            cachedAt: Date.now(),
            staleAfter: Date.now() + staleTimeOverride,
            expiresAt: Date.now() + (staleTimeOverride * 3),
          }
        : getCacheTimes('stockRealtime');

      // Get existing data to preserve sparkline if not provided
      const existing = await this.getStock(symbol);
      
      const cachedStock: CachedStockData = {
        symbol: symbol.toUpperCase(),
        data,
        sparkline: sparkline || existing?.sparkline,
        source,
        lastUpdated: Date.now(),
        ...times,
        metadata: {
          ...existing?.metadata,
          lastRefreshAttempt: Date.now(),
          sparklineTimeframe: sparkline ? '1min' : existing?.metadata?.sparklineTimeframe,
          sparklineFrom: sparkline ? Math.min(...sparkline.map(p => p.t)) : existing?.metadata?.sparklineFrom,
          sparklineTo: sparkline ? Math.max(...sparkline.map(p => p.t)) : existing?.metadata?.sparklineTo,
        },
      };

      await this.put(cachedStock);
      
      console.log('[StocksRepository] Cached stock data:', symbol, sparkline ? `with ${sparkline.length} sparkline points` : '');
      return symbol;
    } catch (error) {
      console.error('[StocksRepository] Error caching stock:', error);
      throw error;
    }
  }

  /**
   * Cache multiple stocks
   */
  async cacheStocks(
    stocks: Array<{
      symbol: string;
      data: StockDataPoint;
      source?: string;
    }>,
    staleTimeOverride?: number
  ): Promise<string[]> {
    try {
      const symbols: string[] = [];
      
      for (const stock of stocks) {
        const symbol = await this.cacheStock(
          stock.symbol,
          stock.data,
          stock.source,
          staleTimeOverride
        );
        symbols.push(symbol);
      }
      
      console.log(`[StocksRepository] Cached ${stocks.length} stocks`);
      return symbols;
    } catch (error) {
      console.error('[StocksRepository] Error caching multiple stocks:', error);
      throw error;
    }
  }

  /**
   * Get stock by symbol
   */
  async getStock(symbol: string): Promise<CachedStockData | undefined> {
    return await this.get(symbol.toUpperCase());
  }

  /**
   * Get multiple stocks by symbols
   */
  async getStocks(symbols: string[]): Promise<CachedStockData[]> {
    const upperSymbols = symbols.map(s => s.toUpperCase());
    return await this.getMany(upperSymbols);
  }

  /**
   * Update stock price (quick update)
   */
  async updatePrice(symbol: string, price: number, change: number, changePercent: number): Promise<void> {
    try {
      const stock = await this.getStock(symbol);
      
      if (!stock) {
        throw new Error(`Stock ${symbol} not found in cache`);
      }

      const updatedData: StockDataPoint = {
        ...stock.data,
        price,
        change,
        changePercent,
      };

      await this.cacheStock(symbol, updatedData, stock.source);
    } catch (error) {
      console.error('[StocksRepository] Error updating stock price:', error);
      throw error;
    }
  }

  /**
   * Get stocks by source
   */
  async getBySource(source: string): Promise<CachedStockData[]> {
    try {
      const allStocks = await this.getAll();
      return allStocks.filter(stock => stock.source === source);
    } catch (error) {
      console.error('[StocksRepository] Error getting stocks by source:', error);
      return [];
    }
  }

  /**
   * Search stocks by symbol pattern
   */
  async searchBySymbol(pattern: string): Promise<CachedStockData[]> {
    try {
      const allStocks = await this.getAll();
      const upperPattern = pattern.toUpperCase();
      
      return allStocks.filter(stock => 
        stock.symbol.includes(upperPattern)
      );
    } catch (error) {
      console.error('[StocksRepository] Error searching stocks:', error);
      return [];
    }
  }

  /**
   * Get top gainers
   */
  async getTopGainers(limit: number = 10): Promise<CachedStockData[]> {
    try {
      const allStocks = await this.getAll();
      
      return allStocks
        .sort((a, b) => b.data.changePercent - a.data.changePercent)
        .slice(0, limit);
    } catch (error) {
      console.error('[StocksRepository] Error getting top gainers:', error);
      return [];
    }
  }

  /**
   * Get top losers
   */
  async getTopLosers(limit: number = 10): Promise<CachedStockData[]> {
    try {
      const allStocks = await this.getAll();
      
      return allStocks
        .sort((a, b) => a.data.changePercent - b.data.changePercent)
        .slice(0, limit);
    } catch (error) {
      console.error('[StocksRepository] Error getting top losers:', error);
      return [];
    }
  }

  /**
   * Get stocks with high volume
   */
  async getHighVolume(limit: number = 10): Promise<CachedStockData[]> {
    try {
      const allStocks = await this.getAll();
      
      return allStocks
        .sort((a, b) => b.data.volume - a.data.volume)
        .slice(0, limit);
    } catch (error) {
      console.error('[StocksRepository] Error getting high volume stocks:', error);
      return [];
    }
  }

  /**
   * Mark stock as needing refresh
   */
  async markForRefresh(symbol: string): Promise<void> {
    try {
      await this.update(symbol.toUpperCase(), {
        metadata: {
          lastRefreshAttempt: Date.now(),
        },
      } as Partial<CachedStockData>);
    } catch (error) {
      console.error('[StocksRepository] Error marking stock for refresh:', error);
    }
  }

  /**
   * Get stock statistics
   */
  async getStats(): Promise<{
    totalStocks: number;
    gainers: number;
    losers: number;
    unchanged: number;
    averageChange: number;
  }> {
    try {
      const allStocks = await this.getAll();

      if (allStocks.length === 0) {
        return {
          totalStocks: 0,
          gainers: 0,
          losers: 0,
          unchanged: 0,
          averageChange: 0,
        };
      }

      const gainers = allStocks.filter(s => s.data.changePercent > 0).length;
      const losers = allStocks.filter(s => s.data.changePercent < 0).length;
      const unchanged = allStocks.filter(s => s.data.changePercent === 0).length;
      
      const totalChange = allStocks.reduce((sum, s) => sum + s.data.changePercent, 0);
      const averageChange = totalChange / allStocks.length;

      return {
        totalStocks: allStocks.length,
        gainers,
        losers,
        unchanged,
        averageChange,
      };
    } catch (error) {
      console.error('[StocksRepository] Error getting stats:', error);
      return {
        totalStocks: 0,
        gainers: 0,
        losers: 0,
        unchanged: 0,
        averageChange: 0,
      };
    }
  }
}

// Export singleton instance
export const stocksRepository = new StocksRepository();

