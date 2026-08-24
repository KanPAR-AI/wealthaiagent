/**
 * The chat surface's host seam (docs/49 ASTRAL-105, amended 2026-08-24).
 *
 * ── why this file exists ───────────────────────────────────────────────────
 *
 * The owner's ruling: "is chat page same as yourfinadvisor app, it should be
 * — just some branding details, and memory extraction and widget… with
 * routing disabled." So the astro chat page is not a second client that
 * happens to look similar; it is the SAME surface, and the only differences
 * it is allowed are:
 *
 *   (a) brand tokens and copy      → `ChatTheme`, passed as a prop
 *   (b) the widget/block set       → each app's registry, passed as a prop
 *   (c) routing disabled           → `routing` + `pinnedAgent`, below
 *
 * Anything else that differs between the two apps' chat screens is a
 * SPEC-DEVIATION, not a style choice.
 *
 * ── injection, not import (ASTRAL-99's pattern, F22's lesson) ──────────────
 *
 * `apps/mobile/src/hooks/use-send-message.ts` imported `getToken` from
 * `@/lib/auth`, and `@/*` maps to `./src/*` in BOTH apps' tsconfigs — so a
 * copy of that hook into the second app would have COMPILED, resolving to a
 * different module, rather than failing loudly. The same trap, the same fix:
 * an init function called once at app start, matching `ensureCoreInitialized`
 * and `installAstralHost`, which are already the convention in this tree.
 *
 * A missing host THROWS and names the fix. It does not fall back to a
 * plausible default — a chat that silently sends with no token is worse than
 * one that refuses.
 */

import type { MessageFile } from '@wealthai/core';

/** What the composer hands an uploader. The picker already downscaled it. */
export interface ChatUploadAsset {
  uri: string;
  name: string;
  type: string;
  size?: number;
  width?: number;
}

export interface ChatHost {
  /**
   * A bearer token for the backend, or null when nobody is signed in.
   *
   * The CONTRACT is the wider of the two apps' signatures, exactly as
   * `AstralHost.getToken` is: mobile's `Promise<string | null>` and astro's
   * `Promise<string>` are both assignable, and the null case travels rather
   * than being cast away — the lifecycle refuses to send without a token.
   */
  getToken: () => Promise<string | null>;

  /**
   * Does the platform ROUTER run on this app's turns?
   *
   * `true`  — mobile: the turn carries whatever agent/model tier the user
   *           selected, and the app may ship pickers for them.
   * `false` — astro (D3, and the owner's ruling): the router never runs.
   *           Every turn carries `force_agent = pinnedAgent`, the store's
   *           `selectedAgent` / `selectedModelTier` are IGNORED, and no
   *           agent picker, model picker or router affordance may ship.
   *
   * Gated here rather than hidden in a screen on purpose: a picker that is
   * merely not drawn still leaves the store field live, and one stray
   * `setSelectedAgent` would route an astrology turn somewhere else.
   */
  routing: boolean;

  /** The agent every turn is forced to when `routing` is false. Required in
   *  that case — a pin with nothing to pin to is not a pin. */
  pinnedAgent?: string | null;

  /**
   * The product funnel's counter (docs/49 §12).
   *
   * OPTIONAL, and its absence is a real state: `apps/mobile` counts its own
   * events in its screens and has never counted this funnel, so it supplies
   * none and gains no events from this move. `apps/astro` supplies its
   * `track`, which is where `reading.ts`'s `reading_*` events now live —
   * counted in the LIFECYCLE, because counting in the screen is how a second
   * surface forgets to count.
   */
  track?: (event: string, params?: Record<string, unknown>) => void;

  /**
   * A native multipart upload.
   *
   * OPTIONAL, and absence is honest rather than an oversight: `apps/astro`
   * has no upload path yet (moving `apps/mobile/src/lib/upload.ts` into a
   * package is ASTRAL-110's job). A host without one gets NO attach button —
   * the affordance is absent, not present-and-broken.
   */
  upload?: (
    token: string,
    asset: ChatUploadAsset,
    onProgress?: (fraction: number) => void,
  ) => Promise<MessageFile>;

  /**
   * Speech to text for the composer's microphone.
   *
   * OPTIONAL for the same reason: a host without one gets no mic button.
   */
  transcribe?: (token: string, uri: string) => Promise<string>;
}

let host: ChatHost | null = null;

/** Install this app's capabilities. Call once, at module load, before any
 *  screen renders the chat surface. */
export function installChatHost(capabilities: ChatHost): void {
  if (capabilities.routing === false && !capabilities.pinnedAgent) {
    // Loud, because the silent version is the bad one: routing off with no
    // pin means every turn goes out with NO force_agent — which is routing
    // back on, without anybody choosing it.
    throw new Error(
      '[chat-native] routing is disabled but no pinnedAgent was given. ' +
        'A pin with nothing to pin to sends an unrouted turn (docs/49 ASTRAL-105).',
    );
  }
  host = capabilities;
}

/** Test seam, and the honest way to ask whether installation happened. */
export function isChatHostInstalled(): boolean {
  return host !== null;
}

/** The installed host, or a throw that says what to do. */
export function getChatHost(): ChatHost {
  if (!host) {
    throw new Error(
      '[chat-native] no host installed. Call installChatHost({ getToken, ' +
        'routing, … }) from the app root before rendering the chat surface ' +
        '(docs/49 ASTRAL-105).',
    );
  }
  return host;
}

/** Test seam — forget the installed host between cases. */
export function resetChatHost(): void {
  host = null;
}

/**
 * The channel a composed message travels on inside an app.
 *
 * ONE name for both apps. It was two — mobile's `chat-quick-reply` and
 * astro's `astral-widget-answer` — which is two conventions for the same
 * hop, and the kind of divergence that makes a widget work on one surface
 * and quietly do nothing on the other. The value is mobile's shipped string,
 * so nothing on the live app changes.
 */
export const CHAT_SEND_EVENT = 'chat-quick-reply';

/** The channel an errored reply's ↻ Retry travels on. */
export const CHAT_RETRY_EVENT = 'chat-retry';
