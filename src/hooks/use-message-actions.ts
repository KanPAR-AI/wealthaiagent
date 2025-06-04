import { useState } from 'react';
import { useChatMessages } from './use-chat-messages';
import { generateAiResponse } from '@/services/ai-service';
import { nanoid } from 'nanoid';

export const useMessageActions = (chatId: string) => {
  const { messages, addMessage } = useChatMessages(chatId);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleCopy = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      navigator.clipboard.writeText(message.message)
        .then(() => console.log("Copied to clipboard"))
        .catch(err => console.error("Copy failed:", err));
    }
  };

  const handleLike = (messageId: string) => {
    console.log("Liked message:", messageId);
    // Implement actual like logic (API call, etc.)
  };

  const handleDislike = (messageId: string) => {
    console.log("Disliked message:", messageId);
    // Implement actual dislike logic
  };

  const handleRegenerate = async (messageId: string) => {
    if (!chatId || isRegenerating) return;

    const botMessageIndex = messages.findIndex(m => m.id === messageId);
    if (botMessageIndex <= 0 || messages[botMessageIndex].sender !== 'bot') return;

    const userMessage = messages[botMessageIndex - 1];
    if (userMessage?.sender !== 'user') return;

    setIsRegenerating(true);
    try {
     
      // Generate new response
      const aiResponse = await generateAiResponse(
        userMessage.message, 
        userMessage.files || []
      );

      addMessage({
        ...aiResponse,
        id: nanoid(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Regeneration failed:", error);
      addMessage({
        id: nanoid(),
        message: "Failed to regenerate response",
        sender: "bot",
        error: "Regeneration error",
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  return {
    handleCopy,
    handleLike,
    handleDislike,
    handleRegenerate,
    isRegenerating
  };
};