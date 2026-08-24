// This app's capabilities for `@wealthai/chat-native` (docs/49 ASTRAL-105).
//
// The chat page IS the yourfinadvisor chat (owner ruling, 2026-08-24). The
// whole of what makes it this brand's chat is here and in `chat-theme.ts`:
// how to get a token, whether the router runs, and who counts the funnel.
//
// ── (c) routing disabled, and disabled where it cannot be re-enabled ───────
//
// D3 pins this product to the astrology agent. That is declared as a
// LIFECYCLE fact rather than as a missing button: with `routing: false` the
// shared store's `selectedAgent` and `selectedModelTier` are ignored outright
// and every turn carries `force_agent=astrology_ai`. So this app ships no
// agent picker and no model picker, and — more to the point — could not route
// a turn elsewhere if somebody added one.
//
// F4 is the standing caveat: the pin removes the ROUTER, not the
// ToolExecutor pre-check. Making the pin authoritative above that check is
// ASTRAL-62 and lives in the backend.

import { installChatHost } from '@wealthai/chat-native';

import { track } from './analytics';
import { getToken } from './auth';
import { ensureCoreInitialized } from './core-adapter';
import { PINNED_AGENT } from './env';

export function ensureChatHostInstalled(): void {
  ensureCoreInitialized();
  installChatHost({
    // `Promise<string>` against the contract's `Promise<string | null>`.
    // Assignable, so no cast — and no null case invented for an app that is
    // anonymous-first and always has a token.
    getToken,

    routing: false,
    pinnedAgent: PINNED_AGENT,

    // §12's funnel. It used to be counted inside `reading.ts`; it moved WITH
    // the lifecycle, so the events survive that file's deletion and a second
    // surface cannot forget to count them.
    track,

    // No `upload` and no `transcribe`. Stated rather than omitted: this app
    // has no native multipart path yet (`apps/mobile/src/lib/upload.ts` is
    // the one that exists, and moving it is ASTRAL-110's job), so the
    // composer ships with NO attach button and NO mic — which is also what
    // the board's frame 04 draws. An affordance that is drawn and does
    // nothing is the failure this avoids.
  });
}
