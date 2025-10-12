# IndexedDB with Dexie.js - Usage Guide

## ✅ Implementation Complete!

The complete IndexedDB caching system with Dexie.js has been successfully implemented. This guide shows you how to use it.

---

## 📁 **What Was Built**

### **Core Infrastructure**
✅ **Dexie Database** (`src/services/db.ts`) - 7 tables with optimized indexes  
✅ **Type Definitions** (`src/types/db.ts`) - Full TypeScript support  
✅ **Cache Configuration** (`src/services/cache-config.ts`) - Stale time settings  
✅ **Staleness Checker** (`src/utils/staleness-checker.ts`) - Freshness validation  

### **Repository Pattern** (7 Repositories)
✅ **Base Repository** - Common CRUD operations  
✅ **Files Repository** - File blob caching  
✅ **Chats Repository** - Chat session management  
✅ **Messages Repository** - Message caching with pagination  
✅ **Stocks Repository** - Real-time stock data  
✅ **Portfolio Repository** - User portfolio data  
✅ **Market Repository** - Indices, news, sectors  
✅ **API Cache Repository** - Generic API caching  

### **React Hooks**
✅ **useCachedFile** - File caching with instant previews  
✅ **useCachedMessages** - Message caching with background sync  

### **Migration & Tools**
✅ **Migration Script** - Auto-migrate old file cache  
✅ **Cache Inspector UI** - Debug and monitor cache  

---

## 🚀 **Quick Start**

### **1. Using File Caching**

```typescript
import { useCachedFile } from '@/hooks/use-cached-file-new';

function FilePreview({ file, token }) {
  const { blobUrl, isLoading, error } = useCachedFile(file, token);
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading file</div>;
  
  return <img src={blobUrl} alt={file.name} />;
}
```

**Features:**
- ✨ Instant previews for cached files
- 🔄 Auto-fetches from backend if not cached
- 🧹 Automatic memory cleanup (blob URLs)
- 📏 Smart cache size management (100MB limit)

---

### **2. Using Message Caching**

```typescript
import { useCachedMessages } from '@/hooks/use-cached-messages';

function ChatComponent({ chatId }) {
  const {
    messages,
    isLoading,
    isStale,
    hasMore,
    loadMore,
    addMessage,
    updateMessage,
  } = useCachedMessages(chatId, {
    limit: 50,
    enableBackgroundSync: true,
    onStaleData: () => console.log('Data is stale, refetching...'),
  });

  if (isLoading) return <div>Loading messages...</div>;

  return (
    <div>
      {messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {hasMore && <button onClick={loadMore}>Load More</button>}
      {isStale && <div className="text-yellow-500">Refreshing...</div>}
    </div>
  );
}
```

---

### **3. Using Stock Data**

```typescript
import { stocksRepository } from '@/services/repositories';
import { useEffect, useState } from 'react';

function StockPrice({ symbol }) {
  const [stock, setStock] = useState(null);
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    async function loadStock() {
      // Check cache first
      const cached = await stocksRepository.getStock(symbol);
      
      if (cached) {
        setStock(cached);
        
        // Check if data is stale
        if (isStale(cached)) {
          setIsStale(true);
          // Refetch in background
          fetchFromAPI();
        }
      } else {
        // Not in cache, fetch from API
        fetchFromAPI();
      }
    }

    async function fetchFromAPI() {
      const data = await fetch(`/api/stocks/${symbol}`).then(r => r.json());
      await stocksRepository.cacheStock(symbol, data, 'api', 30000); // 30s stale time
      setStock(data);
      setIsStale(false);
    }

    loadStock();
  }, [symbol]);

  return (
    <div>
      {isStale && <span className="text-yellow-500">Updating...</span>}
      <div>Price: ${stock?.data.price}</div>
      <div>Change: {stock?.data.changePercent}%</div>
    </div>
  );
}
```

---

### **4. Using Portfolio Data**

