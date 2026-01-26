// hooks/use-cached-file.ts
import { useCallback, useEffect, useState } from 'react';
import { MessageFile } from '@/types';
import { fileCache } from '@/services/file-cache';

interface UseCachedFileResult {
  blobUrl: string | null;
  isLoading: boolean;
  error: boolean;
  refetch: () => void;
}

export function useCachedFile(file: MessageFile | null, token: string | null): UseCachedFileResult {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchFile = useCallback(async () => {
    if (!file) {
      setBlobUrl(null);
      return;
    }

    // Use provided token or fallback to dummy token for local dev with SKIP_AUTH
    const authToken = token || 'dev_token';

    // First, try to get from cache
    const cachedUrl = await fileCache.getBlobUrl(file.url);
    if (cachedUrl) {
      console.log('FileCache: Using cached file for', file.name);
      setBlobUrl(cachedUrl);
      setError(false);
      return;
    }

    // If not in cache, fetch from backend
    console.log('FileCache: Fetching file from backend for', file.name);
    setIsLoading(true);
    setError(false);

    try {
      // Fetch file with authorization and get blob
      const response = await fetch(file.url, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
      }

      // Cache the file and get blob URL
      const blob = await response.blob();
      await fileCache.set(file.url, blob, file);
      const newBlobUrl = URL.createObjectURL(blob);

      setBlobUrl(newBlobUrl);
      setError(false);
    } catch (err) {
      console.error('Failed to fetch file:', err);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [file, token]);

  const refetch = useCallback(() => {
    if (file) {
      // Clear cache for this file and refetch
      fileCache.delete(file.url);
      fetchFile();
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
