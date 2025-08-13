import { useState, useEffect } from 'react';

export function useChatSession(chatId?: string) {
  const [isFirstMessage, setIsFirstMessage] = useState(false);

  useEffect(() => {
    if (chatId) {
      // For mobile, we'll determine if it's the first message based on the chatId
      // This is a simplified version - you might want to check against a list of existing chats
      setIsFirstMessage(true);
    } else {
      setIsFirstMessage(false);
    }
  }, [chatId]);

  return {
    isFirstMessage,
  };
}
