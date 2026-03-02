// hooks/use-message-actions.ts
import { listenToChatStream, sendChatMessage } from '@/services/chat-service';
import { useState } from 'react';
import { useChatMessages } from './use-chat-messages';
import { useAuth } from './use-auth';

export const useMessageActions = (chatId: string) => {
  const { messages, updateMessage } = useChatMessages(chatId);
  const { idToken: token } = useAuth();
  const [isRegenerating, setIsRegenerating] = useState(false);

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

    updateMessage(messageId, {
      message: '',
      streamingContent: '',
      streamingChunks: [],
      isStreaming: true,
      error: undefined
    });

    const aiMessageToUpdateId = messageId;

    try {
      await sendChatMessage(token, chatId, userMessage.message, userMessage.files || []);

      let receivedText = '';
      const streamingChunks: string[] = [];

      await listenToChatStream(
        token,
        chatId,
        (chunk, type) => {
          if (type === 'text_chunk') {
            receivedText += chunk;
            streamingChunks.push(chunk);
            updateMessage(aiMessageToUpdateId, {
              message: receivedText,
              streamingContent: receivedText,
              streamingChunks: [...streamingChunks],
            });
          }
        },
        () => {
          updateMessage(aiMessageToUpdateId, {
            isStreaming: false,
            message: receivedText,
            streamingContent: receivedText,
          });
          setIsRegenerating(false);
        },
        (error) => {
          console.error("Regeneration stream failed:", error);
          updateMessage(aiMessageToUpdateId, {
            message: receivedText || "Failed to regenerate response.",
            streamingContent: receivedText || "Failed to regenerate response.",
            error: "Regeneration error",
            isStreaming: false
          });
          setIsRegenerating(false);
        }
      );

    } catch (error) {
      console.error("Regeneration process failed:", error);
      updateMessage(aiMessageToUpdateId, {
        message: "Failed to regenerate response.",
        streamingContent: "Failed to regenerate response.",
        sender: "bot",
        error: "Regeneration error",
        isStreaming: false
      });
      setIsRegenerating(false);
    }
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
