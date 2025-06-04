import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '@/store/chat';
import { nanoid } from 'nanoid';
import { MessageFile } from '@/types/chat';

export const useChatSession = (initialChatId?: string) => {
  const [chatId, setChatId] = useState(initialChatId);
  const [isFirstMessage, setIsFirstMessage] = useState(!initialChatId);
  const navigate = useNavigate();
  const { setPendingMessage } = useChatStore();

  const startNewSession = async (text: string, files: MessageFile[]) => {
    const newChatId = `chat_${nanoid(12)}`;
    setPendingMessage(text, files, newChatId);
    setIsFirstMessage(false);
    return newChatId;
  };

  useEffect(() => {
    if (chatId && !initialChatId) {
      navigate(`/chat/${chatId}`, { replace: true });
    }
  }, [chatId, initialChatId]);

  return {
    chatId,
    isFirstMessage,
    startNewSession,
    setCurrentChatId: setChatId
  };
};