```typescript
import { portfolioRepository } from '@/services/repositories';

async function cacheUserPortfolio(userId: string) {
  // Fetch from API
  const response = await fetch(`/api/portfolio/${userId}`);
  const data = await response.json();

  // Cache holdings
  await portfolioRepository.cachePortfolio(userId, 'holdings', {
    holdings: data.holdings,
  });

  // Cache allocation
  await portfolioRepository.cachePortfolio(userId, 'allocation', {
    allocation: data.allocation,
  });

  // Cache performance
  await portfolioRepository.cachePortfolio(userId, 'performance', {
    performance: data.performance,
  });
}

async function getPortfolioData(userId: string) {
  const data = await portfolioRepository.getAllData(userId);
  return data;
}
```

---

### **5. Using Market Data**

```typescript
import { marketRepository } from '@/services/repositories';

// Cache market index
async function cacheMarketIndex() {
  await marketRepository.cacheIndex('SPY', {
    name: 'S&P 500',
    value: 4500,
    change: 25,
    changePercent: 0.56,
  });
}

// Cache market news
async function cacheMarketNews() {
  const news = await fetch('/api/news').then(r => r.json());
  await marketRepository.cacheNews(news);
}

// Get latest news
async function getLatestNews() {
  const news = await marketRepository.getLatestNews(10);
  return news;
}
```

---

### **6. Using Generic API Cache**

```typescript
import { apiCacheRepository } from '@/services/repositories';

async function cachedApiCall(endpoint: string, params: any = {}) {
  // Check cache first
  const cached = await apiCacheRepository.getCachedResponse(endpoint, params);
  
  if (cached && isFresh(cached)) {
    console.log('Using cached response');
    return cached.response;
  }

  // Fetch from API
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  
  const data = await response.json();

  // Cache the response
  await apiCacheRepository.cacheResponse(
    endpoint,
    'GET',
    params,
    data,
    response.status,
    { staleTimeMs: 300000 } // 5 minutes
  );

  return data;
}

// Usage
const users = await cachedApiCall('/api/users', { page: 1, limit: 20 });
```

---

## 📊 **Cache Configuration**

### **Stale Times** (`src/services/cache-config.ts`)

```typescript
{
  files: 7 days,
  chatList: 5 minutes,
  chatMessages: 10 minutes,
  stockRealtime: 30 seconds,
  portfolio: 5 minutes,
  indices: 1 minute,
  news: 15 minutes,
  sectors: 5 minutes,
  default: 10 minutes,
}
```

### **Expiry Times** (3x stale time)
```typescript
{
  files: 30 days,
  chatMessages: 1 hour,
  stockRealtime: 5 minutes,
  portfolio: 30 minutes,
  news: 2 hours,
  default: 1 hour,
}
```

---

## 🔧 **Cache Inspector UI**

Access the cache inspector by adding to your debug page:

```typescript
import { CacheInspector } from '@/components/debug/cache-inspector';

function DebugPage() {
  return (
    <div>
      <h1>Debug Tools</h1>
      <CacheInspector />
    </div>
  );
}
```

**Features:**
- 📊 View cache statistics for all tables
- 🧹 Clear cache by table or all
- 🔄 Run migration from old file cache
- 🗑️ Cleanup expired entries
- 📈 Monitor cache hit rates

---

## 🔄 **Migration**

The migration script automatically runs on app start and migrates data from the old `FileCacheDB` to the new `WealthAIDB`.

**Manual Migration:**
```typescript
import { runMigration } from '@/services/db-migration';

const result = await runMigration({ deleteOldDb: true });
console.log(`Migrated ${result.filesCount} files in ${result.duration}ms`);
```

---

## 📚 **Repository API Reference**

### **Files Repository**

```typescript
import { filesRepository } from '@/services/repositories';

// Cache a file
await filesRepository.cacheFile(url, blob, fileInfo, {
  messageId: 'msg-123',
  chatId: 'chat-456',
});

// Get file by URL
const file = await filesRepository.getByUrl(url);

// Get blob URL for preview
const blobUrl = await filesRepository.getBlobUrl(url);

// Get files by chat
const chatFiles = await filesRepository.getByChatId(chatId);

// Delete files by chat
await filesRepository.deleteByChatId(chatId);

// Get cache size
const size = await filesRepository.getTotalSize();

// Get stats
const stats = await filesRepository.getStats();
```

