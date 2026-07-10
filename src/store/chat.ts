// store/chat.ts — WEB SHIM over @wealthai/core.
//
// The zustand chat store moved verbatim to packages/core/src/store/chat.ts
// (shared with the Expo mobile app — it was already platform-agnostic).
// Same import path, same hook, zero call-site churn.

import { ensureCoreInitialized } from '@/lib/core-adapter';

ensureCoreInitialized();

export { useChatStore } from '@wealthai/core';
