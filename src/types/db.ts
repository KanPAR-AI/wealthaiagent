// types/db.ts
// TypeScript interfaces for IndexedDB/Dexie tables

import { MessageFile, StructuredContent, Widget, ContentBlock } from './chat';

/**
 * Data freshness levels for cache staleness checking
 */
export enum DataFreshness {
  FRESH = 'fresh',        // Within staleAfter time
  STALE = 'stale',        // Past staleAfter, within expiresAt
  EXPIRED = 'expired',    // Past expiresAt
  MISSING = 'missing'     // Not in cache
}

/**
 * Base cache metadata fields
 */
export interface CacheMetadata {
  cachedAt: number;       // Timestamp when cached
  staleAfter: number;     // Timestamp when data becomes stale
  expiresAt: number;      // Timestamp when data expires
}

/**
 * Sync metadata fields
 */
export interface SyncMetadata {
  syncedAt: number;       // Last successful sync with backend
  isDirty: boolean;       // Has unsaved local changes
}

// ============================================================================
// FILES TABLE
// ============================================================================

/**
 * Cached file blob with metadata
 * Migrated from existing file-cache.ts
 */
export interface CachedFile extends CacheMetadata {
  // Primary key
  id: string;
  url: string;            // Indexed (unique)
  
  // File data
  blob: Blob;
  name: string;
  type: string;
  size: number;
  
  // Access tracking
  lastAccessedAt: number;
  accessCount: number;
  
  // Relationships
  messageId?: string;     // Link to message
  chatId?: string;        // Link to chat
}

// ============================================================================
// CHATS TABLE
// ============================================================================

/**
 * Cached chat session metadata
 * Aligned with backend ChatResponse.chat structure
 */
export interface CachedChat extends CacheMetadata, SyncMetadata {
  // Primary key (matches backend)
  id: string;
  
  // Chat metadata (from backend)
  title: string;
  createdAt: string;      // ISO timestamp
  updatedAt: string;      // ISO timestamp (indexed)
  userId: string;         // Indexed
  messageCount: number;
  lastMessage: any;       // Last message object
  
  // Local-only fields
  isFavorite: boolean;    // Indexed (for filtering)
  
  // Offline support
  deletedLocally: boolean; // Soft delete flag
  localChanges?: {        // Track local modifications
    title?: string;
    isFavorite?: boolean;
  };
}

// ============================================================================
// MESSAGES TABLE
// ============================================================================

/**
 * Cached chat message
 * Aligned with Message interface from types/chat.ts
 */
export interface CachedMessage extends CacheMetadata, SyncMetadata {
  // Primary key (matches backend)
  id: string;
  
  // Core message data (from Message interface)
  message: string;        // Text content
  sender: 'user' | 'bot';
  timestamp: string;      // ISO timestamp (indexed)
  
  // Relationships
  chatId: string;         // Indexed (compound with timestamp)
  
  // Attachments (from MessageFile[])
  files?: MessageFile[];
  
  // NOTE: Streaming state (isStreaming, streamingContent, streamingChunks)
  // is UI-only and NOT cached
  
  // Rich content (stored as-is)
  structuredContent?: StructuredContent;
  widgets?: Widget[];
  contentBlocks?: ContentBlock[];
  
  // Error handling
  error?: string;
  
  // Backend sync metadata (from ChatMessage in chat-service.ts)
  status: string;
  metadata: any;
  
  // Offline support
  localOnly: boolean;     // Not yet sent to backend
  sendAttempts: number;   // Retry counter
}

// ============================================================================
// STOCK DATA TABLE
// ============================================================================

/**
 * Stock market data
 * Real-time prices, changes, volume, etc.
 */
export interface StockDataPoint {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  high: number;
  low: number;
  open: number;
  close: number;
  previousClose?: number;
}

export interface CachedStockData extends CacheMetadata {
  // Primary key
  symbol: string;         // e.g., 'AAPL', 'GOOGL'
  
  // Stock data
  data: StockDataPoint;
  
  // Sparkline data (for charts)
  sparkline?: Array<{ t: number; v: number }>; // timestamp, value
  
  // Metadata
  source: string;         // API source (e.g., 'massive_websocket', 'massive_rest', 'yahoo')
  lastUpdated: number;    // Indexed
  
