// Mobile implementation of @wealthai/core's PlatformAdapter.
//
// The critical piece is fetch: React Native's built-in fetch cannot stream
// response bodies, which breaks the SSE reader in core's chat-service.
// `expo/fetch` is WinterCG-compliant and supports response.body streaming —
// exactly what listenToChatStreamCore needs.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetch as expoFetch } from 'expo/fetch';
import { initCore, isCoreInitialized, type PlatformAdapter } from '@wealthai/core';

import { initServerConfig, apiUrl as serverApiUrl } from './server-config';

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

// URL building delegates to server-config so the runtime backend
// switcher (Production ↔ local) applies to every core request.
function getApiUrl(endpoint: string): string {
  return serverApiUrl(endpoint);
}

const mobileAdapter: PlatformAdapter = {
  // expo/fetch's signature is (url: string, init?) — a hair narrower than
  // WHATWG fetch (no Request object input). Core only ever calls with a
  // string URL, so the cast is safe; the seam is documented here.
  fetch: expoFetch as unknown as typeof globalThis.fetch,

  // Multipart uploads go through RN's built-in fetch: its FormData
  // accepts {uri,name,type} descriptors and streams files natively —
  // expo/fetch (WinterCG-strict) rejects those parts outright.
  // (Typed via cast: RN's fetch typings predate the URL-input overload.)
  uploadFetch: ((input: any, init?: any) => globalThis.fetch(input, init)) as typeof globalThis.fetch,

  getApiUrl,

  storage: {
    getItem: (key) => AsyncStorage.getItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
    removeItem: (key) => AsyncStorage.removeItem(key),
  },

  events: createEmitter(),
};

export function ensureCoreInitialized(): void {
  if (!isCoreInitialized()) {
    initCore(mobileAdapter);
    // Load the persisted server override (Production ↔ local switcher).
    // Fire-and-forget: resolves long before the first user-driven request.
    void initServerConfig();
  }
}
