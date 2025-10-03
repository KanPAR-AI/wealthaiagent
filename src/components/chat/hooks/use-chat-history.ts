import { useEffect } from 'react';
import { Message, MessageFile } from '@/types';
import { fetchChatHistory } from '@/services/chat-service';

interface UseChatHistoryProps {
  chatId?: string;
  token: string | null;
  isProcessingPendingMessage: boolean;
  setIsHistoryLoading: (loading: boolean) => void;
  clearMessages: () => void;
  addMessage: (message: Message) => void;
}

export function useChatHistory({
  chatId,
  token,
  isProcessingPendingMessage,
  setIsHistoryLoading,
  clearMessages,
  addMessage,
}: UseChatHistoryProps) {
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!chatId || !token) return;
      
      // Don't load history if we're processing a pending message
      if (isProcessingPendingMessage) {
        console.log("Skipping chat history load - pending message being processed");
        return;
      }
  
      try {
        const chatResponse = await fetchChatHistory(token, chatId);
  
        const loadedMessages: Message[] = chatResponse.messages.map((msg) => {
          const files: MessageFile[] = (msg.attachments || []).map((att: any) => {
            console.log('Processing attachment:', att);
            
            // Handle both string URLs and object attachments
            if (typeof att === 'string') {
              // Backend sends just URL strings
              const fileName = att.split('/').pop() || 'Unknown file';
              return {
                name: fileName,
                type: 'application/octet-stream', // Default type, will be detected by FileRenderer
                url: att,
                size: 0, // Unknown size
              };
            } else {
              // Backend sends attachment objects
              return {
                name: att.name || 'Unknown file',
                type: att.type || 'application/octet-stream',
                url: att.url,
                size: att.size || 0,
              };
            }
          });

          console.log('Loaded message with files:', { messageId: msg.id, fileCount: files.length, files });

          return {
            id: msg.id,
            message: msg.content,
            sender: msg.sender === 'assistant' ? 'bot' : 'user',
            timestamp: msg.timestamp,
            files: files.length > 0 ? files : undefined,
          };
        });
  
        // Only clear messages if we have loaded messages (existing chat)
        // Don't clear if it's a new chat with no history yet
        if (loadedMessages.length > 0) {
          setIsHistoryLoading(true);
          clearMessages();
  
          // Add loaded messages one by one (preserving order)
          loadedMessages.forEach((m) => addMessage(m));
        }
        setIsHistoryLoading(false);
      } catch (err) {
        console.error('Failed to load chat history:', err);
        setIsHistoryLoading(false);
      }
    };
  
    loadChatHistory();
  }, [chatId, token, clearMessages, addMessage, isProcessingPendingMessage, setIsHistoryLoading]);
}