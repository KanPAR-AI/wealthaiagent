import { renderHook, act } from '@testing-library/react';
import { useChatStore } from '../chat';
import { Message } from '@/types/chat';

describe('Chat Store', () => {
  beforeEach(() => {
    // Reset stores
    useChatStore.setState({
      chats: {},
      pendingMessage: null
    });
  });

  describe('Chat Store - Message Management', () => {
    it('should add messages to chat', () => {
      const { result } = renderHook(() => useChatStore());
      const chatId = 'chat_test123';
      
      const message1: Message = {
        id: 'msg1',
        sender: 'user',
        message: 'Hello',
        timestamp: new Date().toISOString(),
        files: []
      };

      const message2: Message = {
        id: 'msg2',
        sender: 'bot',
        message: 'Hi there!',
        timestamp: new Date().toISOString(),
        files: []
      };

      act(() => {
        result.current.addMessage(chatId, message1);
        result.current.addMessage(chatId, message2);
      });

      const messages = result.current.getMessages(chatId);
      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual(message1);
      expect(messages[1]).toEqual(message2);
    });

    it('should update existing messages', () => {
      const { result } = renderHook(() => useChatStore());
      const chatId = 'chat_test123';
      
      const message: Message = {
        id: 'msg1',
        sender: 'bot',
        message: 'Initial content',
        timestamp: new Date().toISOString(),
        files: []
      };

      act(() => {
        result.current.addMessage(chatId, message);
      });

      act(() => {
        result.current.updateMessage(chatId, 'msg1', {
          message: 'Updated content',
          isStreaming: false
        });
      });

      const messages = result.current.getMessages(chatId);
      expect(messages[0].message).toBe('Updated content');
      expect(messages[0].isStreaming).toBe(false);
    });

    it('should clear chat messages', () => {
      const { result } = renderHook(() => useChatStore());
      const chatId = 'chat_test123';
      
      const message: Message = {
        id: 'msg1',
        sender: 'user',
        message: 'Test message',
        timestamp: new Date().toISOString(),
        files: []
      };

      act(() => {
        result.current.addMessage(chatId, message);
      });

      expect(result.current.getMessages(chatId)).toHaveLength(1);

      act(() => {
        result.current.clearChat(chatId);
      });

      expect(result.current.getMessages(chatId)).toHaveLength(0);
    });

    it('should handle multiple chats independently', () => {
      const { result } = renderHook(() => useChatStore());
      const chatId1 = 'chat_1';
      const chatId2 = 'chat_2';
      
      const message1: Message = {
        id: 'msg1',
        sender: 'user',
        message: 'Chat 1 message',
        timestamp: new Date().toISOString(),
        files: []
      };

      const message2: Message = {
        id: 'msg2',
        sender: 'user',
        message: 'Chat 2 message',
        timestamp: new Date().toISOString(),
        files: []
      };

      act(() => {
        result.current.addMessage(chatId1, message1);
        result.current.addMessage(chatId2, message2);
      });

      expect(result.current.getMessages(chatId1)).toHaveLength(1);
      expect(result.current.getMessages(chatId2)).toHaveLength(1);
      expect(result.current.getMessages(chatId1)[0].message).toBe('Chat 1 message');
      expect(result.current.getMessages(chatId2)[0].message).toBe('Chat 2 message');
    });
  });

  describe('Chat Store - Pending Message Management', () => {
    it('should set and retrieve pending messages', () => {
      const { result } = renderHook(() => useChatStore());
      const chatId = 'chat_pending123';
      
      const files = [
        { name: 'test.pdf', type: 'application/pdf', size: 1024, url: 'https://example.com/test.pdf' }
      ];

      act(() => {
        result.current.setPendingMessage('Pending message text', files, chatId);
      });

      const pendingMessage = result.current.getPendingMessage(chatId);
      expect(pendingMessage).toEqual({
        text: 'Pending message text',
        files: files
      });
    });

    it('should return null for non-matching chat ID', () => {
      const { result } = renderHook(() => useChatStore());
      
      act(() => {
        result.current.setPendingMessage('Test', [], 'chat_123');
      });

      const pendingMessage = result.current.getPendingMessage('chat_different');
      expect(pendingMessage).toBeNull();
    });

    it('should clear pending messages', () => {
      const { result } = renderHook(() => useChatStore());
      const chatId = 'chat_clear123';
      
      act(() => {
        result.current.setPendingMessage('Test message', [], chatId);
      });

      expect(result.current.getPendingMessage(chatId)).not.toBeNull();

      act(() => {
        result.current.clearPendingMessage();
      });

      expect(result.current.getPendingMessage(chatId)).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle getting messages for non-existent chat', () => {
      const { result } = renderHook(() => useChatStore());
      
      const messages = result.current.getMessages('non_existent_chat');
      expect(messages).toEqual([]);
    });

    it('should handle updating message in non-existent chat', () => {
      const { result } = renderHook(() => useChatStore());
      
      // This should not throw
      act(() => {
        result.current.updateMessage('non_existent_chat', 'msg1', { message: 'Updated' });
      });

      const messages = result.current.getMessages('non_existent_chat');
      expect(messages).toEqual([]);
    });
  });
}); 