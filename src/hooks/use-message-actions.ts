// hooks/use-message-actions.ts
import { listenToChatStream } from '@/services/chat-service';
import { getApiUrl } from '@/config/environment';
import { useState, useRef, useEffect } from 'react';
import { useChatMessages } from './use-chat-messages';
import { useAuth } from './use-auth';

export const useMessageActions = (chatId: string) => {
  const { messages, updateMessage } = useChatMessages(chatId);
  const { idToken: token } = useAuth();
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Aborts the regen stream when the consumer (chat window) unmounts.
  // Without this a user navigating away during a retry leaks the SSE
  // reader and lets it keep updating a stale message id.
  const regenControllerRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => {
      regenControllerRef.current?.abort(new DOMException("ChatWindow unmounted", "AbortError"));
    };
  }, []);

  const handleCopy = (messageId: string) => {
    const message = messages.find((m: { id: string; }) => m.id === messageId);
    if (message) {
      navigator.clipboard.writeText(message.message)
        .then(() => console.log("Copied to clipboard"))
        .catch(err => console.error("Copy failed:", err));
    }
  };

  const handleLike = (messageId: string) => {
    console.log("Liked message:", messageId);
  };

  const handleDislike = (messageId: string) => {
    console.log("Disliked message:", messageId);
  };

  const handleRegenerate = async (messageId: string) => {
    if (!chatId || isRegenerating || !token) {
      console.warn("Regeneration skipped: Missing chatId, already regenerating, or missing token.");
      return;
    }

    const botMessageIndex = messages.findIndex((m: { id: string; }) => m.id === messageId);
    if (botMessageIndex === -1 || messages[botMessageIndex].sender !== 'bot') {
      console.warn("Attempted to regenerate a non-bot message or message not found.");
      return;
    }

    const userMessage = messages[botMessageIndex - 1];
    if (!userMessage || userMessage.sender !== 'user') {
      console.warn("No preceding user message found for regeneration.");
      return;
    }

    setIsRegenerating(true);

    // Reset the bot bubble in place so the user keeps their scroll position.
    updateMessage(messageId, {
      message: '',
      streamingContent: '',
      streamingChunks: [],
      contentBlocks: undefined,
      isStreaming: true,
      error: undefined,
    });

    // Best-effort delete of the failed/partial bot message from Firestore.
    // 204 = deleted; 404 = chat gone (rare); anything else we log but still
    // try the stream — the worst case is a duplicate bot message in history
    // which is recoverable via another delete on next regenerate.
    try {
      const delResp = await fetch(
        getApiUrl(`/chats/${chatId}/messages/${messageId}/regenerate`),
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!delResp.ok && delResp.status !== 404) {
        console.warn(`[handleRegenerate] Delete returned ${delResp.status}; proceeding anyway`);
      }
    } catch (err) {
      console.warn('[handleRegenerate] Delete network error; proceeding anyway:', err);
    }

    // One controller for the regen stream — stored in a ref so the unmount
    // cleanup above can abort it if the user navigates away mid-retry.
    const controller = new AbortController();
    regenControllerRef.current = controller;
    let receivedText = '';
    const streamingChunks: string[] = [];

    await listenToChatStream(
      token,
      chatId,
      (chunk, type) => {
        if (type === 'text_chunk') {
          receivedText += chunk;
          streamingChunks.push(chunk);
          updateMessage(messageId, {
            message: receivedText,
            streamingContent: receivedText,
            streamingChunks: [...streamingChunks],
          });
        }
      },
      () => {
        updateMessage(messageId, {
          isStreaming: false,
          message: receivedText,
          streamingContent: receivedText,
        });
        setIsRegenerating(false);
      },
      (error: any) => {
        console.error("Regeneration stream failed:", error);
        const isTimeout = error?.name === "TimeoutError" || /timed out/i.test(error?.message || "");
        updateMessage(messageId, {
          message: receivedText,
          streamingContent: receivedText,
          error: isTimeout
            ? "Connection timed out. Tap Retry to continue."
            : "Response interrupted. Tap Retry to continue.",
          isStreaming: false,
        });
        setIsRegenerating(false);
      },
      false,
      userMessage.message,
      null, // forceAgent — let backend pick
      controller.signal,
      // Tell backend to regenerate against this specific user message, not
      // "latest". Required when retrying an older failed bot message.
      userMessage.id,
    );
  };

  const handleSharePdf = async (_messageId: string) => {
    // Use browser's native print → "Save as PDF" on Mac/Windows.
    // Zero dependencies, works with all modern CSS (oklch, oklab, etc).
    // The browser renders everything natively — charts, tables, all of it.
    window.print();
  };

  return {
    handleCopy,
    handleLike,
    handleDislike,
    handleRegenerate,
    handleSharePdf,
    isRegenerating,
  };
};
