// @wealthai/core — shared, platform-agnostic layer for web (Vite/React DOM)
// and mobile (Expo/React Native).
//
// Ground rules (enforced by tsconfig lib: no "dom"):
//   - No `window`, `document`, `localStorage`, `navigator`, CustomEvent.
//   - No `fetch` assumptions beyond WHATWG basics — streaming consumers
//     receive a fetch implementation via the platform adapter so mobile
//     can pass `expo/fetch` (streaming-capable) and web passes global fetch.
//   - No React components. Hooks and stores are fine (zustand is
//     platform-neutral); rendering stays in apps/web and apps/mobile.
//
// Extraction happens in Phase 1. The plan, in dependency order:
//   1. types/          — chat, message, widget payloads, meal plan, auth
//   2. platform.ts     — adapter interface (storage, fetch, events)
//   3. services/       — chat-service (incl. SSE streaming), bug-report,
//                        meal-plan, auth token exchange
//   4. store/          — zustand stores (chat, auth, meal-plan), with the
//                        `chat-quick-reply` CustomEvent replaced by an
//                        emitter in the platform adapter

export { PLATFORM_ADAPTER_CONTRACT, type PlatformAdapter } from "./platform";

export const CORE_VERSION = "0.1.0";
