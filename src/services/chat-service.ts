// services/chat-service.ts — WEB SHIM over @wealthai/core.
//
// The API client + SSE reader moved to packages/core/src/services/
// chat-service.ts (shared with the Expo mobile app). This module keeps the
// exact public surface the web app has always had, adding back the three
// web-only concerns that were deliberately NOT moved into core:
//
//   1. Mock SSE service (dev tool, useMockService flag).
//   2. MysticAI force-agent defaulting (reads window.location via
//      @/lib/mysticai — a browser concern).
//   3. fetchFileWithToken (URL.createObjectURL is DOM-only).
//
// Callers and tests are unaffected: same import path, same signatures.

import { listenToChatStreamCore } from '@wealthai/core';
import { ensureCoreInitialized } from '@/lib/core-adapter';
import { listenToMockChatStream } from './mock-sse-service';

// Any import of this module guarantees core is configured — tests import
// the shim directly without going through main.tsx.
ensureCoreInitialized();

export {
  createChatSession,
  sendChatMessage,
  fetchChatHistory,
  deleteChatSession,
  type ChatMessage,
  type ChatResponse,
  type Attachment,
} from '@wealthai/core';

/**
 * Listens to the SSE stream for AI responses. See core's
 * listenToChatStreamCore for the streaming/watchdog contract.
 *
 * Signature preserved verbatim from the pre-extraction web version —
 * including the mock-service branch and MysticAI agent defaulting.
 */
export const listenToChatStream = async (
  jwt: string,
  chatId: string,
  onMessageChunk: (
    chunk: string,
    type: "text_chunk" | "graph_data" | "table_data" | string
  ) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
  useMockService: boolean = false,
  prompt: string = "",
  forceAgent?: string | null,
  externalSignal?: AbortSignal,
  targetUserMessageId?: string | null,
  onAssistantId?: (assistantId: string) => void,
) => {
  // Route to mock service if requested
  if (useMockService) {
    console.log('[ChatService] Using mock SSE service');
    return listenToMockChatStream(prompt, onMessageChunk, onComplete, onError);
  }

  // MysticAI mode: always force astrology agent
  const { isMysticAI, MYSTIC_AGENT } = await import("@/lib/mysticai");
  const effectiveAgent = forceAgent || (isMysticAI ? MYSTIC_AGENT : null);

  return listenToChatStreamCore(jwt, chatId, onMessageChunk, onComplete, onError, {
    forceAgent: effectiveAgent,
    externalSignal,
    targetUserMessageId,
    onAssistantId,
  });
};

export async function fetchFileWithToken(url: string, token: string): Promise<string> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.statusText}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob); // Safe for preview
}
