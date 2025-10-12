# 📋 **IndexedDB Implementation Plan with Dexie.js**
## Aligned with Existing Types & API Structure

---

## **Current State Analysis**

### ✅ **What We Have**
- Dexie.js v4.2.1 + dexie-react-hooks v4.2.0 installed
- React 19 ready
- Existing raw IndexedDB file cache (to be migrated)
- Well-defined TypeScript types in `src/types/chat.ts`
- Zustand store for in-memory state
- Backend API at `chatbackend.yourfinadvisor.com`

### 📊 **Existing Type Structures**
```typescript
// From src/types/chat.ts
Message {
  id, message, sender, timestamp, files, 
  isLoading, isStreaming, streamingContent, streamingChunks,
  error, structuredContent, widgets, contentBlocks
}

Chat {
  id, title, date, isFavorite
}

MessageFile {
  name, type, size, url
}

// From backend API (chat-service.ts)
ChatResponse {
  chat: { id, title, createdAt, updatedAt, userId, messageCount, lastMessage },
  messages: ChatMessage[],
  hasMoreMessages
}
```

---

## **Phase 1: Database Schema Design**

### **1.1 Dexie Database Structure**

```typescript
// src/services/db.ts
Database: "WealthAIDB"
Version: 1

Tables:
├── files           // File blobs (migrate from existing)
├── chats           // Chat sessions metadata
├── messages        // Individual chat messages
├── stockData       // Stock market data
├── portfolioData   // User portfolio data
├── marketData      // Market indices, news, sectors
└── apiCache        // Generic API response cache
```

---

## **Phase 2: Detailed Schema Definitions**

### **2.1 Files Table** (Migrating Existing)
```typescript
interface CachedFile {
  // Primary key
  id: string;                    // Primary key (generated)
  url: string;                   // Indexed (unique)
  
  // File data
  blob: Blob;
  name: string;
  type: string;
  size: number;
  
  // Cache metadata
  cachedAt: number;              // Indexed (for LRU)
  expiresAt: number;             // Indexed (for cleanup)
  lastAccessedAt: number;
  accessCount: number;
  
  // Relationships
  messageId?: string;            // Link to message
  chatId?: string;               // Link to chat
}

// Dexie Schema
files: '++id, url, cachedAt, expiresAt, messageId, chatId'
```

---

### **2.2 Chats Table** (Aligned with Backend + Local State)
```typescript
interface CachedChat {
  // Primary key (matches backend)
  id: string;                    // Primary key
  
  // Chat metadata (from backend ChatResponse.chat)
  title: string;
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp (indexed)
  userId: string;                // Indexed
  messageCount: number;
  lastMessage: any;              // Last message object
  
  // Local-only fields
  isFavorite: boolean;           // Indexed (for filtering)
  
  // Sync metadata
  cachedAt: number;              // Indexed (when cached locally)
  syncedAt: number;              // Last successful sync
  staleAfter: number;            // Timestamp when data becomes stale
  isDirty: boolean;              // Has unsaved local changes
  
  // Offline support
  deletedLocally: boolean;       // Soft delete flag
  localChanges?: {               // Track local modifications
    title?: string;
    isFavorite?: boolean;
  };
}

// Dexie Schema
chats: 'id, updatedAt, userId, isFavorite, cachedAt, staleAfter, isDirty'
```

---

### **2.3 Messages Table** (Aligned with Message Type)
```typescript
interface CachedMessage {
  // Primary key (matches backend)
  id: string;                    // Primary key
  
  // Core message data (from Message interface)
  message: string;               // Text content
  sender: 'user' | 'bot';
  timestamp: string;             // ISO timestamp (indexed)
  
  // Relationships
  chatId: string;                // Indexed (compound with timestamp)
  
  // Attachments (from MessageFile[])
  files?: {
    name: string;
    type: string;
    size: number;
    url: string;
  }[];
  
  // Streaming state (UI-only, not cached)
  // isStreaming, streamingContent, streamingChunks - NOT stored
  
  // Rich content (stored as-is)
  structuredContent?: {
    contentType: 'graph' | 'table';
    // ... full AiGraphContent or AiTableContent
  };
  
  widgets?: {
    id: string;
    type: string;
    title?: string;
    data: any;
    config?: any;
    sourceUrl?: string;
  }[];
  
  contentBlocks?: (
    | { type: 'text'; content: string }
    | { type: 'widget'; widget: any }
  )[];
  
  // Error handling
  error?: string;
  
  // Backend sync metadata (from ChatMessage in chat-service.ts)
  status: string;
  metadata: any;
  
  // Cache metadata
  cachedAt: number;              // When cached locally
  syncedAt: number;              // Last successful sync
  isDirty: boolean;              // Has unsaved local changes
  
  // Offline support
  localOnly: boolean;            // Not yet sent to backend
  sendAttempts: number;          // Retry counter
}

// Dexie Schema
messages: 'id, [chatId+timestamp], chatId, sender, timestamp, cachedAt, isDirty, localOnly'
```

