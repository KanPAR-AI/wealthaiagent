// hooks/useChatMessages.ts
import { useChatStore } from '@/store/chat';
import { Message } from '@/types/chat';

export const useChatMessages = (chatId: string) => {
  const { addMessage, getMessages, clearChat } = useChatStore();
 
  const revokeFileObjectURLs = (messages: Message[]) => {
    messages.forEach(msg => {
      msg.files?.forEach(file => {
        if (file.url?.startsWith('blob:')) {
          URL.revokeObjectURL(file.url);
        }
      });
    });
  };

  const addMessageWithCleanup = (message: Message) => {
    addMessage(chatId, message);
    return () => revokeFileObjectURLs([message]);
  };

  const clearChatMessages = () => {
    const currentMessages = getMessages(chatId);
    revokeFileObjectURLs(currentMessages);
    clearChat(chatId);
  };

  return {
    messages: getMessages(chatId),
    addMessage: addMessageWithCleanup,
    clearMessages: clearChatMessages,
    revokeFileObjectURLs
  };
};