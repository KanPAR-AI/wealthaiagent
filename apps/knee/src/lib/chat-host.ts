// This app's capabilities for `@wealthai/chat-native` — the astro pattern
// (its chat-host.ts states the ruling: the chat page IS the yourfinadvisor
// chat, with routing off and the agent pinned).
//
// `routing: false` + `pinnedAgent` means every turn carries
// `force_agent=knee_arthritis`: no agent picker, no model picker, and no way
// to route a turn elsewhere even if somebody added one.
//
// No `upload` and no `transcribe` — stated rather than omitted, and the same
// statement `capabilities.ts` makes as `xrayUpload: false`: this app has no
// native multipart path yet, so the composer ships with NO attach button and
// NO mic rather than affordances that do nothing.

import { installChatHost } from '@wealthai/chat-native';

import { getToken } from './auth';
import { ensureCoreInitialized } from './core-adapter';
import { PINNED_AGENT } from './env';

export function ensureChatHostInstalled(): void {
  ensureCoreInitialized();
  installChatHost({
    getToken,
    routing: false,
    pinnedAgent: PINNED_AGENT,
    // No analytics package in this build; the funnel counter is a no-op so
    // the shared surface's contract is satisfied without inventing events.
    track: () => {},
  });
}