---

### **2.4 Stock Data Table**
```typescript
interface CachedStockData {
  // Primary key
  symbol: string;                // Primary key (e.g., 'AAPL', 'GOOGL')
  
  // Stock data
  data: {
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    marketCap?: number;
    high: number;
    low: number;
    open: number;
    close: number;
    // ... other stock fields
  };
  
  // Metadata
  source: string;                // API source (e.g., 'yahoo', 'alpha_vantage')
  lastUpdated: number;           // Indexed (when fetched)
  
  // Staleness configuration
  staleAfter: number;            // Custom stale time per symbol
  expiresAt: number;             // Hard expiry
  
  // Additional info
  metadata: {
    exchange?: string;
    currency?: string;
    lastRefreshAttempt?: number;
  };
}

// Dexie Schema
stockData: 'symbol, lastUpdated, staleAfter, expiresAt'

// Stale time: 30 seconds for real-time stocks
```

---

### **2.5 Portfolio Data Table**
```typescript
interface CachedPortfolioData {
  // Primary key
  id: string;                    // Primary key (generated)
  
  // User identification
  userId: string;                // Indexed
  
  // Portfolio type
  type: 'holdings' | 'allocation' | 'performance' | 'history';  // Indexed
  
  // Portfolio data (flexible structure)
  data: {
    holdings?: Array<{
      symbol: string;
      quantity: number;
      averagePrice: number;
      currentPrice: number;
      totalValue: number;
      gainLoss: number;
      gainLossPercent: number;
    }>;
    
    allocation?: Array<{
      category: string;
      value: number;
      percentage: number;
    }>;
    
    performance?: {
      totalValue: number;
      totalGainLoss: number;
      totalGainLossPercent: number;
      dayGainLoss: number;
      dayGainLossPercent: number;
    };
    
    // ... other portfolio structures
  };
  
  // Cache metadata
  lastUpdated: number;           // Indexed
  staleAfter: number;            // 5 minutes for portfolio
  expiresAt: number;
  
  // Sync state
  isDirty: boolean;
  syncedAt: number;
}

// Dexie Schema
portfolioData: 'id, userId, type, lastUpdated, staleAfter'

// Stale time: 5 minutes for portfolio data
```

---

### **2.6 Market Data Table**
```typescript
interface CachedMarketData {
  // Primary key
  id: string;                    // Primary key (generated)
  
  // Market data type
  type: 'index' | 'news' | 'sector' | 'trend';  // Indexed
  
  // Optional symbol/identifier
  symbol?: string;               // Indexed (for indices like 'SPY', 'DJI')
  
  // Market data (flexible structure)
  data: {
    // For indices
    index?: {
      name: string;
      value: number;
      change: number;
      changePercent: number;
    };
    
    // For news
    news?: Array<{
      id: string;
      title: string;
      summary: string;
      url: string;
      publishedAt: string;
      source: string;
    }>;
    
    // For sectors
    sector?: {
      name: string;
      performance: number;
      topStocks: string[];
    };
    
    // ... other market structures
  };
  
  // Cache metadata
  lastUpdated: number;           // Indexed
  staleAfter: number;            // Different per type
  expiresAt: number;
}

// Dexie Schema
marketData: 'id, type, symbol, lastUpdated, staleAfter'

// Stale times:
// - Indices: 1 minute
// - News: 15 minutes
// - Sectors: 5 minutes
```

---

