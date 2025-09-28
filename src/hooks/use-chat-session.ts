import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '@/store/chat';
import { nanoid } from 'nanoid';
import { MessageFile } from '@/types';

export const useChatSession = (initialChatId?: string) => {
  const [chatId, setChatId] = useState(initialChatId);
  // isFirstMessage will now track if we are dealing with a truly new session
  const [isFirstMessage, setIsFirstMessage] = useState(false); // Default to false
  const navigate = useNavigate();
  const { setPendingMessage } = useChatStore();

  // State to track if navigation has already happened for a new session
  const [hasNavigatedNewSession, setHasNavigatedNewSession] = useState(false);

  const startNewSession = useCallback(async (
    messageText: string,
    files: MessageFile[]
  ): Promise<string> => {
    const newChatId = `chat_${nanoid(12)}`;
    setPendingMessage(messageText, files, newChatId);
    setChatId(newChatId);
    setIsFirstMessage(true);
    setHasNavigatedNewSession(false);
    return newChatId;
  }, [setPendingMessage, setChatId, setIsFirstMessage, setHasNavigatedNewSession]);

  useEffect(() => {
    // This effect should only run if:
    // 1. A new chatId has been set (meaning startNewSession was called)
    // 2. We don't have an initialChatId (confirming it's a new session)
    // 3. We haven't navigated for this new session yet
    if (chatId && !initialChatId && !hasNavigatedNewSession) {
      navigate(`/chat/${chatId}`, { replace: true });
      setHasNavigatedNewSession(true); // Mark as navigated
    }
  }, [chatId, initialChatId, navigate, hasNavigatedNewSession]); // Add navigate to deps

  // Reset isFirstMessage if chatId changes from undefined to a value
  // This is for the case where a component using this hook gets remounted
  // or initialChatId changes
  useEffect(() => {
    if (!initialChatId && chatId) { // If it's a new session and we have a chat ID
      setIsFirstMessage(true);
    } else if (initialChatId) { // If we started with an initial chat ID
      setIsFirstMessage(false);
    }
  }, [initialChatId, chatId]);


  return {
    chatId,
    isFirstMessage, // Now accurately reflects if this is a newly created session
    startNewSession,
    setCurrentChatId: setChatId
  };
};