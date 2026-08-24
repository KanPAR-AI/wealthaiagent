/**
 * @wealthai/chat-native — the ONE React Native chat surface
 * (docs/49 ASTRAL-105, amended by the owner's ruling of 2026-08-24).
 *
 * "is chat page same as yourfinadvisor app, it should be — just some
 * branding details, and memory extraction and widget… with routing
 * disabled."
 *
 * So this package holds the whole surface — the message lifecycle, the
 * history reload, the transcript, the bubble, the composer and the generic
 * interactive widgets — and the two apps differ only in:
 *
 *   (a) brand tokens and copy   → the `ChatTheme` they pass
 *   (b) the widget/block set    → the `renderWidget` they pass
 *   (c) routing                 → `ChatHost.routing` + `pinnedAgent`
 *
 * Memory extraction needs nothing here: it is server-side and already runs
 * on every turn either app sends.
 *
 * Install the host's capabilities once at app start — see `host.ts` for why
 * the seam is an init function rather than a context (the same reasoning,
 * and the same `getToken` type seam, as `@wealthai/astral-native`).
 */

export {
  CHAT_RETRY_EVENT,
  CHAT_SEND_EVENT,
  getChatHost,
  installChatHost,
  isChatHostInstalled,
  resetChatHost,
} from './host';
export type { ChatHost, ChatUploadAsset } from './host';

export { useSendMessage, type SendState } from './use-send-message';
export { loadChatIntoStore } from './load-chat';

// ── the surface (all React Native; the lifecycle above is not) ─────────────
export { ChatSurface, type ChatSurfaceProps } from './chat-surface';
export { MessageList, type MessageListProps } from './message-list';
export {
  ChatText,
  MessageBubble,
  chatMarkdownStyles,
  type MessageBubbleProps,
} from './message-bubble';
export { ChatInput, type ChatInputProps } from './chat-input';
export {
  Chip,
  MultiSelect,
  TileRow,
  sendFromWidget,
  sharedWidgetHandlers,
  type ChatWidgetHandler,
} from './widgets';
export type { ChatTheme, ChatTypeStep } from './theme';
