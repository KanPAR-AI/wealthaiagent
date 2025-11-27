// hooks/use-massive-websocket.ts
// React hook for Massive.com WebSocket integration

import { useEffect, useRef, useCallback } from 'react';
import { MassiveWebSocketService, MassiveMessage, MassiveConnectionStatus } from '@/services/massive-websocket';

interface UseMassiveWebSocketOptions {
  apiKey: string;
  symbol?: string | null;
  useRealtime?: boolean;
  autoConnect?: boolean;
  onMessage?: (message: MassiveMessage) => void;
  onStatusChange?: (status: MassiveConnectionStatus) => void;
  onError?: (error: Error) => void;
}

interface UseMassiveWebSocketResult {
  status: MassiveConnectionStatus;
  connect: () => void;
  disconnect: () => void;
  subscribe: (symbol: string) => void;
  unsubscribe: (symbol: string) => void;
  isConnected: boolean;
}

/**
 * Hook for managing Massive.com WebSocket connections
 */
export function useMassiveWebSocket(
  options: UseMassiveWebSocketOptions
): UseMassiveWebSocketResult {
  const {
    apiKey,
    symbol,
    useRealtime = true,
    autoConnect = true,
    onMessage,
    onStatusChange,
    onError,
  } = options;

  const serviceRef = useRef<MassiveWebSocketService | null>(null);
  const statusRef = useRef<MassiveConnectionStatus>('disconnected');

  // Initialize service
  useEffect(() => {
    if (!apiKey || apiKey.trim() === '') {
      console.warn('[useMassiveWebSocket] API key not provided');
      return;
    }

    try {
      // Create service instance
      serviceRef.current = new MassiveWebSocketService(apiKey, useRealtime, {
        onStatusChange: (status) => {
          statusRef.current = status;
          onStatusChange?.(status);
        },
        onMessage: (message) => {
          onMessage?.(message);
        },
        onError: (error) => {
          console.error('[useMassiveWebSocket] Service error:', error);
          onError?.(error);
        },
        onReconnect: () => {
          // Resubscribe to current symbol on reconnect
          if (symbol && serviceRef.current) {
            serviceRef.current.subscribe(symbol);
          }
        },
      });

      // Auto-connect if enabled
      if (autoConnect) {
        console.log('[useMassiveWebSocket] Auto-connecting to WebSocket...');
        serviceRef.current.connect();
      }
    } catch (error) {
      console.error('[useMassiveWebSocket] Failed to create WebSocket service:', error);
      onError?.(error as Error);
    }

    // Cleanup on unmount
    return () => {
      if (serviceRef.current) {
        console.log('[useMassiveWebSocket] Cleaning up WebSocket connection');
        serviceRef.current.disconnect();
        serviceRef.current = null;
      }
    };
  }, [apiKey, useRealtime, autoConnect]); // Only recreate if these change

  // Handle symbol subscription changes
  useEffect(() => {
    const service = serviceRef.current;
    if (!service) return;

    // If connected and authenticated, subscribe/unsubscribe
    if (service.isConnected()) {
      if (symbol) {
        service.subscribe(symbol);
      }
    } else if (symbol) {
      // Queue subscription for when connection is ready
      service.subscribe(symbol);
    }

    // Cleanup: unsubscribe when symbol changes or component unmounts
    return () => {
      if (service && symbol) {
        service.unsubscribe(symbol);
      }
    };
  }, [symbol]);

  const connect = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.connect();
    }
  }, []);

  const disconnect = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.disconnect();
    }
  }, []);

  const subscribe = useCallback((sym: string) => {
    if (serviceRef.current) {
      serviceRef.current.subscribe(sym);
    }
  }, []);

  const unsubscribe = useCallback((sym: string) => {
    if (serviceRef.current) {
      serviceRef.current.unsubscribe(sym);
    }
  }, []);

  return {
    status: statusRef.current,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    isConnected: serviceRef.current?.isConnected() ?? false,
  };
}

