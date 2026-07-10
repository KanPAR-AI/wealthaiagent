// The platform adapter is the ONLY doorway through which core code touches
// platform capabilities. Each app constructs one at startup and passes it
// to initCore(). This is what lets chat-service's SSE reader run unchanged
// on web (global fetch + localStorage) and mobile (expo/fetch + AsyncStorage).

export interface PlatformAdapter {
  /** WHATWG fetch with STREAMING response.body support.
   *  web: a late-bound wrapper over globalThis.fetch (late-bound so test
   *  suites that swap globalThis.fetch still intercept every call) —
   *  mobile: `fetch` from `expo/fetch`. */
  fetch: typeof globalThis.fetch;

  /** Build a full API URL from an endpoint path ("/chats/123/stream").
   *  Injected as a function (not baseUrl+version fields) so each app keeps
   *  its existing URL semantics — web reuses config/environment.getApiUrl
   *  verbatim, which avoids any URL-shape drift during the migration. */
  getApiUrl(endpoint: string): string;

  /** Async key-value storage.
   *  web: localStorage wrapped in promises — mobile: AsyncStorage. */
  storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  };

  /** In-app event bus replacing the web build's
   *  `window.dispatchEvent(new CustomEvent('chat-quick-reply', ...))`
   *  widget dispatch. Both apps use the same emitter. */
  events: {
    emit(type: string, payload?: unknown): void;
    on(type: string, handler: (payload?: unknown) => void): () => void;
  };
}

let _adapter: PlatformAdapter | null = null;

/** Install the app's platform adapter. Idempotent; last call wins (tests
 *  re-init freely). Must run before any core service is used. */
export function initCore(adapter: PlatformAdapter): void {
  _adapter = adapter;
}

/** True once initCore() has run — lets app shims lazily self-initialize. */
export function isCoreInitialized(): boolean {
  return _adapter !== null;
}

export function getPlatform(): PlatformAdapter {
  if (!_adapter) {
    throw new Error(
      '@wealthai/core used before initCore(adapter) was called. ' +
      'Each app must install its PlatformAdapter at startup ' +
      '(web: src/lib/core-adapter.ts, mobile: src/lib/core-adapter.ts).',
    );
  }
  return _adapter;
}

/** Human-readable contract summary, exported so both apps can surface it
 *  in a debug screen and so tests can assert adapter completeness. */
export const PLATFORM_ADAPTER_CONTRACT = [
  'fetch: streaming-capable WHATWG fetch (late-bound on web)',
  'getApiUrl: endpoint path -> absolute API URL',
  'storage: async get/set/remove',
  'events: emit/on with unsubscribe',
] as const;
