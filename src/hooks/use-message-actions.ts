// hooks/use-message-actions.ts (Updated)
import { listenToChatStream, sendChatMessage } from '@/services/chat-service';
import { useState } from 'react';
import { useChatMessages } from './use-chat-messages';
import { useJwtToken } from './use-jwt-token';
import html2pdf from 'html2pdf.js';

export const useMessageActions = (chatId: string) => {
  // Destructure `updateMessage` as well from useChatMessages
  const { messages, updateMessage } = useChatMessages(chatId);
  const { token } = useJwtToken(); // Get the JWT token
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
    // Implement actual like logic (API call, etc.)
    // You would likely need to pass the token here for an authenticated API call
  };

  const handleDislike = (messageId: string) => {
    console.log("Disliked message:", messageId);
    // Implement actual dislike logic
    // You would likely need to pass the token here for an authenticated API call
  };

  const handleRegenerate = async (messageId: string) => {
    if (!chatId || isRegenerating || !token) {
      console.warn("Regeneration skipped: Missing chatId, already regenerating, or missing token.");
      return;
    }

    const botMessageIndex = messages.findIndex((m: { id: string; }) => m.id === messageId);
    // Ensure it's a bot message at the target ID
    if (botMessageIndex === -1 || messages[botMessageIndex].sender !== 'bot') {
        console.warn("Attempted to regenerate a non-bot message or message not found.");
        return;
    }

    const userMessage = messages[botMessageIndex - 1];
    // Ensure the preceding message is a user message
    if (!userMessage || userMessage.sender !== 'user') {
        console.warn("No preceding user message found for regeneration.");
        return;
    }

    setIsRegenerating(true); // Set regeneration status to true

    // Option 1: Replace the existing bot message with the new streamed content
    // We update the existing bot message to show it's streaming again
    updateMessage(messageId, { 
      message: '', 
      streamingContent: '',
      streamingChunks: [],
      isStreaming: true, 
      error: undefined 
    });

    // Option 2 (if you prefer a brand new message):
    // const newAiMessageId = nanoid();
    // addMessage({ id: newAiMessageId, message: '', sender: 'bot', timestamp: new Date().toISOString(), isStreaming: true });
    // const aiMessageToUpdateId = newAiMessageId; // Use this ID below

    const aiMessageToUpdateId = messageId; // Using Option 1: Update the existing bot message

    try {
      // 1. Send the last user message again to trigger regeneration
      await sendChatMessage(token, chatId, userMessage.message, userMessage.files || []);

      // 2. Listen to the SSE stream for the new AI response
      let receivedText = '';
      const streamingChunks: string[] = [];
      // We don't need a new AbortController here for the regeneration stream
      // as it's typically managed by the main ChatWindow, but if you want to
      // control this stream independently, you could create one.
      // For simplicity, we'll assume the stream will naturally close or be handled.

      await listenToChatStream(
        token,
        chatId,
        (chunk, type) => { // structuredContent is also returned by listenToChatStream
          if (type === 'text_chunk') {
            receivedText += chunk;
            streamingChunks.push(chunk);
            updateMessage(aiMessageToUpdateId, { 
              message: receivedText, // Keep for backward compatibility
              streamingContent: receivedText,
              streamingChunks: [...streamingChunks],
            });
          } 
          // else if (structuredContent) {
          //   updateMessage(aiMessageToUpdateId, { structuredContent: structuredContent });
          // }
        },
        () => {
          // On completion of stream
          updateMessage(aiMessageToUpdateId, { 
            isStreaming: false,
            message: receivedText, // Ensure final content is in message field
            streamingContent: receivedText,
          });
          setIsRegenerating(false); // Reset regeneration status
        },
        (error) => {
          console.error("Regeneration stream failed:", error);
          updateMessage(aiMessageToUpdateId, {
            message: receivedText || "Failed to regenerate response.",
            streamingContent: receivedText || "Failed to regenerate response.",
            error: "Regeneration error",
            isStreaming: false
          });
          setIsRegenerating(false); // Reset regeneration status on error
        }
      );

    } catch (error) {
      console.error("Regeneration process failed:", error);
      updateMessage(aiMessageToUpdateId, {
        message: "Failed to regenerate response.",
        streamingContent: "Failed to regenerate response.",
        sender: "bot", // Ensure sender is bot
        error: "Regeneration error",
        isStreaming: false
      });
      setIsRegenerating(false); // Reset regeneration status on error
    }
  };

  const handleSharePdf = async (_messageId: string) => {
    const chatContent = document.querySelector('[data-radix-scroll-area-viewport]');
    if (!chatContent) return;

    // Clone content for clean PDF capture
    const clone = chatContent.cloneNode(true) as HTMLElement;

    // Remove action buttons, loading indicators, and bottom spacers
    clone.querySelectorAll('[role="toolbar"]').forEach(el => el.remove());
    clone.querySelectorAll('[aria-label="AI is thinking"]').forEach(el => el.remove());

    // Remove fixed-height spacer divs at bottom
    const spacers = clone.querySelectorAll('.h-40, .md\\:h-32');
    spacers.forEach(el => el.remove());

    // Add header
    const header = document.createElement('div');
    header.style.cssText = 'padding: 16px 0; margin-bottom: 16px; border-bottom: 2px solid #e5e7eb;';
    header.innerHTML = `
      <h2 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 600; color: #111;">YourFinAdvisor — Chat Export</h2>
      <p style="margin: 0; font-size: 12px; color: #6b7280;">${new Date().toLocaleString()}</p>
    `;
    clone.prepend(header);

    // Prepare off-screen container with light theme for consistent PDF
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position: fixed; left: -9999px; top: 0; width: 800px; background: white; color: #111;';
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    const opt = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: `chat-export-${Date.now()}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    try {
      const blob: Blob = await html2pdf().set(opt).from(clone).outputPdf('blob');
      const file = new File([blob], opt.filename, { type: 'application/pdf' });

      // Use Web Share API on mobile if available
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Chat Export' });
      } else {
        // Download fallback
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = opt.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      document.body.removeChild(wrapper);
    }
  };

  return {
    handleCopy,
    handleLike,
    handleDislike,
    handleRegenerate,
    handleSharePdf,
    isRegenerating
  };
};