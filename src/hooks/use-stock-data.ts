// hooks/use-stock-data.ts
// React hook for fetching stock data with WebSocket + REST fallback + caching

import { useState, useEffect, useCallback, useRef } from 'react';
import { StockDataService, StockDataServiceOptions, StockDataResult } from '@/services/stock-data-service';
import { stocksRepository } from '@/services/repositories';
import { StockDataPoint } from '@/types/db';
import { SparklinePoint } from '@/types/trade';
import { isFresh, isStale } from '@/utils/staleness-checker';
import { env } from '@/config/environment';

interface UseStockDataOptions {
  symbol: string | null;
  preferWebSocket?: boolean;
  useCache?: boolean;
  sparklineTimeframe?: '1min' | '5min' | '15min' | '1hour' | '1day';
  sparklineDays?: number;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
}

interface UseStockDataResult {
  quote: StockDataPoint | null;
  sparkline: SparklinePoint[];
  isLoading: boolean;
  error: Error | null;
  source: 'websocket' | 'rest' | 'cache' | null;
  isCached: boolean;
  isStale: boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching stock data with automatic fallback and caching
 */
export function useStockData(options: UseStockDataOptions): UseStockDataResult {
  const {
    symbol,
    preferWebSocket = true,
    useCache = true,
    sparklineTimeframe = '1min',
    sparklineDays = 7,
    autoRefresh = false,
    refreshInterval = 60000, // 1 minute default
  } = options;

  const [quote, setQuote] = useState<StockDataPoint | null>(null);
  const [sparkline, setSparkline] = useState<SparklinePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [source, setSource] = useState<'websocket' | 'rest' | 'cache' | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [isStaleData, setIsStaleData] = useState(false);

  const serviceRef = useRef<StockDataService | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize service
  useEffect(() => {
    if (!env.massiveApiKey) {
      setError(new Error('Massive.com API key not configured'));
      setIsLoading(false);
      return;
    }

    if (!serviceRef.current) {
      serviceRef.current = new StockDataService(env.massiveApiKey);
    }
  }, []);

  // Fetch stock data
  const fetchStockData = useCallback(async (forceRefresh: boolean = false) => {
    if (!symbol || !serviceRef.current) {
      console.log('[useStockData] Skipping fetch - no symbol or service:', { symbol, hasService: !!serviceRef.current });
      setIsLoading(false);
      return;
    }

    console.log(`[useStockData] Fetching data for ${symbol}`, { forceRefresh, useCache });

    try {
      setIsLoading(true);
      setError(null);

      // Check cache first if not forcing refresh
      if (useCache && !forceRefresh) {
        const cached = await stocksRepository.getStock(symbol);
        if (cached) {
          const fresh = isFresh(cached);
          const stale = isStale(cached);

          if (fresh) {
            console.log(`[useStockData] Using fresh cached data for ${symbol}`);
            setQuote(cached.data);
            setSparkline(cached.sparkline || []);
            setSource('cache');
            setIsCached(true);
            setIsStaleData(false);
            setIsLoading(false);
            return;
          }

          if (stale) {
            console.log(`[useStockData] Using stale cached data for ${symbol}, refreshing...`);
            setQuote(cached.data);
            setSparkline(cached.sparkline || []);
            setSource('cache');
            setIsCached(true);
            setIsStaleData(true);
            // Continue to fetch fresh data
          }
        }
      }

      // Fetch fresh data
      console.log(`[useStockData] Calling getStockData for ${symbol}`);
      const result = await serviceRef.current.getStockData({
        apiKey: env.massiveApiKey!,
        symbol,
        preferWebSocket: preferWebSocket && !forceRefresh, // Don't try WebSocket on manual refresh
        useCache: false, // We already checked cache above
        sparklineTimeframe,
        sparklineDays,
      });

      console.log(`[useStockData] Got result for ${symbol}:`, {
        source: result.source,
        cached: result.cached,
        quotePrice: result.quote?.price,
        sparklinePoints: result.sparkline.length,
      });

      setQuote(result.quote);
      setSparkline(result.sparkline);
      setSource(result.source);
      setIsCached(result.cached);
      setIsStaleData(false);
      setIsLoading(false);
    } catch (err) {
      console.error(`[useStockData] Error fetching ${symbol}:`, err);
      setError(err as Error);
      setIsLoading(false);

      // Try to use cached data as fallback
      if (useCache) {
        const cached = await stocksRepository.getStock(symbol);
        if (cached) {
          setQuote(cached.data);
          setSparkline(cached.sparkline || []);
          setSource('cache');
          setIsCached(true);
          setIsStaleData(true);
        }
      }
    }
  }, [symbol, preferWebSocket, useCache, sparklineTimeframe, sparklineDays]);

  // Initial fetch
  useEffect(() => {
    fetchStockData(false);
  }, [symbol, sparklineTimeframe, sparklineDays]); // Only refetch if these change

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && symbol && refreshInterval > 0) {
      refreshTimerRef.current = setInterval(() => {
        fetchStockData(true);
      }, refreshInterval);

      return () => {
        if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current);
        }
      };
    }
  }, [autoRefresh, symbol, refreshInterval, fetchStockData]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    await fetchStockData(true);
  }, [fetchStockData]);

  return {
    quote,
    sparkline,
    isLoading,
    error,
    source,
    isCached,
    isStale: isStaleData,
    refresh,
  };
}

