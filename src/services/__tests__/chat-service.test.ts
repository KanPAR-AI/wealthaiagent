import { 
  createChatSession, 
  sendChatMessage, 
  fetchChatHistory, 
  listenToChatStream,
  deleteChatSession 
} from '../chat-service';

// Mock fetch globally
const mockFetch = jest.fn();
(globalThis as any).fetch = mockFetch;

describe('Chat Service', () => {
  const mockToken = 'mock-jwt-token';

  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('TC_004: First Message Display and Streaming', () => {
    it('should display first message after chat creation', async () => {
      // Mock create chat response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chat: {
            id: 'chat_mock123456',
            messageCount: 1,
            title: 'Test Chat'
          }
        })
      });

      const chatId = await createChatSession(
        mockToken,
        'Test Chat',
        'Hello, this is my first message',
        []
      );

      expect(chatId).toBe('chat_mock123456');

      // Mock fetch history response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chat: {
            id: 'chat_mock123456',
            messageCount: 2,
            title: 'Test Chat'
          },
          messages: [
            {
              role: 'user',
              content: 'Hello, this is a test message',
              attachments: []
            },
            {
              role: 'assistant',
              content: 'Hello! How can I help you today?',
              attachments: []
            }
          ]
        })
      });

      // Fetch chat history to verify first message
      const history = await fetchChatHistory(mockToken, chatId);
      
      expect(history.messages).toHaveLength(2);
      expect(history.messages[0]).toEqual({
        role: 'user',
        content: 'Hello, this is a test message',
        attachments: []
      });
    });

    it.skip('should stream server response in real-time', async () => {
      const chatId = 'chat_test123';
      const chunks: string[] = [];
      const types: string[] = [];

      // Mock the streaming response with properly formatted JSON
      const mockStreamData = [
        'data: {"type": "message_delta", "delta": "Hello "}\n\n',
        'data: {"type": "message_delta", "delta": "from "}\n\n', 
        'data: {"type": "message_delta", "delta": "the AI!"}\n\n',
        'data: {"type": "message_complete"}\n\n'
      ];

      // Create a mock readable stream that the service can process
      let dataIndex = 0;
      const mockReader = {
        read: jest.fn().mockImplementation(async () => {
          if (dataIndex < mockStreamData.length) {
            const encoder = new TextEncoder();
            const value = encoder.encode(mockStreamData[dataIndex]);
            dataIndex++;
            return { done: false, value };
          }
          return { done: true };
        })
      };

      const mockStream = {
        getReader: jest.fn().mockReturnValue(mockReader)
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: mockStream
      });

      await listenToChatStream(
        mockToken,
        chatId,
        (chunk, type) => {
          if (chunk) {  // Only collect non-empty chunks
            chunks.push(chunk);
            types.push(type);
          }
        },
        () => {
          // Stream complete
        },
        (error) => {
          throw error;
        }
      );

      // Verify streaming chunks
      expect(chunks).toEqual(['Hello ', 'from ', 'the AI!']);
      expect(types).toEqual(['text_chunk', 'text_chunk', 'text_chunk']);
    });

    it('should handle streaming errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      const onError = jest.fn();
      const onChunk = jest.fn();
      const onComplete = jest.fn();

      await listenToChatStream(
        mockToken,
        'chat_error',
        onChunk,
        onComplete,
        onError
      );

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(onChunk).not.toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  describe('Chat Operations', () => {
    it('should send follow-up messages', async () => {
      const chatId = 'chat_test123';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({})
      });
      
      await expect(
        sendChatMessage(mockToken, chatId, 'Follow-up message', [])
      ).resolves.toBeUndefined();
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/chats/${chatId}/messages`),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`
          })
        })
      );
    });

    it('should delete chat session', async () => {
      const chatId = 'chat_test123';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204
      });
      
      await expect(
        deleteChatSession(mockToken, chatId)
      ).resolves.toBeUndefined();
    });

    it('should handle chat creation errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: 'Server error' })
      });

      await expect(
        createChatSession(mockToken, 'Test', 'Message', [])
      ).rejects.toThrow('Failed to create chat: Server error');
    });
  });
}); 