// services/api-service.ts
import { MessageFile } from "@/types";
import { getApiUrl } from "@/config/environment";
import { listenToMockChatStream } from "./mock-sse-service";

// Network timeouts (frontend safety net).
// These guard against the UI getting stuck forever when the network or backend
// hangs. When any of these fire, the AbortController.signal aborts the fetch,
// which surfaces as an `AbortError` in the caller — which is then translated
// into an `error` on the bot message + a Retry button.
const POST_TIMEOUT_MS = 15_000;       // hard ceiling on POST /messages
const SSE_TTFB_TIMEOUT_MS = 30_000;   // first byte must arrive within 30s
const SSE_IDLE_TIMEOUT_MS = 60_000;   // no chunk for 60s ⇒ dead stream

// TODO: Align the message types for chat history with the backend. Remove the interfaces below and use only those from @/types

export interface ChatMessage {
  id: string;
  content: string;
  attachments: Attachment[];
  chatId: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  status: string;
  metadata: any;
}

export interface ChatResponse {
  chat: {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    userId: string;
    messageCount: number;
    lastMessage: any;
  };
  messages: ChatMessage[];
  hasMoreMessages: boolean;
}

export interface Attachment {
  name: string;
  type: string;
  url: string;
  size: number;
}


/**
 * Creates a new chat session.
 *
 * Returns both the new chat id AND the first user message id. Frontend
 * needs the message id to swap its local nanoid placeholder for the
 * Firestore UUID — without that, /regenerate and target_user_message_id
 * calls with the local nanoid never resolve server-side.
 */
export const createChatSession = async (
  jwt: string,
  title: string,
  firstMessageContent: string,
  files: MessageFile[]
): Promise<{ chatId: string; firstMessageId: string }> => {
  const response = await fetch(getApiUrl('/chats'), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: title,
      firstMessage: {
        content: firstMessageContent,
        attachments: files.map(file => file.url),
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Failed to create chat: ${errorData.detail || response.statusText}`
    );
  }

  const data = await response.json();
  return {
    chatId: data.chat.id,
    firstMessageId: data.messages?.[0]?.id ?? '',
  };
};

/**
 * Sends a follow-up message to an existing chat.
 *
 * Returns the backend-assigned message id. Caller swaps this in for the
 * local nanoid optimistic placeholder so /regenerate and
 * target_user_message_id resolve correctly.
 */
export const sendChatMessage = async (
  jwt: string,
  chatId: string,
  content: string,
  files: MessageFile[],
  externalSignal?: AbortSignal,
): Promise<string> => {
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort(externalSignal.reason);
    else externalSignal.addEventListener("abort", onExternalAbort);
  }
  const timeoutId = setTimeout(
    () => controller.abort(new DOMException("POST /messages timed out", "TimeoutError")),
    POST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(getApiUrl(`/chats/${chatId}/messages?auto_reply=false`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        content: content,
        attachments: files.map(file => file.url),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to send message: ${errorData.detail || response.statusText}`
      );
    }
    const data = await response.json().catch(() => ({}));
    return data?.id ?? '';
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
};

/**
 * Retrieves a specific chat and its messages.
 * Corresponds to Postman's "3. Get chat and verify content".
 */
export const fetchChatHistory = async (
  jwt: string,
  chatId: string
): Promise<ChatResponse> => {
  const response = await fetch(getApiUrl(`/chats/${chatId}`), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `Failed to fetch chat history: ${errorData.detail || response.statusText}`
    );
  }

  return response.json();
};

/**
 * Deletes a chat session.
 * Corresponds to Postman's "4. Delete the chat".
 */
export const deleteChatSession = async (
  jwt: string,
  chatId: string
): Promise<void> => {
  const response = await fetch(getApiUrl(`/chats/${chatId}`), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
  });

  if (response.status === 204) {
    return; // No content expected for 204
  }

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `Failed to delete chat: ${errorData.detail || response.statusText}`
    );
  }
};

