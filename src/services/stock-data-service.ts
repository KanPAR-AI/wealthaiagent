// services/stock-data-service.ts
// Unified service for stock data: WebSocket + REST fallback + IndexedDB caching

import { MassiveWebSocketService } from './massive-websocket';
import { MassiveRestApiService, MassiveRestApiService as RestApi } from './massive-rest-api';
import { stocksRepository } from './repositories';
import { StockDataPoint } from '@/types/db';
import { SparklinePoint } from '@/types/trade';
import { isFresh, isStale } from '@/utils/staleness-checker';
import { env } from '@/config/environment';

export interface StockDataServiceOptions {
  apiKey: string;
  symbol: string;
  preferWebSocket?: boolean;
  useCache?: boolean;
  sparklineTimeframe?: '1min' | '5min' | '15min' | '1hour' | '1day';
  sparklineDays?: number; // Number of days of historical data (fallback if fromDate/toDate not provided)
  fromDate?: number; // Timestamp in ms
  toDate?: number; // Timestamp in ms
}

export interface StockDataResult {
  quote: StockDataPoint;
  sparkline: SparklinePoint[];
  source: 'websocket' | 'rest' | 'cache';
  cached: boolean;
}

/**
 * Unified stock data service
 * Tries WebSocket first, falls back to REST API, caches everything in IndexedDB
 */
