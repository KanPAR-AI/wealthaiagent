// hooks/use-cached-file-new.ts
// Updated hook using Dexie-based file cache

import { useCallback, useEffect, useState } from 'react';
import { MessageFile } from '@/types';
import { filesRepository } from '@/services/repositories';
import { fetchFileWithToken } from '@/services/chat-service';
import { isFresh } from '@/utils/staleness-checker';

interface UseCachedFileResult {
  blobUrl: string | null;
  isLoading: boolean;
  error: boolean;
  refetch: () => void;
}

/**
 * Hook for caching files with Dexie
 * Provides instant previews for previously cached files
 */
export function useCachedFile(file: MessageFile | null, token: string | null): UseCachedFileResult {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchFile = useCallback(async () => {
    if (!file || !token) {
      setBlobUrl(null);
      return;
    }

    try {
      // First, try to get from cache
      const cached = await filesRepository.getByUrl(file.url);
      
      if (cached) {
        // Check if cached file is fresh
        if (isFresh(cached)) {
          console.log('[useCachedFile] Using fresh cached file for', file.name);
          const url = URL.createObjectURL(cached.blob);
          setBlobUrl(url);
          setError(false);
          return;
        } else {
          console.log('[useCachedFile] Cached file is stale, refetching', file.name);
        }
      }

      // If not in cache or stale, fetch from backend
      console.log('[useCachedFile] Fetching file from backend for', file.name);
      setIsLoading(true);
      setError(false);

      const response = await fetchFileWithToken(file.url, token);
      
      // For fetchFileWithToken, we need to fetch the actual blob
      const blobResponse = await fetch(response, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!blobResponse.ok) {
        throw new Error(`Failed to fetch file: ${blobResponse.status}`);
      }

      // Get blob and cache it
      const blob = await blobResponse.blob();
      
      // Cache the file using the repository
      await filesRepository.cacheFile(file.url, blob, file);
      
      // Create blob URL for preview
      const newBlobUrl = URL.createObjectURL(blob);
      setBlobUrl(newBlobUrl);
      setError(false);
      
      console.log('[useCachedFile] File cached successfully:', file.name);
    } catch (err) {
      console.error('[useCachedFile] Failed to fetch file:', err);
      setError(true);
      setBlobUrl(null);
    } finally {
      setIsLoading(false);
    }
  }, [file, token]);

  const refetch = useCallback(() => {
    if (file) {
      // Clear cache for this file and refetch
      filesRepository.deleteByUrl(file.url).then(() => {
        fetchFile();
      });
    }
  }, [file, fetchFile]);

  useEffect(() => {
    fetchFile();
  }, [fetchFile]);

  // Cleanup blob URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  return {
    blobUrl,
    isLoading,
    error,
    refetch
  };
}

