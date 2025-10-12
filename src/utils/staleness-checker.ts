// utils/staleness-checker.ts
// Utility functions for checking data freshness and staleness

import { DataFreshness, CacheMetadata, CachedResult } from '@/types/db';

/**
 * Check the freshness of cached data
 * @param cachedAt - Timestamp when data was cached
 * @param staleAfter - Timestamp when data becomes stale
 * @param expiresAt - Timestamp when data expires
 * @returns DataFreshness level
 */
export function checkFreshness(
  cachedAt: number,
  staleAfter: number,
  expiresAt: number
): DataFreshness {
  const now = Date.now();
  
  // Check expiry first
  if (now > expiresAt) {
    return DataFreshness.EXPIRED;
  }
  
  // Check staleness
  if (now > staleAfter) {
    return DataFreshness.STALE;
  }
  
  // Data is fresh
  return DataFreshness.FRESH;
}

/**
 * Check if cached data exists and determine its freshness
 * @param cached - Cached data with metadata
 * @returns CachedResult with freshness info
 */
export function getCachedResult<T extends CacheMetadata>(
  cached: T | null | undefined
): CachedResult<T> {
  // No cached data
  if (!cached) {
    return {
      data: null,
      freshness: DataFreshness.MISSING,
      shouldRefetch: true,
    };
  }
  
  // Check freshness
  const freshness = checkFreshness(
    cached.cachedAt,
    cached.staleAfter,
    cached.expiresAt
  );
  
  // Determine if we should refetch
  const shouldRefetch = 
    freshness === DataFreshness.STALE ||
    freshness === DataFreshness.EXPIRED ||
    freshness === DataFreshness.MISSING;
  
  return {
    data: cached,
    freshness,
    shouldRefetch,
    lastUpdated: cached.cachedAt,
  };
}

/**
 * Check if data is fresh (not stale or expired)
 */
export function isFresh(cached: CacheMetadata | null | undefined): boolean {
  if (!cached) return false;
  const freshness = checkFreshness(
    cached.cachedAt,
    cached.staleAfter,
    cached.expiresAt
  );
  return freshness === DataFreshness.FRESH;
}

/**
 * Check if data is stale but not expired
 */
export function isStale(cached: CacheMetadata | null | undefined): boolean {
  if (!cached) return false;
  const freshness = checkFreshness(
    cached.cachedAt,
    cached.staleAfter,
    cached.expiresAt
  );
  return freshness === DataFreshness.STALE;
}

/**
 * Check if data is expired
 */
export function isExpired(cached: CacheMetadata | null | undefined): boolean {
  if (!cached) return true;
  const freshness = checkFreshness(
    cached.cachedAt,
    cached.staleAfter,
    cached.expiresAt
  );
  return freshness === DataFreshness.EXPIRED;
}

/**
 * Check if data should be shown to user (not expired)
 */
export function canShowCached(cached: CacheMetadata | null | undefined): boolean {
  if (!cached) return false;
  return !isExpired(cached);
}

/**
 * Check if data needs refetching (stale or expired)
 */
export function needsRefetch(cached: CacheMetadata | null | undefined): boolean {
  if (!cached) return true;
  return isStale(cached) || isExpired(cached);
}

/**
 * Get time remaining until data becomes stale (in milliseconds)
 */
export function getTimeUntilStale(cached: CacheMetadata | null | undefined): number {
  if (!cached) return 0;
  const now = Date.now();
  const remaining = cached.staleAfter - now;
  return Math.max(0, remaining);
}

/**
 * Get time remaining until data expires (in milliseconds)
 */
export function getTimeUntilExpiry(cached: CacheMetadata | null | undefined): number {
  if (!cached) return 0;
  const now = Date.now();
  const remaining = cached.expiresAt - now;
  return Math.max(0, remaining);
}

/**
 * Get age of cached data (in milliseconds)
 */
export function getCacheAge(cached: CacheMetadata | null | undefined): number {
  if (!cached) return 0;
  const now = Date.now();
  return now - cached.cachedAt;
}

/**
 * Format cache age as human-readable string
 */
export function formatCacheAge(cached: CacheMetadata | null | undefined): string {
  if (!cached) return 'Not cached';
  
  const age = getCacheAge(cached);
  
  if (age < 1000) return 'Just now';
  if (age < 60 * 1000) return `${Math.floor(age / 1000)}s ago`;
  if (age < 60 * 60 * 1000) return `${Math.floor(age / (60 * 1000))}m ago`;
  if (age < 24 * 60 * 60 * 1000) return `${Math.floor(age / (60 * 60 * 1000))}h ago`;
  return `${Math.floor(age / (24 * 60 * 60 * 1000))}d ago`;
}

/**
 * Get freshness as percentage (0-100)
 * 100 = just cached, 0 = expired
 */
export function getFreshnessPercentage(cached: CacheMetadata | null | undefined): number {
  if (!cached) return 0;
  
  const now = Date.now();
  const totalLifetime = cached.expiresAt - cached.cachedAt;
  const elapsed = now - cached.cachedAt;
  
  if (elapsed >= totalLifetime) return 0;
  
  const percentage = ((totalLifetime - elapsed) / totalLifetime) * 100;
  return Math.max(0, Math.min(100, percentage));
}