### **2.7 API Cache Table** (Generic Catch-All)
```typescript
interface ApiCacheEntry {
  // Primary key (hash of endpoint + params)
  key: string;                   // Primary key
  
  // Request details
  endpoint: string;              // Indexed
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params: Record<string, any>;   // Query params or body
  
  // Cached response
  response: any;                 // Full API response
  statusCode: number;
  
  // HTTP cache headers
  etag?: string;
  lastModified?: string;
  
  // Cache metadata
  cachedAt: number;              // Indexed
  staleAfter: number;            // Custom per endpoint
  expiresAt: number;             // Indexed
  
  // Hit tracking
  hitCount: number;
  lastAccessedAt: number;
}

// Dexie Schema
apiCache: 'key, endpoint, cachedAt, expiresAt, lastAccessedAt'

// Use for any API endpoint not covered by specific tables
```

---

## **Phase 3: Staleness Strategy**

### **3.1 Data Freshness Levels**
```typescript
enum DataFreshness {
  FRESH = 'fresh',        // Within staleAfter time
  STALE = 'stale',        // Past staleAfter, within expiresAt
  EXPIRED = 'expired',    // Past expiresAt
  MISSING = 'missing'     // Not in cache
}
```

### **3.2 Stale Time Configuration**
```typescript
const STALE_TIMES = {
  // Files
  files: 7 * 24 * 60 * 60 * 1000,           // 7 days
  
  // Chat data
  chatList: 5 * 60 * 1000,                  // 5 minutes
  chatMessages: 10 * 60 * 1000,             // 10 minutes
  
  // Financial data
  stockRealtime: 30 * 1000,                 // 30 seconds
  stockHistorical: 60 * 60 * 1000,          // 1 hour
  portfolio: 5 * 60 * 1000,                 // 5 minutes
  
  // Market data
  indices: 60 * 1000,                       // 1 minute
  news: 15 * 60 * 1000,                     // 15 minutes
  sectors: 5 * 60 * 1000,                   // 5 minutes
  
  // Default
  default: 10 * 60 * 1000,                  // 10 minutes
};
```

### **3.3 Stale-While-Revalidate Flow**
```typescript
async function getCachedData<T>(key: string): Promise<{
  data: T | null;
  freshness: DataFreshness;
  shouldRefetch: boolean;
}> {
  const cached = await db.table.get(key);
  
  if (!cached) {
    return { data: null, freshness: 'missing', shouldRefetch: true };
  }
  
  const now = Date.now();
  
  if (now > cached.expiresAt) {
    return { data: null, freshness: 'expired', shouldRefetch: true };
  }
  
  if (now > cached.staleAfter) {
    return { data: cached.data, freshness: 'stale', shouldRefetch: true };
  }
  
  return { data: cached.data, freshness: 'fresh', shouldRefetch: false };
}

// Usage in hooks:
// 1. FRESH → return immediately, no refetch
// 2. STALE → return cached + refetch in background
// 3. EXPIRED → show loading + refetch
// 4. MISSING → show loading + fetch
```

---

## **Phase 4: Implementation Structure**

### **4.1 Core Files**
```
src/
├── services/
│   ├── db.ts                     ✅ Dexie database definition
│   ├── db-migration.ts           ✅ Migrate old file cache
│   ├── cache-config.ts           ✅ Stale time configurations
│   ├── staleness-checker.ts      ✅ Freshness checking logic
│   └── repositories/
│       ├── base-repository.ts    ✅ Base class with common methods
│       ├── files-repository.ts   ✅ File operations
│       ├── chats-repository.ts   ✅ Chat CRUD + sync
│       ├── messages-repository.ts ✅ Message CRUD + pagination
│       ├── stocks-repository.ts   ✅ Stock data caching
│       ├── portfolio-repository.ts ✅ Portfolio data caching
│       ├── market-repository.ts   ✅ Market data caching
│       └── api-cache-repository.ts ✅ Generic API cache
│
├── hooks/
│   ├── use-indexed-db.ts         ✅ Base DB hook
│   ├── use-cached-chat.ts        ✅ Chat with staleness
│   ├── use-cached-messages.ts    ✅ Messages with pagination
│   ├── use-stock-data.ts         ✅ Stock data with 30s stale
│   ├── use-portfolio-data.ts     ✅ Portfolio with 5min stale
│   ├── use-market-data.ts        ✅ Market indices/news
│   └── use-api-cache.ts          ✅ Generic API cache hook
│
├── types/
│   └── db.ts                     ✅ All database type definitions
│
└── utils/
    ├── cache-keys.ts             ✅ Generate cache keys
    └── db-utils.ts               ✅ Common DB utilities
```

---

## **Phase 5: Migration Path**