/**
 * Listens to the Server-Sent Events (SSE) stream for AI responses.
 *
 * Watchdogs:
 *  - TTFB (30s): if no first chunk arrives by then, abort.
 *  - Idle (60s): reset on every chunk; if it ever fires, abort.
 *
 * Caller may also pass an `externalSignal` (AbortSignal) — wired through so
 * unmounting the chat window or starting a new send cancels the stream.
 *
 * The abort surfaces as `onError` with a TimeoutError (if a watchdog fired)
 * or AbortError (if caller cancelled). The caller decides whether to show
 * "Retry" UI vs silently swallow (user-cancellation case).
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
  // Called once when the backend's `message_start` event arrives, carrying
  // the assistant message id Firestore will save under. Caller uses this
  // to swap their local nanoid placeholder so subsequent /regenerate
  // and target_user_message_id calls match what's in the DB.
  onAssistantId?: (assistantId: string) => void,
) => {
  // Route to mock service if requested
  if (useMockService) {
    console.log('[ChatService] Using mock SSE service');
    return listenToMockChatStream(prompt, onMessageChunk, onComplete, onError);
  }

  // One controller for the whole stream. Aborts if any watchdog fires, the
  // external signal aborts, or fetch errors out.
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort(externalSignal.reason);
    else externalSignal.addEventListener("abort", onExternalAbort);
  }

  // TTFB watchdog: cleared as soon as the first chunk arrives.
  let ttfbTimer: ReturnType<typeof setTimeout> | null = setTimeout(
    () => controller.abort(new DOMException("SSE TTFB timed out", "TimeoutError")),
    SSE_TTFB_TIMEOUT_MS,
  );
  // Idle watchdog: reset on every chunk. Started after TTFB clears.
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(
      () => controller.abort(new DOMException("SSE idle timed out", "TimeoutError")),
      SSE_IDLE_TIMEOUT_MS,
    );
  };
  const clearTimers = () => {
    if (ttfbTimer) { clearTimeout(ttfbTimer); ttfbTimer = null; }
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  };
  // Tracks whether any data was received — distinguishes "stream produced nothing"
  // (we should treat as error) from "stream cancelled mid-chunk" (partial save case).
  let receivedAnyChunk = false;
  const noteChunk = () => {
    receivedAnyChunk = true;
    if (ttfbTimer) { clearTimeout(ttfbTimer); ttfbTimer = null; }
    resetIdleTimer();
  };

  try {
    console.log("[listenToChatStream] Opening SSE connection for chat:", chatId);

    // MysticAI mode: always force astrology agent
    const { isMysticAI, MYSTIC_AGENT } = await import("@/lib/mysticai");
    const effectiveAgent = forceAgent || (isMysticAI ? MYSTIC_AGENT : null);
    const params = new URLSearchParams();
    if (effectiveAgent) params.set("force_agent", effectiveAgent);
    if (targetUserMessageId) params.set("target_user_message_id", targetUserMessageId);
    const qs = params.toString();
    const streamUrl = qs
      ? getApiUrl(`/chats/${chatId}/stream?${qs}`)
      : getApiUrl(`/chats/${chatId}/stream`);
    const response = await fetch(streamUrl, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${jwt}`,
      },
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(
        `Failed to connect to SSE stream: ${response.statusText}`
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // Connection closed cleanly without a `message_complete` event.
        // If we received chunks, treat as success; if we got nothing at all,
        // treat as error so the UI shows Retry instead of an empty bubble.
        if (receivedAnyChunk) {
          onComplete();
        } else {
          onError(new Error("SSE stream closed without producing any content"));
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (let line of lines) {
        line = line.replace(/\r$/, '');
        if (!line.startsWith("data:")) continue;
        const payload = line.replace(/^data:\s*/, "");

        if (payload.startsWith("{")) {
          try {
            const parsedEvent = JSON.parse(payload);

            if (parsedEvent.type === 'message_start') {
              // Backend sends a stable assistant message id here that
              // matches what will be saved in Firestore. Surface it so
              // the caller can swap their local nanoid for the real id.
              const startedId = parsedEvent.message?.id;
              if (startedId && onAssistantId) onAssistantId(startedId);
              continue;
            }

            if (parsedEvent.type === 'message_delta') {
              noteChunk();
              onMessageChunk(parsedEvent.delta, "text_chunk");
              await new Promise(resolve => setTimeout(resolve, 0));
            } else if (parsedEvent.type === 'message_complete') {
              clearTimers();
              onComplete();
              return;
            } else if (parsedEvent.type) {
              noteChunk();
              const content = parsedEvent.message?.content || parsedEvent.content || "";
              onMessageChunk(content, parsedEvent.type);
              await new Promise(resolve => setTimeout(resolve, 0));
            }
          } catch (err) {
            console.warn("Could not parse a structured event from the stream:", payload, err);
          }
        } else {
          noteChunk();
          onMessageChunk(payload, "text_chunk");
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    }
  } catch (error: any) {
    // Caller-cancellation (unmount, new send) is not a user-visible error.
    // Watchdog timeouts and real failures are.
    if (externalSignal?.aborted && error?.name === "AbortError") {
      console.log("[listenToChatStream] Stream cancelled by caller");
    } else {
      console.error("SSE Stream error:", error);
      onError(error);
    }
  } finally {
    clearTimers();
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
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