export class StockDataService {
  private wsService: MassiveWebSocketService | null = null;
  private restService: MassiveRestApiService;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.restService = new MassiveRestApiService(apiKey);
  }

  /**
   * Get stock data with automatic fallback and caching
   */
  async getStockData(options: StockDataServiceOptions): Promise<StockDataResult> {
    const {
      symbol,
      preferWebSocket = true,
      useCache = true,
      sparklineTimeframe = '1min',
      sparklineDays = 7,
      fromDate,
      toDate,
    } = options;

    // 1. Check cache first
    if (useCache) {
      const cached = await stocksRepository.getStock(symbol);
      if (cached) {
        const isDataFresh = isFresh(cached);
        const isDataStale = isStale(cached);

        if (isDataFresh) {
          console.log(`[StockDataService] Using fresh cached data for ${symbol}`);
          return {
            quote: cached.data,
            sparkline: cached.sparkline || [],
            source: 'cache',
            cached: true,
          };
        }

        if (isDataStale) {
          console.log(`[StockDataService] Using stale cached data for ${symbol}, refreshing in background`);
          // Return stale data immediately, refresh in background
          this.refreshStockData(options).catch(err => {
            console.error(`[StockDataService] Background refresh failed for ${symbol}:`, err);
          });

          return {
            quote: cached.data,
            sparkline: cached.sparkline || [],
            source: 'cache',
            cached: true,
          };
        }
      }
    }

    // 2. Try to fetch fresh data
    try {
      if (preferWebSocket) {
        // Try WebSocket first (if available)
        const wsResult = await this.tryWebSocket(symbol);
        if (wsResult) {
          await this.cacheStockData(symbol, wsResult.quote, wsResult.sparkline, 'massive_websocket');
          return { ...wsResult, source: 'websocket', cached: false };
        }
      }

      // 3. Fall back to REST API
      console.log(`[StockDataService] Fetching ${symbol} via REST API`);
      try {
        const restResult = await this.fetchViaRest(symbol, sparklineTimeframe, sparklineDays, fromDate, toDate);
        await this.cacheStockData(symbol, restResult.quote, restResult.sparkline, 'massive_rest');
        return { ...restResult, source: 'rest', cached: false };
      } catch (restError) {
        console.error(`[StockDataService] REST API failed for ${symbol}:`, restError);
        // Re-throw to be caught by outer catch
        throw restError;
      }
    } catch (error) {
      console.error(`[StockDataService] Error fetching ${symbol}:`, error);

      // 4. If all else fails, return cached data even if expired
      if (useCache) {
        const cached = await stocksRepository.getStock(symbol);
        if (cached) {
          console.log(`[StockDataService] Returning expired cached data for ${symbol} as fallback`);
          return {
            quote: cached.data,
            sparkline: cached.sparkline || [],
            source: 'cache',
            cached: true,
          };
        }
      }

      throw error;
    }
  }

  /**
   * Try to get data via WebSocket (if connection is available)
   */
  private async tryWebSocket(symbol: string): Promise<{ quote: StockDataPoint; sparkline: SparklinePoint[] } | null> {
    // WebSocket is for real-time updates, not historical data
    // So we can't use it for initial data fetch
    // This would be used for live updates only
    return null;
  }

  /**
   * Fetch data via REST API
   * Optimized: Only make ONE API call - get historical bars and derive quote from it
   */
  private async fetchViaRest(
    symbol: string,
    timeframe: '1min' | '5min' | '15min' | '1hour' | '1day',
    days: number,
    fromDate?: number,
    toDate?: number
  ): Promise<{ quote: StockDataPoint; sparkline: SparklinePoint[] }> {
    // Use provided date range, or calculate from days
    const to = toDate || Date.now();
    const from = fromDate || (to - (days * 24 * 60 * 60 * 1000));

    // Calculate appropriate limit based on timeframe and days
    // For 1min: max ~1440 bars per day, so for 5 days = ~7200 bars
    // For 1day: max 365 bars per year
    const calculateLimit = (tf: string, numDays: number): number => {
      if (tf === '1min') return Math.min(10000, Math.ceil(numDays * 1440)); // Max 10k for 1min
      if (tf === '5min') return Math.min(5000, Math.ceil(numDays * 288)); // Max 5k for 5min
      if (tf === '15min') return Math.min(3000, Math.ceil(numDays * 96)); // Max 3k for 15min
      if (tf === '1hour') return Math.min(2000, Math.ceil(numDays * 24)); // Max 2k for hourly
      if (tf === '1day') return Math.min(500, numDays); // Max 500 for daily
      return 1000; // Default
    };
    
    const limit = calculateLimit(timeframe, days);

    // Only make ONE API call - get historical data and derive quote from it
    const historical = await this.restService.getHistoricalBars(symbol, timeframe, from, to, limit);
    
    if (historical.bars.length === 0) {
      throw new Error('No historical data available');
    }
    
    // Derive quote from the latest bar
    const latestBar = historical.bars[historical.bars.length - 1];
    const previousBar = historical.bars.length > 1 ? historical.bars[historical.bars.length - 2] : null;
    
    // Calculate change from previous bar
    const change = previousBar ? latestBar.c - previousBar.c : 0;
    const changePercent = previousBar && previousBar.c > 0 
      ? ((latestBar.c - previousBar.c) / previousBar.c) * 100 
      : 0;

    // Convert historical bars to sparkline format
    const sparkline = RestApi.barsToSparkline(historical.bars);

    // Convert latest bar to StockDataPoint format (quote)
    const stockDataPoint: StockDataPoint = {
      price: latestBar.c, // Close price
      change: change,
      changePercent: changePercent,
      volume: latestBar.v,
      high: latestBar.h,
      low: latestBar.l,
      open: latestBar.o,
      close: latestBar.c,
      previousClose: previousBar?.c || latestBar.c, // Use previous bar's close or current close
      marketCap: undefined, // Not available from aggregates
    };

    return {
      quote: stockDataPoint,
      sparkline,
    };
  }

  /**
   * Cache stock data in IndexedDB
   */
  private async cacheStockData(
    symbol: string,
    quote: StockDataPoint,
    sparkline: SparklinePoint[],
    source: string
  ): Promise<void> {
    try {
      // Use shorter stale time for real-time data, longer for REST API
      const staleTime = source === 'massive_websocket' 
        ? 30000  // 30 seconds for WebSocket
        : 300000; // 5 minutes for REST API

      // Cache the stock data with sparkline
      await stocksRepository.cacheStock(symbol, quote, source, staleTime, sparkline);
    } catch (error) {
      console.error(`[StockDataService] Error caching ${symbol}:`, error);
      // Don't throw - caching failure shouldn't break the flow
    }
  }

  /**
   * Refresh stock data in background
   */
  private async refreshStockData(options: StockDataServiceOptions): Promise<void> {
    try {
      await this.getStockData({ ...options, useCache: false });
    } catch (error) {
      console.error(`[StockDataService] Background refresh failed:`, error);
    }
  }

  /**
   * Subscribe to WebSocket updates for a symbol
   * Updates cache automatically when new data arrives
   */
  subscribeToUpdates(
    symbol: string,
    onUpdate: (data: StockDataResult) => void
  ): { unsubscribe: () => void } {
    if (!this.wsService) {
      this.wsService = new MassiveWebSocketService(this.apiKey, true, {
        onMessage: async (message) => {
          // Handle WebSocket messages and update cache
          // This would be called from the WebSocket service
          // Implementation depends on message format
        },
      });
    }

    this.wsService.subscribe(symbol);
    this.wsService.connect();

    return {
      unsubscribe: () => {
        if (this.wsService) {
          this.wsService.unsubscribe(symbol);
        }
      },
    };
  }
}