  // Additional info
  metadata: {
    exchange?: string;
    currency?: string;
    lastRefreshAttempt?: number;
    sparklineTimeframe?: string; // e.g., '1min', '5min', '1hour'
    sparklineFrom?: number; // Start timestamp
    sparklineTo?: number;   // End timestamp
  };
}

// ============================================================================
// PORTFOLIO DATA TABLE
// ============================================================================

/**
 * Portfolio holding
 */
export interface PortfolioHolding {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  totalValue: number;
  gainLoss: number;
  gainLossPercent: number;
}

/**
 * Portfolio allocation
 */
export interface PortfolioAllocation {
  category: string;
  value: number;
  percentage: number;
}

/**
 * Portfolio performance metrics
 */
export interface PortfolioPerformance {
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  dayGainLoss: number;
  dayGainLossPercent: number;
}

/**
 * Portfolio data structure
 */
export interface PortfolioData {
  holdings?: PortfolioHolding[];
  allocation?: PortfolioAllocation[];
  performance?: PortfolioPerformance;
  [key: string]: any; // Allow additional fields
}

/**
 * Cached portfolio data
 */
export interface CachedPortfolioData extends CacheMetadata, SyncMetadata {
  // Primary key
  id: string;
  
  // User identification
  userId: string;         // Indexed
  
  // Portfolio type
  type: 'holdings' | 'allocation' | 'performance' | 'history'; // Indexed
  
  // Portfolio data (flexible structure)
  data: PortfolioData;
  
  // Cache metadata
  lastUpdated: number;    // Indexed
}

// ============================================================================
// MARKET DATA TABLE
// ============================================================================

/**
 * Market index data
 */
export interface MarketIndex {
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

/**
 * Market news item
 */
export interface MarketNews {
  id: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: string;
  source: string;
  imageUrl?: string;
}

/**
 * Market sector data
 */
export interface MarketSector {
  name: string;
  performance: number;
  topStocks: string[];
}

/**
 * Market data structure
 */
export interface MarketDataContent {
  index?: MarketIndex;
  news?: MarketNews[];
  sector?: MarketSector;
  [key: string]: any; // Allow additional fields
}

/**
 * Cached market data
 */
export interface CachedMarketData extends CacheMetadata {
  // Primary key
  id: string;
  
  // Market data type
  type: 'index' | 'news' | 'sector' | 'trend'; // Indexed
  
  // Optional symbol/identifier
  symbol?: string;        // Indexed (for indices like 'SPY', 'DJI')
  
  // Market data (flexible structure)
  data: MarketDataContent;
  
  // Cache metadata
  lastUpdated: number;    // Indexed
}

// ============================================================================
// API CACHE TABLE
// ============================================================================

/**
 * Generic API cache entry
 * For caching any API endpoint not covered by specific tables
 */
export interface ApiCacheEntry extends CacheMetadata {
  // Primary key (hash of endpoint + params)
  key: string;
  
  // Request details
  endpoint: string;       // Indexed
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params: Record<string, any>; // Query params or body
  
  // Cached response
  response: any;          // Full API response
  statusCode: number;
  
  // HTTP cache headers
  etag?: string;
  lastModified?: string;
  
  // Hit tracking
  hitCount: number;
  lastAccessedAt: number;
}

// ============================================================================
// QUERY RESULT TYPES
// ============================================================================

/**
 * Result from cache query with freshness info
 */
export interface CachedResult<T> {
  data: T | null;
  freshness: DataFreshness;
  shouldRefetch: boolean;
  lastUpdated?: number;
}

/**
 * Hook options for cache behavior
 */
export interface CacheHookOptions {
  staleTime?: number;             // Time before data is considered stale
  expiryTime?: number;            // Time before data expires
  refetchOnStale?: boolean;       // Refetch in background when stale
  refetchOnMount?: boolean;       // Refetch when component mounts
  refetchOnReconnect?: boolean;   // Refetch when network reconnects
  refetchInterval?: number;       // Poll interval (0 = disabled)
  enabled?: boolean;              // Enable/disable fetching
}

/**
 * Hook result with loading/error states
 */
export interface CacheHookResult<T> {
  data: T | null;
  isLoading: boolean;
  isStale: boolean;
  isFetching: boolean;
  error: Error | null;
  lastUpdated: number | null;
  refetch: () => void;
}

// ============================================================================
// REPOSITORY TYPES
// ============================================================================

/**
 * Pagination options
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextOffset?: number;
}

