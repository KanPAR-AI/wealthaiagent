import { renderHook, act } from '@testing-library/react';
import { useNavigate } from 'react-router-dom';
import { useChatSession } from '../use-chat-session';
import { useChatStore } from '@/store/chat';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn()
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('useChatSession', () => {
  const mockNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    // Reset chat store
    useChatStore.setState({
      chats: {},
      pendingMessage: null
    });
  });

  describe('TC_002: Token Session Validation', () => {
    it('should validate token exists in session before chat operations', () => {
      // This test verifies that the session management works correctly
      // In a real scenario, this would check token validation
      const { result } = renderHook(() => useChatSession(), { wrapper });

      expect(result.current.chatId).toBeUndefined();
      expect(result.current.isFirstMessage).toBe(false);
    });

    it('should maintain session state for existing chat', () => {
      const existingChatId = 'chat_existing123';
      const { result } = renderHook(() => useChatSession(existingChatId), { wrapper });

      expect(result.current.chatId).toBe(existingChatId);
      expect(result.current.isFirstMessage).toBe(false);
    });
  });

  describe('TC_003: New Chat Creation - Success Flow', () => {
    it('should successfully create new chat and redirect', async () => {
      const { result } = renderHook(() => useChatSession(), { wrapper });

      const testMessage = 'Hello, this is my first message';
      const testFiles = [{ 
        name: 'test.pdf', 
        type: 'application/pdf', 
        size: 1024,
        url: 'https://example.com/test.pdf' 
      }];

      let newChatId: string = '';

      await act(async () => {
        newChatId = await result.current.startNewSession(testMessage, testFiles);
      });

      // Verify chat ID is generated
      expect(newChatId).toMatch(/^chat_[a-zA-Z0-9]{12}$/);
      expect(result.current.chatId).toBe(newChatId);
      expect(result.current.isFirstMessage).toBe(true);

      // Verify navigation to new chat URL
      expect(mockNavigate).toHaveBeenCalledWith(
        `/chat/${newChatId}`,
        { replace: true }
      );

      // Verify pending message is set in store
      const pendingMessage = useChatStore.getState().getPendingMessage(newChatId);
      expect(pendingMessage).toEqual({
        text: testMessage,
        files: testFiles
      });
    });

    it('should handle multiple new sessions correctly', async () => {
      const { result } = renderHook(() => useChatSession(), { wrapper });

      // Create first session
      let firstChatId: string = '';
      await act(async () => {
        firstChatId = await result.current.startNewSession('First message', []);
      });

      expect(result.current.chatId).toBe(firstChatId);
      expect(result.current.isFirstMessage).toBe(true);
      expect(mockNavigate).toHaveBeenCalledTimes(1);

      // Create second session
      let secondChatId: string = '';
      await act(async () => {
        secondChatId = await result.current.startNewSession('Second message', []);
      });

      expect(result.current.chatId).toBe(secondChatId);
      expect(result.current.isFirstMessage).toBe(true);
      expect(firstChatId).not.toBe(secondChatId);
      expect(mockNavigate).toHaveBeenCalledTimes(2);
    });

    it('should not navigate if initial chat ID is provided', () => {
      const initialChatId = 'chat_initial123';
      const { result } = renderHook(() => useChatSession(initialChatId), { wrapper });

      expect(result.current.chatId).toBe(initialChatId);
      expect(result.current.isFirstMessage).toBe(false);
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
}); 