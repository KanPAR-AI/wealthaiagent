// services/indexeddb.ts
// Central export for IndexedDB functionality

// Database
export { db, type WealthAIDatabase } from './db';

// Repositories
export {
  filesRepository,
  chatsRepository,
  messagesRepository,
  stocksRepository,
  portfolioRepository,
  marketRepository,
  apiCacheRepository,
  type BaseRepository,
  type CachedRepository,
} from './repositories';

// Configuration
export {
  STALE_TIMES,
  EXPIRY_TIMES,
  CACHE_LIMITS,
  CLEANUP_INTERVALS,
  getStaleTime,
  getExpiryTime,
  getCacheTimes,
  isOnline,
  DEFAULT_CACHE_OPTIONS,
} from './cache-config';

// Staleness utilities
export {
  checkFreshness,
  getCachedResult,
  isFresh,
  isStale,
  isExpired,
  canShowCached,
  needsRefetch,
  getTimeUntilStale,
  getTimeUntilExpiry,
  getCacheAge,
  formatCacheAge,
  getFreshnessPercentage,
} from '../utils/staleness-checker';

// Migration
export {
  migrateFileCache,
  deleteOldDatabase,
  runMigration,
  needsMigration,
  autoMigrate,
} from './db-migration';

// Types
export type {
  DataFreshness,
  CacheMetadata,
  SyncMetadata,
  CachedFile,
  CachedChat,
  CachedMessage,
  CachedStockData,
  StockDataPoint,
  CachedPortfolioData,
  PortfolioData,
  PortfolioHolding,
  PortfolioAllocation,
  PortfolioPerformance,
  CachedMarketData,
  MarketDataContent,
  MarketIndex,
  MarketNews,
  MarketSector,
  ApiCacheEntry,
  CachedResult,
  CacheHookOptions,
  CacheHookResult,
  PaginationOptions,
  PaginatedResult,
} from '../types/db';

