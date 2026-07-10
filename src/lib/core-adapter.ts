// Web implementation of @wealthai/core's PlatformAdapter.
//
// Installed lazily via ensureCoreInitialized() — called from main.tsx at
// boot AND from every shim module that delegates to core, so any import
// order (app, tests, storybook) gets a configured core.

import { initCore, isCoreInitialized, type PlatformAdapter } from '@wealthai/core';
import { getApiUrl } from '@/config/environment';

type Handler = (payload?: unknown) => void;

/** Minimal emitter — deliberately dependency-free. Replaces the
 *  window.dispatchEvent(CustomEvent) pattern for core-driven events. */
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

const webAdapter: PlatformAdapter = {
  // LATE-BOUND on purpose: jest suites replace globalThis.fetch with a mock
  // after module load. Capturing `fetch` by reference here would freeze the
  // real one and silently bypass every test mock.
  fetch: (...args: Parameters<typeof globalThis.fetch>) => globalThis.fetch(...args),

  getApiUrl,

  storage: {
    async getItem(key) {
      return localStorage.getItem(key);
    },
    async setItem(key, value) {
      localStorage.setItem(key, value);
    },
    async removeItem(key) {
      localStorage.removeItem(key);
    },
  },

  events: createEmitter(),
};

export function ensureCoreInitialized(): void {
  if (!isCoreInitialized()) {
    initCore(webAdapter);
  }
}
