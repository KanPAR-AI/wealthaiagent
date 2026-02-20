// components/debug/cache-inspector.tsx
// Cache inspector UI for debugging IndexedDB cache

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { db } from '@/services/db';
import {
  filesRepository,
  chatsRepository,
  messagesRepository,
  stocksRepository,
  portfolioRepository,
  marketRepository,
  apiCacheRepository,
} from '@/services/repositories';
import { formatCacheAge } from '@/utils/staleness-checker';
import { runMigration, needsMigration } from '@/services/db-migration';

interface CacheStats {
  files: {
    count: number;
    size: number;
    averageSize: number;
  };
  chats: {
    count: number;
    favorites: number;
    dirty: number;
    deleted: number;
  };
  messages: {
    count: number;
    byChat: Record<string, number>;
  };
  stocks: {
    count: number;
    gainers: number;
    losers: number;
  };
  portfolio: {
    count: number;
    byType: Record<string, number>;
  };
  market: {
    count: number;
    indices: number;
    news: number;
    sectors: number;
  };
  apiCache: {
    count: number;
    totalHits: number;
    byMethod: Record<string, number>;
  };
}

export function CacheInspector() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsMigrate, setNeedsMigrate] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const [
        fileStats,
        chatStats,
        stockStats,
        portfolioStats,
        marketStats,
        apiStats,
        dbStats,
      ] = await Promise.all([
        filesRepository.getStats(),
        chatsRepository.getStats(),
        stocksRepository.getStats(),
        portfolioRepository.getStats(),
        marketRepository.getStats(),
        apiCacheRepository.getStats(),
        db.getStats(),
      ]);

      setStats({
        files: {
          count: fileStats.totalFiles,
          size: fileStats.totalSize,
          averageSize: fileStats.averageFileSize,
        },
        chats: {
          count: chatStats.totalChats,
          favorites: chatStats.favoriteChats,
          dirty: chatStats.dirtyChats,
          deleted: chatStats.deletedChats,
        },
        messages: {
          count: dbStats.messages,
          byChat: {},
        },
        stocks: {
          count: stockStats.totalStocks,
          gainers: stockStats.gainers,
          losers: stockStats.losers,
        },
        portfolio: {
          count: portfolioStats.totalPortfolios,
          byType: portfolioStats.byType,
        },
        market: {
          count: marketStats.totalEntries,
          indices: marketStats.indices,
          news: marketStats.newsItems,
          sectors: marketStats.sectors,
        },
        apiCache: {
          count: apiStats.totalEntries,
          totalHits: apiStats.totalHits,
          byMethod: apiStats.byMethod,
        },
      });

      // Check if migration is needed
      const needs = await needsMigration();
      setNeedsMigrate(needs);
    } catch (error) {
      console.error('[CacheInspector] Error loading stats:', error);
    }
    setIsLoading(false);
  };

  const handleMigration = async () => {
    setIsMigrating(true);
    try {
      const result = await runMigration({ deleteOldDb: true });
      alert(`Migration completed: ${result.filesCount} files migrated in ${result.duration}ms`);
      await loadStats();
    } catch (error) {
      alert(`Migration failed: ${error}`);
    }
    setIsMigrating(false);
  };

  const handleClearCache = async (table: string) => {
    if (!confirm(`Are you sure you want to clear all data from ${table}?`)) {
      return;
    }

    try {
      switch (table) {
        case 'files':
          await filesRepository.clear();
          break;
        case 'chats':
          await chatsRepository.clear();
          break;
        case 'messages':
          await messagesRepository.clear();
          break;
        case 'stocks':
          await stocksRepository.clear();
          break;
        case 'portfolio':
          await portfolioRepository.clear();
          break;
        case 'market':
          await marketRepository.clear();
          break;
        case 'apiCache':
          await apiCacheRepository.clear();
          break;
        case 'all':
          await db.clearAll();
          break;
      }

      alert(`Cleared ${table} cache`);
      await loadStats();
    } catch (error) {
      alert(`Error clearing cache: ${error}`);
    }
  };

  const handleCleanupExpired = async () => {
    try {
      const result = await db.cleanupExpired();
      const total = Object.values(result).reduce((sum, count) => sum + count, 0);
      alert(`Cleaned up ${total} expired entries`);
      await loadStats();
    } catch (error) {
      alert(`Error cleaning up: ${error}`);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="text-center">Loading cache statistics...</div>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-500">Failed to load cache statistics</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">IndexedDB Cache Inspector</h2>
        
        {needsMigrate && (
          <div className="mb-4 p-4 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
            <p className="text-yellow-800 dark:text-yellow-200 mb-2">
              Old file cache detected. Migration recommended.
            </p>
            <button
              onClick={handleMigration}
              disabled={isMigrating}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
            >
              {isMigrating ? 'Migrating...' : 'Run Migration'}
            </button>
          </div>
        )}

        <div className="flex gap-2 mb-6">
          <button
            onClick={loadStats}
            className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
          >
            Refresh Stats
          </button>
          <button
            onClick={handleCleanupExpired}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Cleanup Expired
          </button>
          <button
            onClick={() => handleClearCache('all')}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Clear All Cache
          </button>
        </div>

        {/* Files Stats */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2 flex justify-between">
            <span>Files Cache</span>
            <button
              onClick={() => handleClearCache('files')}
              className="text-sm px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Clear
            </button>
          </h3>
          <div className="grid grid-cols-3 gap-4 p-4 bg-gray-100 dark:bg-gray-800 rounded">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Files</div>
              <div className="text-2xl font-bold">{stats.files.count}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Size</div>
              <div className="text-2xl font-bold">{formatBytes(stats.files.size)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Avg Size</div>
              <div className="text-2xl font-bold">{formatBytes(stats.files.averageSize)}</div>
            </div>
          </div>
        </div>

        {/* Chats Stats */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2 flex justify-between">
            <span>Chats Cache</span>
            <button
              onClick={() => handleClearCache('chats')}
              className="text-sm px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Clear
            </button>
          </h3>
          <div className="grid grid-cols-4 gap-4 p-4 bg-gray-100 dark:bg-gray-800 rounded">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
              <div className="text-2xl font-bold">{stats.chats.count}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Favorites</div>
              <div className="text-2xl font-bold">{stats.chats.favorites}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Dirty</div>
              <div className="text-2xl font-bold">{stats.chats.dirty}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Deleted</div>
              <div className="text-2xl font-bold">{stats.chats.deleted}</div>
            </div>
          </div>
        </div>

        {/* Messages Stats */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2 flex justify-between">
            <span>Messages Cache</span>
            <button
              onClick={() => handleClearCache('messages')}
              className="text-sm px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Clear
            </button>
          </h3>
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded">
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Messages</div>
            <div className="text-2xl font-bold">{stats.messages.count}</div>
          </div>
        </div>

        {/* Stocks Stats */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2 flex justify-between">
            <span>Stocks Cache</span>
            <button
              onClick={() => handleClearCache('stocks')}
              className="text-sm px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Clear
            </button>
          </h3>
          <div className="grid grid-cols-3 gap-4 p-4 bg-gray-100 dark:bg-gray-800 rounded">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Stocks</div>
              <div className="text-2xl font-bold">{stats.stocks.count}</div>
            </div>
            <div>
              <div className="text-sm text-green-600 dark:text-green-400">Gainers</div>
              <div className="text-2xl font-bold text-green-600">{stats.stocks.gainers}</div>
            </div>
            <div>
              <div className="text-sm text-red-600 dark:text-red-400">Losers</div>
              <div className="text-2xl font-bold text-red-600">{stats.stocks.losers}</div>
            </div>
          </div>
        </div>

        {/* Market Stats */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2 flex justify-between">
            <span>Market Data Cache</span>
            <button
              onClick={() => handleClearCache('market')}
              className="text-sm px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Clear
            </button>
          </h3>
          <div className="grid grid-cols-4 gap-4 p-4 bg-gray-100 dark:bg-gray-800 rounded">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
              <div className="text-2xl font-bold">{stats.market.count}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Indices</div>
              <div className="text-2xl font-bold">{stats.market.indices}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">News</div>
              <div className="text-2xl font-bold">{stats.market.news}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Sectors</div>
              <div className="text-2xl font-bold">{stats.market.sectors}</div>
            </div>
          </div>
        </div>

        {/* API Cache Stats */}
        <div>
          <h3 className="text-xl font-semibold mb-2 flex justify-between">
            <span>API Cache</span>
            <button
              onClick={() => handleClearCache('apiCache')}
              className="text-sm px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Clear
            </button>
          </h3>
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-100 dark:bg-gray-800 rounded">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Entries</div>
              <div className="text-2xl font-bold">{stats.apiCache.count}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Hits</div>
              <div className="text-2xl font-bold">{stats.apiCache.totalHits}</div>
            </div>
          </div>
          {Object.keys(stats.apiCache.byMethod).length > 0 && (
            <div className="mt-2 p-4 bg-gray-100 dark:bg-gray-800 rounded">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">By Method</div>
              {Object.entries(stats.apiCache.byMethod).map(([method, count]) => (
                <div key={method} className="flex justify-between">
                  <span>{method}</span>
                  <span className="font-bold">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

