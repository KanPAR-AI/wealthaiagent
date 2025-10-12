// services/cache-config.ts
// Cache configuration for stale times and expiry times

/**
 * Stale time configurations (in milliseconds)
 * After this time, data is considered stale and should be refetched in background
 */
export const STALE_TIMES = {
  // Files
  files: 7 * 24 * 60 * 60 * 1000,           // 7 days
  
  // Chat data
  chatList: 5 * 60 * 1000,                  // 5 minutes
  chatMessages: 10 * 60 * 1000,             // 10 minutes
  chatHistory: 10 * 60 * 1000,              // 10 minutes
  
  // Financial data - Real-time
  stockRealtime: 30 * 1000,                 // 30 seconds
  stockIntraday: 5 * 60 * 1000,             // 5 minutes
  stockHistorical: 60 * 60 * 1000,          // 1 hour
  stockDaily: 24 * 60 * 60 * 1000,          // 1 day
  
  // Portfolio data
  portfolio: 5 * 60 * 1000,                 // 5 minutes
  portfolioHoldings: 5 * 60 * 1000,         // 5 minutes
  portfolioPerformance: 5 * 60 * 1000,      // 5 minutes
  
  // Market data
  indices: 60 * 1000,                       // 1 minute
  news: 15 * 60 * 1000,                     // 15 minutes
  sectors: 5 * 60 * 1000,                   // 5 minutes
  marketTrends: 10 * 60 * 1000,             // 10 minutes
  
  // Generic API cache
  default: 10 * 60 * 1000,                  // 10 minutes
} as const;

/**
 * Expiry time configurations (in milliseconds)
 * After this time, data is considered expired and must be refetched
 * Typically 2-3x the stale time
 */
export const EXPIRY_TIMES = {
  // Files
  files: 30 * 24 * 60 * 60 * 1000,          // 30 days
  
  // Chat data
  chatList: 30 * 60 * 1000,                 // 30 minutes
  chatMessages: 60 * 60 * 1000,             // 1 hour
  chatHistory: 60 * 60 * 1000,              // 1 hour
  
  // Financial data
  stockRealtime: 5 * 60 * 1000,             // 5 minutes
  stockIntraday: 30 * 60 * 1000,            // 30 minutes
  stockHistorical: 24 * 60 * 60 * 1000,     // 1 day
  stockDaily: 7 * 24 * 60 * 60 * 1000,      // 7 days
  
  // Portfolio data
  portfolio: 30 * 60 * 1000,                // 30 minutes
  portfolioHoldings: 30 * 60 * 1000,        // 30 minutes
  portfolioPerformance: 30 * 60 * 1000,     // 30 minutes
  
  // Market data
  indices: 10 * 60 * 1000,                  // 10 minutes
  news: 2 * 60 * 60 * 1000,                 // 2 hours
  sectors: 30 * 60 * 1000,                  // 30 minutes
  marketTrends: 60 * 60 * 1000,             // 1 hour
  
  // Generic API cache
  default: 60 * 60 * 1000,                  // 1 hour
} as const;

/**
 * Cache size limits
 */
export const CACHE_LIMITS = {
  // File cache
  maxFileSize: 100 * 1024 * 1024,           // 100MB total
  maxFileSizePerFile: 50 * 1024 * 1024,     // 50MB per file
  
  // Message cache
  maxMessagesPerChat: 500,                  // Keep last 500 messages per chat
  
  // Generic cache
  maxApiCacheEntries: 1000,                 // Max API cache entries
  
  // Database size
  maxDatabaseSize: 500 * 1024 * 1024,       // 500MB total database size
} as const;

/**
 * Cache cleanup intervals
 */
export const CLEANUP_INTERVALS = {
  files: 60 * 60 * 1000,                    // 1 hour
  messages: 24 * 60 * 60 * 1000,            // 1 day
  apiCache: 60 * 60 * 1000,                 // 1 hour
  all: 24 * 60 * 60 * 1000,                 // 1 day (full cleanup)
} as const;

/**
 * Get stale time for a specific cache type
 */
export function getStaleTime(type: keyof typeof STALE_TIMES): number {
  return STALE_TIMES[type] || STALE_TIMES.default;
}

/**
 * Get expiry time for a specific cache type
 */
export function getExpiryTime(type: keyof typeof EXPIRY_TIMES): number {
  return EXPIRY_TIMES[type] || EXPIRY_TIMES.default;
}

/**
 * Calculate stale and expiry timestamps from now
 */
export function getCacheTimes(type: keyof typeof STALE_TIMES): {
  staleAfter: number;
  expiresAt: number;
  cachedAt: number;
} {
  const now = Date.now();
  return {
    cachedAt: now,
    staleAfter: now + getStaleTime(type),
    expiresAt: now + getExpiryTime(type),
  };
}

/**
 * Check if we're online
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Default cache hook options
 */
export const DEFAULT_CACHE_OPTIONS = {
  refetchOnStale: true,
  refetchOnMount: false,
  refetchOnReconnect: true,
  refetchInterval: 0,
  enabled: true,
} as const;