### **Step-by-Step Migration**
1. ✅ Create `src/services/db.ts` with Dexie schema
2. ✅ Create `src/types/db.ts` with all interfaces
3. ✅ Create repository pattern for files
4. ✅ Migrate existing file cache to Dexie
5. ✅ Update `useCachedFile` to use new repository
6. ✅ Add chat/message repositories
7. ✅ Create `useCachedMessages` hook
8. ✅ Update ChatWindow to use cached messages
9. ✅ Add stock/portfolio repositories
10. ✅ Create financial data hooks
11. ✅ Add generic API cache
12. ✅ Remove old `file-cache.ts`

---

## **Phase 6: Hook Examples**

### **6.1 useCachedMessages Hook**
```typescript
const { 
  messages,        // CachedMessage[]
  isLoading,       // Initial load
  isStale,         // Data is stale, refetching in background
  hasMore,         // More messages available
  loadMore,        // Load next page
  addMessage,      // Add new message
  updateMessage,   // Update existing message
  refetch,         // Force refresh
  error
} = useCachedMessages(chatId, {
  staleTime: 10 * 60 * 1000,    // 10 minutes
  limit: 50,
  enableBackgroundSync: true
});
```

### **6.2 useStockData Hook**
```typescript
const { 
  data,            // Stock data
  isLoading,       // Initial load
  isStale,         // Data is stale (>30s), refetching
  lastUpdated,     // Timestamp
  refetch,
  error
} = useStockData('AAPL', {
  staleTime: 30 * 1000,         // 30 seconds
  refetchOnStale: true,
  refetchInterval: 30 * 1000    // Poll every 30s
});
```

### **6.3 usePortfolioData Hook**
```typescript
const { 
  holdings,
  allocation,
  performance,
  isLoading,
  isStale,
  refetch
} = usePortfolioData(userId, {
  staleTime: 5 * 60 * 1000,     // 5 minutes
  refetchOnMount: true
});
```

---

## **Phase 7: Key Alignment Points**

### ✅ **Type Alignment**
- `CachedMessage` matches `Message` interface
- `CachedChat` extends `Chat` with sync metadata
- `MessageFile` used as-is in cached messages
- Backend `ChatResponse` structure preserved

### ✅ **API Integration**
- Cache `ChatResponse` directly from `fetchChatHistory`
- Store messages in normalized form
- Preserve backend timestamps and IDs
- Support `hasMoreMessages` pagination

### ✅ **State Management**
- Zustand for in-memory reactive state
- IndexedDB for persistent cache
- Sync layer between Zustand ↔ IndexedDB
- Optimistic updates with `isDirty` flag

### ✅ **Streaming Support**
- Don't cache streaming fields (`isStreaming`, `streamingChunks`)
- Cache final message after streaming completes
- Store `contentBlocks` for widget order preservation

---

## **Phase 8: Priority Roadmap**

### **🔴 Week 1: Core Setup**
1. ✅ Create Dexie database schema (`db.ts`)
2. ✅ Create all TypeScript interfaces (`types/db.ts`)
3. ✅ Create base repository pattern
4. ✅ Migrate file cache to Dexie
5. ✅ Update `useCachedFile` hook
6. ✅ Test file caching with existing components

### **🟡 Week 2: Chat & Messages**
7. ✅ Create chats/messages repositories
8. ✅ Implement `useCachedMessages` hook
9. ✅ Add staleness checking logic
10. ✅ Update ChatWindow to use cached messages
11. ✅ Test offline chat viewing
12. ✅ Add background sync for messages

### **🟢 Week 3: Financial Data**
13. ✅ Create stock/portfolio/market repositories
14. ✅ Implement financial data hooks
15. ✅ Add stale-while-revalidate for stocks
16. ✅ Test with real financial APIs
17. ✅ Add cache inspector UI (debug page)
18. ✅ Performance monitoring

### **⚪ Week 4: Advanced Features**
19. ✅ Add generic API cache
20. ✅ Implement offline queue
21. ✅ Add conflict resolution
22. ✅ Write comprehensive tests
23. ✅ Documentation and examples
24. ✅ Production deployment

---

## **Next Steps**

Ready to implement! Which phase should we start with?

**Option A**: Start with Phase 1 - Create the Dexie database schema  
**Option B**: Focus on chat/message caching first  
**Option C**: Start with stock data caching for testing  
**Option D**: Build everything step-by-step from Week 1  

Let me know and I'll start coding! 🚀

