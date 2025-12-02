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
  fromDate?: number; // Timestamp in ms
  toDate?: number; // Timestamp in ms
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
    fromDate,
    toDate,
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
  const fetchingRef = useRef<boolean>(false); // Prevent duplicate concurrent calls
  const fetchStockDataRef = useRef<((forceRefresh: boolean) => Promise<void>) | null>(null); // Store latest fetch function
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null); // For request debouncing
  const lastFetchTimeRef = useRef<number>(0); // Track last fetch time for debouncing
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Timeout protection for stuck loading states

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

  // Fetch stock data with debouncing to prevent excessive calls
  const fetchStockData = useCallback(async (forceRefresh: boolean = false) => {
    if (!symbol || !serviceRef.current) {
      console.log('[useStockData] Skipping fetch - no symbol or service:', { symbol, hasService: !!serviceRef.current });
      setIsLoading(false);
      fetchingRef.current = false;
      return;
    }

    // Prevent multiple simultaneous calls for the same symbol
    if (fetchingRef.current) {
      console.log(`[useStockData] Already fetching ${symbol}, skipping duplicate call`);
      return;
    }

    // Debounce: prevent rapid successive calls (minimum 500ms between calls)
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    if (timeSinceLastFetch < 500 && !forceRefresh) {
      console.log(`[useStockData] Debouncing fetch for ${symbol} - too soon since last call`);
      // Clear any existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      // Schedule fetch after debounce period
      debounceTimerRef.current = setTimeout(() => {
        fetchStockDataRef.current?.(forceRefresh);
      }, 500 - timeSinceLastFetch);
      return;
    }
    
    fetchingRef.current = true;
    lastFetchTimeRef.current = now;

    console.log(`[useStockData] Fetching data for ${symbol}`, { forceRefresh, useCache });

    try {
      setIsLoading(true);
      setError(null);

      // Set timeout protection - if loading takes more than 30 seconds, reset
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      loadingTimeoutRef.current = setTimeout(() => {
        if (fetchingRef.current) {
          console.warn(`[useStockData] Loading timeout for ${symbol} - resetting state`);
          fetchingRef.current = false;
          setIsLoading(false);
          setError(new Error('Request timeout - took too long'));
        }
      }, 30000); // 30 second timeout

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
        fromDate,
        toDate,
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
      
      // Clear timeout on success
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    } catch (err) {
      console.error(`[useStockData] Error fetching ${symbol}:`, err);
      setError(err as Error);
      setIsLoading(false);
      
      // Clear timeout on error
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }

      // Try to use cached data as fallback
      if (useCache) {
        try {
          const cached = await stocksRepository.getStock(symbol);
          if (cached) {
            setQuote(cached.data);
            setSparkline(cached.sparkline || []);
            setSource('cache');
            setIsCached(true);
            setIsStaleData(true);
          }
        } catch (cacheError) {
          console.error(`[useStockData] Error reading cache:`, cacheError);
        }
      }
    } finally {
      // Always reset fetchingRef in finally block to ensure cleanup
      fetchingRef.current = false;
    }
  }, [symbol, preferWebSocket, useCache, sparklineTimeframe, sparklineDays, fromDate, toDate]);

  // Store latest fetchStockData in ref for use in intervals
  useEffect(() => {
    fetchStockDataRef.current = fetchStockData;
  }, [fetchStockData]);

  // Initial fetch - only when dependencies actually change
  // Use ref to prevent dependency on fetchStockData
  useEffect(() => {
    if (symbol) {
      // Clear any pending debounce
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      fetchStockData(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, sparklineTimeframe, sparklineDays, fromDate, toDate]); // Refetch when time range changes

  // Auto-refresh - use ref to avoid recreating interval on every fetchStockData change
  useEffect(() => {
    if (autoRefresh && symbol && refreshInterval > 0) {
      // Clear existing interval
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }

      refreshTimerRef.current = setInterval(() => {
        // Use ref to get latest fetchStockData function
        if (fetchStockDataRef.current && !fetchingRef.current) {
          fetchStockDataRef.current(true);
        }
      }, refreshInterval);

      return () => {
        if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
      };
    }
  }, [autoRefresh, symbol, refreshInterval]); // Don't include fetchStockData in deps

  // Manual refresh function - use ref to avoid dependency issues
  const refresh = useCallback(async () => {
    if (fetchStockDataRef.current) {
      await fetchStockDataRef.current(true);
    }
  }, []); // No dependencies - uses ref

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      fetchingRef.current = false;
    };
  }, []);

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

