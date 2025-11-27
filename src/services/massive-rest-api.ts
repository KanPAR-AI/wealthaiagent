// services/massive-rest-api.ts
// REST API service for Massive.com as fallback when WebSocket fails

import { env } from '@/config/environment';

export interface MassiveStockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  close: number;
  previousClose: number;
  timestamp: number;
}

export interface MassiveAggregateBar {
  o: number; // Open
  c: number; // Close
  h: number; // High
  l: number; // Low
  v: number; // Volume
  t: number; // Timestamp (Unix ms)
}

export interface MassiveHistoricalData {
  symbol: string;
  bars: MassiveAggregateBar[];
  timeframe: string; // e.g., '1min', '5min', '1hour', '1day'
}

/**
 * REST API client for Massive.com
 * Falls back to this when WebSocket connections fail
 */
export class MassiveRestApiService {
  private apiKey: string;
  // Based on Massive.com documentation: https://massive.com/docs/rest/quickstart
  // API key can be passed as query parameter or Authorization header
  private baseUrl: string = 'https://api.massive.com';

  constructor(apiKey: string) {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Massive.com API key is required');
    }
    this.apiKey = apiKey.trim();
  }

  /**
   * Build authenticated request URL with API key as query parameter
   */
  private buildUrl(endpoint: string): string {
    const url = new URL(endpoint, this.baseUrl);
    url.searchParams.set('apiKey', this.apiKey);
    return url.toString();
  }

  /**
   * Get current stock quote
   * Based on Massive.com REST API documentation
   * Endpoint: /v1/stocks/{symbol}/quote or similar
   * Check https://massive.com/docs/rest/stocks for exact endpoint
   */
  async getQuote(symbol: string): Promise<MassiveStockQuote> {
    try {
      // Based on Massive.com docs: https://massive.com/docs/rest/quickstart
      // Base URL: https://api.massive.com
      // API key as query parameter: ?apiKey=YOUR_API_KEY
      // Check https://massive.com/docs/rest/stocks for exact stock endpoints
      // Common patterns might be:
      // - /v1/stocks/{symbol}/quote
      // - /v1/stocks/{symbol}
      // - /stocks/{symbol}/quote
      const endpointPath = `/v1/stocks/${symbol.toUpperCase()}/quote`;
      const url = this.buildUrl(endpointPath);
      console.log('[MassiveRestApi] Fetching quote from:', url.replace(this.apiKey, '***'));
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[MassiveRestApi] API request failed: ${response.status} ${response.statusText}`, errorText);
        
        if (response.status === 404) {
          throw new Error(
            `Endpoint not found (404). The endpoint path "${endpointPath}" may be incorrect. ` +
            `Please check Massive.com REST API documentation at https://massive.com/docs/rest/stocks ` +
            `for the correct endpoint structure. The base URL is correct: ${this.baseUrl}`
          );
        }
        
        throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorText}`);
      }

      const data = await response.json();
      console.log('[MassiveRestApi] Quote response:', data);
      
      // Transform to our format (adjust based on actual API response)
      return {
        symbol: data.symbol || symbol.toUpperCase(),
        price: data.price || data.c || 0,
        change: data.change || 0,
        changePercent: data.changePercent || 0,
        volume: data.volume || data.v || 0,
        high: data.high || data.h || 0,
        low: data.low || data.l || 0,
        open: data.open || data.o || 0,
        close: data.close || data.c || 0,
        previousClose: data.previousClose || data.prevClose || 0,
        timestamp: data.timestamp || Date.now(),
      };
    } catch (error) {
      console.error('[MassiveRestApi] Error fetching quote:', error);
      throw error;
    }
  }

  /**
   * Get historical aggregate bars (for sparkline data)
   * Based on Massive.com REST API documentation
   * Check https://massive.com/docs/rest/stocks for exact endpoint and parameters
   */
  async getHistoricalBars(
    symbol: string,
    timeframe: '1min' | '5min' | '15min' | '1hour' | '1day' = '1min',
    from?: number,
    to?: number,
    limit: number = 1000
  ): Promise<MassiveHistoricalData> {
    try {
      const symbolUpper = symbol.toUpperCase();
      const fromTime = from || Date.now() - (7 * 24 * 60 * 60 * 1000); // Default: 7 days ago
      const toTime = to || Date.now();

      // Based on Massive.com docs: https://massive.com/docs/rest/quickstart
      // Check https://massive.com/docs/rest/stocks for exact historical data endpoints
      // Common patterns might be:
      // - /v1/stocks/{symbol}/bars
      // - /v1/stocks/{symbol}/aggregates
      // - /v1/stocks/{symbol}/trades (for trade data)
      const endpointPath = `/v1/stocks/${symbolUpper}/bars`;
      const url = new URL(endpointPath, this.baseUrl);
      
      // Add API key as query parameter (as per Massive.com docs)
      url.searchParams.set('apiKey', this.apiKey);
      
      // Add query parameters for historical data
      // Note: Parameter names may vary - check Massive.com docs for exact names
      url.searchParams.set('timeframe', timeframe);
      url.searchParams.set('from', fromTime.toString());
      url.searchParams.set('to', toTime.toString());
      url.searchParams.set('limit', limit.toString());

      const urlString = url.toString().replace(this.apiKey, '***');
      console.log('[MassiveRestApi] Fetching historical bars from:', urlString);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[MassiveRestApi] API request failed: ${response.status} ${response.statusText}`, errorText);
        
        if (response.status === 404) {
          throw new Error(
            `Endpoint not found (404). The endpoint path "${endpointPath}" may be incorrect. ` +
            `Please check Massive.com REST API documentation at https://massive.com/docs/rest/stocks ` +
            `for the correct endpoint structure. The base URL is correct: ${this.baseUrl}`
          );
        }
        
        throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorText}`);
      }

      const data = await response.json();
      console.log('[MassiveRestApi] Historical bars response:', data);
      
      // Transform to our format (adjust based on actual API response)
      const bars: MassiveAggregateBar[] = (data.bars || data.data || []).map((bar: any) => ({
        o: bar.o || bar.open || 0,
        c: bar.c || bar.close || 0,
        h: bar.h || bar.high || 0,
        l: bar.l || bar.low || 0,
        v: bar.v || bar.volume || 0,
        t: bar.t || bar.timestamp || bar.e || Date.now(), // Use end timestamp
      }));

      return {
        symbol: symbolUpper,
        bars,
        timeframe,
      };
    } catch (error) {
      console.error('[MassiveRestApi] Error fetching historical bars:', error);
      throw error;
    }
  }

  /**
   * Convert historical bars to sparkline format
   */
  static barsToSparkline(bars: MassiveAggregateBar[]): Array<{ t: number; v: number }> {
    return bars.map(bar => ({
      t: bar.t,
      v: bar.c, // Use close price
    })).sort((a, b) => a.t - b.t);
  }
}

