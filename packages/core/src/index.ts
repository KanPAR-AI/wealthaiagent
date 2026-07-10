// @wealthai/core — shared, platform-agnostic layer for web (Vite/React DOM)
// and mobile (Expo/React Native).
//
// Ground rules (enforced by tsconfig lib: no "dom"):
//   - No `window`, `document`, `localStorage`, `navigator`, CustomEvent.
//   - Platform capabilities (fetch, storage, events, URL building) come in
//     through the PlatformAdapter installed via initCore() at app startup.
//   - No React components. Stores are fine (zustand is platform-neutral);
//     rendering stays in the web app and apps/mobile.
//
// Extraction progress:
//   [x] types/            — chat domain types
//   [x] platform.ts       — adapter contract + initCore/getPlatform
//   [x] services/chat-service — API client + SSE streaming reader
//   [ ] services/bug-report, meal-plan
//   [ ] store/            — zustand stores (chat, auth, meal-plan)

export {
  initCore,
  isCoreInitialized,
  getPlatform,
  PLATFORM_ADAPTER_CONTRACT,
  type PlatformAdapter,
} from './platform';

export * from './types';

export {
  createChatSession,
  sendChatMessage,
  fetchChatHistory,
  deleteChatSession,
  listenToChatStreamCore,
  type ListenToChatStreamOptions,
  type ChatMessage,
  type ChatResponse,
  type Attachment,
} from './services/chat-service';

export const CORE_VERSION = '0.1.0';
