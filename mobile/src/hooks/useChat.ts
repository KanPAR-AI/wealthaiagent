import { useCallback, useRef } from 'react';
import { useChatStore } from '../store/chat';
import { api } from '../services/api';
import { connectSSE } from '../services/sse';
import { ChatMessage, MessageFile } from '../types';

export function useChat() {
  const {
    messages,
    isStreaming,
    currentSessionId,
    addMessage,
    updateLastMessage,
    setStreaming,
    setMessages,
    setCurrentSession,
    addSession,
  } = useChatStore();

  const abortRef = useRef<(() => void) | null>(null);

  const loadHistory = useCallback(async (chatId: string) => {
    try {
      const history = await api.getChatHistory(chatId);
      setMessages(history);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }, [setMessages]);

  const sendMessage = useCallback(
    async (text: string, files: MessageFile[] = []) => {
      let chatId = currentSessionId;

      // Create a new chat if needed
      if (!chatId) {
        try {
          const { id } = await api.createChat();
          chatId = id;
          setCurrentSession(id);
          addSession({
            id,
            title: text.slice(0, 50),
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          });
        } catch (err) {
          console.error('Failed to create chat:', err);
          return;
        }
      }

      // Add user message to UI
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
        files: files.length > 0 ? files : undefined,
      };
      addMessage(userMessage);

      // Send to backend
      try {
        const fileUrls = files.map((f) => f.url);
        await api.sendMessage(chatId, text, fileUrls);
      } catch (err) {
        console.error('Failed to send message:', err);
        return;
      }

      // Add placeholder assistant message and start streaming
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };
      addMessage(assistantMessage);
      setStreaming(true);

      // Connect SSE
      let accumulated = '';
      const streamUrl = api.getStreamUrl(chatId);

      abortRef.current = connectSSE(
        streamUrl,
        (event, data) => {
          if (event === 'message_delta') {
            try {
              const parsed = JSON.parse(data);
              accumulated += parsed.content || '';
              updateLastMessage(accumulated);
            } catch {
              accumulated += data;
              updateLastMessage(accumulated);
            }
          } else if (event === 'message_complete') {
            setStreaming(false);
          }
        },
        (error) => {
          console.error('SSE error:', error);
          setStreaming(false);
        },
        () => {
          setStreaming(false);
        }
      );
    },
    [currentSessionId, addMessage, updateLastMessage, setStreaming, setCurrentSession, addSession]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    setStreaming(false);
  }, [setStreaming]);

  return {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    loadHistory,
  };
}
