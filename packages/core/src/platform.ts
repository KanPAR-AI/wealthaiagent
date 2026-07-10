// The platform adapter is the ONLY doorway through which core code touches
// platform capabilities. Each app constructs one at startup and passes it
// to core's init. This is what lets chat-service's SSE reader run unchanged
// on web (global fetch + localStorage) and mobile (expo/fetch + AsyncStorage).

export interface PlatformAdapter {
  /** WHATWG fetch with STREAMING response.body support.
   *  web: globalThis.fetch — mobile: `fetch` from `expo/fetch`. */
  fetch: typeof globalThis.fetch;

  /** Async key-value storage.
   *  web: localStorage wrapped in promises — mobile: AsyncStorage. */
  storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  };

  /** In-app event bus replacing the web build's
   *  `window.dispatchEvent(new CustomEvent('chat-quick-reply', ...))`
   *  widget dispatch. Both apps use the same emitter (e.g. mitt). */
  events: {
    emit(type: string, payload?: unknown): void;
    on(type: string, handler: (payload?: unknown) => void): () => void;
  };
}

/** Human-readable contract summary, exported so both apps can surface it
 *  in a debug screen and so tests can assert adapter completeness. */
export const PLATFORM_ADAPTER_CONTRACT = [
  "fetch: streaming-capable WHATWG fetch",
  "storage: async get/set/remove",
  "events: emit/on with unsubscribe",
] as const;
