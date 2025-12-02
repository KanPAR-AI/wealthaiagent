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
 * Falls back to this when WebSocket connections fail or market is closed
 * Uses aggregates endpoint for historical sparkline data
 */
export class MassiveRestApiService {
  private apiKey: string;
  // Based on Massive.com documentation: https://massive.com/docs/rest/stocks/aggregates/custom-bars
  // Aggregates endpoint: https://api.massive.com/v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}
  private baseUrl: string = 'https://api.massive.com';

  constructor(apiKey: string) {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Massive.com API key is required');
    }
    this.apiKey = apiKey.trim();
  }

  /**
   * Build authenticated request URL with API key as query parameter
   * Note: Massive.com may also support Authorization header - try both if query param fails
   */
  private buildUrl(endpoint: string): string {
    const url = new URL(endpoint, this.baseUrl);
    url.searchParams.set('apiKey', this.apiKey);
    return url.toString();
  }

  /**
   * Get headers with API key for Authorization header (alternative to query param)
   */
  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      // Try Authorization header as alternative (if query param doesn't work)
      // 'Authorization': `Bearer ${this.apiKey}`,
      // Or: 'X-API-Key': this.apiKey,
    };
  }

  /**
   * Get current stock quote from latest aggregate bar
   * DEPRECATED: Use getHistoricalBars and derive quote from it instead to avoid duplicate API calls
   * Keeping for backward compatibility but should not be used
   */
  async getQuote(symbol: string): Promise<MassiveStockQuote> {
    // This method is deprecated - it causes duplicate API calls
    // Instead, fetch historical bars once and derive quote from the latest bar
    throw new Error('getQuote() is deprecated. Use getHistoricalBars() and derive quote from latest bar instead.');
  }

  /**
   * Format date to YYYY-MM-DD for Massive API
   * Ensures dates are in the past (not future)
   */
  private formatDate(date: number | Date): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    // Ensure date is not in the future
    const now = new Date();
    const dateToUse = d > now ? now : d;
    
    const year = dateToUse.getFullYear();
    const month = String(dateToUse.getMonth() + 1).padStart(2, '0');
    const day = String(dateToUse.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Map timeframe to Massive API timespan
   */
  private mapTimeframe(timeframe: '1min' | '5min' | '15min' | '1hour' | '1day'): string {
    const mapping: Record<string, string> = {
      '1min': 'minute',
      '5min': 'minute', // Will use multiplier
      '15min': 'minute',
      '1hour': 'hour',
      '1day': 'day',
    };
    return mapping[timeframe] || 'minute';
  }

  /**
   * Get multiplier for timeframe
   */
  private getMultiplier(timeframe: '1min' | '5min' | '15min' | '1hour' | '1day'): number {
    const mapping: Record<string, number> = {
      '1min': 1,
      '5min': 5,
      '15min': 15,
      '1hour': 1,
      '1day': 1,
    };
    return mapping[timeframe] || 1;
  }

  /**
   * Get historical aggregate bars (for sparkline data)
   * Based on Massive.com REST API documentation: https://massive.com/docs/rest/stocks/aggregates/custom-bars
   * Endpoint: GET /v2/aggs/ticker/{stocksTicker}/range/{multiplier}/{timespan}/{from}/{to}
   */
  async getHistoricalBars(
    symbol: string,
    timeframe: '1min' | '5min' | '15min' | '1hour' | '1day' = '1min',
    from?: number,
    to?: number,
    limit: number = 10000 // Reasonable default - will be overridden by calculated limit
  ): Promise<MassiveHistoricalData> {
    try {
      const symbolUpper = symbol.toUpperCase();
      const fromTime = from || Date.now() - (7 * 24 * 60 * 60 * 1000); // Default: 7 days ago
      const toTime = to || Date.now();

      // Format dates as YYYY-MM-DD
      const fromDate = this.formatDate(fromTime);
      const toDate = this.formatDate(toTime);

      // Map timeframe to Massive API format
      const timespan = this.mapTimeframe(timeframe);
      const multiplier = this.getMultiplier(timeframe);

      // Build endpoint: /v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}
      // baseUrl is https://api.massive.com, so endpointPath should be v2/aggs/...
      const endpointPath = `v2/aggs/ticker/${symbolUpper}/range/${multiplier}/${timespan}/${fromDate}/${toDate}`;
      const url = new URL(endpointPath, this.baseUrl);
      
      // Add API key as query parameter
      url.searchParams.set('apiKey', this.apiKey);
      url.searchParams.set('sort', 'asc'); // Sort ascending by timestamp
      url.searchParams.set('limit', limit.toString());

      const urlString = url.toString().replace(this.apiKey, '***');
      console.log('[MassiveRestApi] Fetching historical bars from:', urlString);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[MassiveRestApi] API request failed: ${response.status} ${response.statusText}`, errorText);
        
        if (response.status === 404) {
          throw new Error(
            `Endpoint not found (404). The endpoint path "${endpointPath}" may be incorrect. ` +
            `Please check Massive.com REST API documentation at https://massive.com/docs/rest/stocks/aggregates/custom-bars`
          );
        }
        
        throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorText}`);
      }

      const data = await response.json();
      console.log('[MassiveRestApi] Historical bars response:', {
        ticker: data.ticker,
        resultsCount: data.results?.length || 0,
      });
      
      // Transform Massive API response to our format
      // Response format: { ticker: "AAPL", results: [{ t, o, h, l, c, v, vw }, ...] }
      const bars: MassiveAggregateBar[] = (data.results || []).map((bar: any) => ({
        o: bar.o || 0, // Open
        c: bar.c || 0, // Close
        h: bar.h || 0, // High
        l: bar.l || 0, // Low
        v: bar.v || 0, // Volume
        t: bar.t || Date.now(), // Timestamp (ms)
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

