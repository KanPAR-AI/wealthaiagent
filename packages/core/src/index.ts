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
//   [x] services/bug-report-service — token/context passed by caller
//   [x] store/chat        — zustand chat store (verbatim move)
//   [ ] services/meal-plan
//   [ ] store/auth        — deferred to Phase 2: needs async-storage
//                           hydration design alongside mobile auth
//   [ ] store/meal-plan

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
  fetchChatList,
  mapHistoryMessage,
  deleteChatSession,
  listenToChatStreamCore,
  fetchAvailableAgents,
  uploadFileCore,
  type AgentOption,
  type UploadableFile,
  type ChatListItem,
  type ListenToChatStreamOptions,
  type ChatMessage,
  type ChatResponse,
  type Attachment,
} from './services/chat-service';

export {
  submitBugReportCore,
  listBugReportsCore,
  getBugReportCore,
  getNewBugCountCore,
  updateBugStatusCore,
  clusterBugReportsCore,
  type BugReport,
  type BugReportStatus,
  type BugReportContext,
  type BugReportMessage,
  type BugReportChatSnapshot,
  type BugReportScreenshot,
  type BugCluster,
  type BugClusterResponse,
} from './services/bug-report-service';

export { useChatStore } from './store/chat';

export const CORE_VERSION = '0.1.0';
