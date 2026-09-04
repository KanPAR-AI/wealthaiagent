// This app's implementation of @wealthai/core's PlatformAdapter — the astro
// adapter verbatim (its file states why expo/fetch: RN's built-in fetch
// cannot stream response bodies, which kills the SSE chat reader).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetch as expoFetch } from 'expo/fetch';
import { initCore, isCoreInitialized, type PlatformAdapter } from '@wealthai/core';

import { API_BASE_URL, API_VERSION } from './env';

type Handler = (payload?: unknown) => void;

function createEmitter() {
  const handlers = new Map<string, Set<Handler>>();
  return {
    emit(type: string, payload?: unknown) {
      handlers.get(type)?.forEach((h) => h(payload));
    },
    on(type: string, handler: Handler) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type)!.add(handler);
      return () => { handlers.get(type)?.delete(handler); };
    },
  };
}

export function apiUrl(endpoint: string): string {
  return `${API_BASE_URL}/api/${API_VERSION}/${endpoint.replace(/^\//, '')}`;
}

const kneeAdapter: PlatformAdapter = {
  fetch: expoFetch as unknown as typeof globalThis.fetch,
  uploadFetch: ((input: any, init?: any) => globalThis.fetch(input, init)) as typeof globalThis.fetch,
  getApiUrl: apiUrl,
  storage: {
    getItem: (key) => AsyncStorage.getItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
    removeItem: (key) => AsyncStorage.removeItem(key),
  },
  events: createEmitter(),
};

export function ensureCoreInitialized(): void {
  if (!isCoreInitialized()) initCore(kneeAdapter);
}