### **Chats Repository**

```typescript
import { chatsRepository } from '@/services/repositories';

// Cache a chat
await chatsRepository.cacheChat({
  id: 'chat-123',
  title: 'My Chat',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T12:00:00Z',
  userId: 'user-456',
  messageCount: 10,
  lastMessage: {},
  isFavorite: false,
});

// Get chats by user
const userChats = await chatsRepository.getByUserId(userId);

// Get recent chats
const recent = await chatsRepository.getRecent(20);

// Toggle favorite
await chatsRepository.toggleFavorite(chatId);

// Update title
await chatsRepository.updateTitle(chatId, 'New Title');

// Soft delete
await chatsRepository.softDelete(chatId);

// Get dirty chats (need sync)
const dirty = await chatsRepository.getDirtyChats();
```

### **Messages Repository**

```typescript
import { messagesRepository } from '@/services/repositories';

// Cache a message
await messagesRepository.cacheMessage({
  id: 'msg-123',
  message: 'Hello World',
  sender: 'user',
  timestamp: '2025-01-01T12:00:00Z',
  chatId: 'chat-456',
  files: [],
  status: 'sent',
});

// Get messages by chat
const messages = await messagesRepository.getByChatId(chatId, {
  limit: 50,
  offset: 0,
  orderDirection: 'asc',
});

// Add local message
await messagesRepository.addLocalMessage(message, chatId);

// Update message content
await messagesRepository.updateMessageContent(messageId, {
  message: 'Updated content',
});

// Mark as synced
await messagesRepository.markAsSynced(messageId);

// Get local-only messages
const localOnly = await messagesRepository.getLocalOnlyMessages(chatId);

// Delete by chat
await messagesRepository.deleteByChatId(chatId);
```

---

## 🎯 **Best Practices**

### **1. Always Check Freshness**
```typescript
import { isFresh, isStale } from '@/utils/staleness-checker';

const cached = await repository.get(id);

if (isFresh(cached)) {
  // Use cached data immediately
  return cached;
} else if (isStale(cached)) {
  // Return cached data but refetch in background
  fetchInBackground();
  return cached;
} else {
  // Data expired or missing, must fetch
  return await fetchFromAPI();
}
```

### **2. Use Optimistic Updates**
```typescript
// Update UI immediately
setMessages(prev => [...prev, newMessage]);

// Save to cache
await messagesRepository.addLocalMessage(newMessage, chatId);

// Sync with backend (background)
syncWithBackend(newMessage);
```

### **3. Clean Up Regularly**
```typescript
// Run cleanup on app start
db.cleanupExpired();

// Clean up specific table
filesRepository.deleteExpired();

// Clean up old messages
messagesRepository.cleanupOldMessagesForChat(chatId);
```

### **4. Handle Offline State**
```typescript
if (!navigator.onLine) {
  // Use cached data only
  const cached = await repository.get(id);
  return cached;
} else {
  // Normal flow with freshness check
  return await getDataWithFreshness(id);
}
```

---

## 🧪 **Testing**

All repositories and hooks can be tested using the Cache Inspector UI:

1. Go to `/logs` page
2. Add `<CacheInspector />` component
3. View stats, clear cache, run migration
4. Monitor cache behavior in real-time

---

## 📖 **Documentation Files**

- **Implementation Plan**: `file-caching.md`
- **Usage Guide** (this file): `indexeddb-usage-guide.md`
- **Type Definitions**: `src/types/db.ts`
- **Cache Config**: `src/services/cache-config.ts`
- **Repository Index**: `src/services/repositories/index.ts`

---

## 🎉 **Summary**

You now have a complete, production-ready IndexedDB caching system with:

✅ **7 Specialized Repositories** for different data types  
✅ **Stale-While-Revalidate** for optimal UX  
✅ **Automatic Migration** from old cache  
✅ **React Hooks** for easy integration  
✅ **Cache Inspector** for debugging  
✅ **TypeScript Support** throughout  
✅ **Smart Cache Management** (LRU, size limits, expiry)  
✅ **Offline Support** ready  

Start using it by importing the repositories or hooks and enjoy instant, offline-first performance! 🚀

