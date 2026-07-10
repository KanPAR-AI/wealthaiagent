// types/chat.ts — WEB SHIM over @wealthai/core.
//
// The chat domain types moved to packages/core/src/types/chat.ts (shared
// with the Expo mobile app). This module re-exports them so every existing
// `@/types` import keeps working, and keeps the two React-coupled types
// that deliberately did NOT move — core bans DOM/React coupling.

export type {
  MessageFile,
  GraphNode,
  GraphLink,
  AiGraphContent,
  AiTableContent,
  StructuredContent,
  Widget,
  ContentBlock,
  Message,
  Chat,
  UserInfo,
  SuggestionTileData,
} from '@wealthai/core';

/**
 * Defines an action icon for chat bubbles (e.g., copy, like, dislike).
 * Stays web-side: React.FC over SVG props is a DOM concept.
 */
export interface ActionIconDefinition {
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  type: string;
  action: (messageId: string) => void;
}

/**
 * Props for the main ChatWindow component. Stays web-side with the
 * component it describes.
 */
export interface ChatWindowProps {
  chatId?: string;
  onNewChatCreated?: (newChatId: string) => void;
  className?: string;
  contextPrompt?: string; // Optional context prompt to prepend to messages
}
