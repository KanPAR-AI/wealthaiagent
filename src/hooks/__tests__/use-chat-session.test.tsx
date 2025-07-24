import { renderHook, act } from '@testing-library/react';
import { useNavigate } from 'react-router-dom';
import { useChatSession } from '../use-chat-session';
import { useChatStore } from '@/store/chat';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import { MessageFile } from '@/types/chat';

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('useChatSession', () => {
  const mockNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    // Reset chat store to its initial state before each test
    act(() => {
      useChatStore.setState({
        chats: {},
        pendingMessage: null,
        // include other initial state properties if any
      }); // `true` replaces the entire state
    });
  });

  describe('TC_002: Token Session Validation', () => {
    it('should initialize without a chat ID', () => {
      const { result } = renderHook(() => useChatSession(), { wrapper });

      expect(result.current.chatId).toBeUndefined();
      expect(result.current.isFirstMessage).toBe(false);
    });

    it('should maintain session state for an existing chat', () => {
      const existingChatId = 'chat_existing123';
      const { result } = renderHook(() => useChatSession(existingChatId), {
        wrapper,
      });

      expect(result.current.chatId).toBe(existingChatId);
      // isFirstMessage should be false for any existing chat
      expect(result.current.isFirstMessage).toBe(false);
    });
  });

  describe('TC_003: New Chat Creation - Success Flow', () => {
    it('should successfully create a new chat and redirect', async () => {
      const { result } = renderHook(() => useChatSession(), { wrapper });

      const testMessage = 'Hello, this is my first message';
      const testFiles: MessageFile[] = [
        {
          name: 'test.pdf',
          type: 'application/pdf',
          size: 1024,
          url: 'https://example.com/test.pdf',
        },
      ];

      let newChatId: string | undefined;

      await act(async () => {
        newChatId = await result.current.startNewSession(testMessage, testFiles);
      });

      // Verify a valid chat ID is generated and returned
      expect(newChatId).toBeDefined();
      expect(newChatId).toMatch(/^chat_[a-zA-Z0-9_-]{21}$/); // Assuming nanoid(21) format

      // Verify the hook's state is updated
      expect(result.current.chatId).toBe(newChatId);
      expect(result.current.isFirstMessage).toBe(true);

      // Verify navigation to the new chat URL occurred
      expect(mockNavigate).toHaveBeenCalledWith(`/chat/${newChatId}`, {
        replace: true,
      });

      // --- ⬇️ UPDATED ASSERTION LOGIC ---
      // Verify the pending message is correctly set in the Zustand store
      const pendingState = useChatStore.getState().pendingMessage;
      expect(pendingState).not.toBeNull();
      expect(pendingState?.chatId).toBe(newChatId);
      expect(pendingState?.text).toBe(testMessage);
      expect(pendingState?.files).toEqual(testFiles);
    });

    it('should handle multiple new sessions correctly', async () => {
      const { result, rerender } = renderHook(() => useChatSession(), { wrapper });

      // Create first session
      await act(async () => {
        await result.current.startNewSession('First message', []);
      });
      const firstChatId = result.current.chatId;

      expect(firstChatId).toBeDefined();
      expect(result.current.isFirstMessage).toBe(true);
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith(`/chat/${firstChatId}`, { replace: true });
      
      // Rerender to simulate starting a new session from the UI
      rerender();
      
      // Create second session
      await act(async () => {
        await result.current.startNewSession('Second message', []);
      });
      const secondChatId = result.current.chatId;

      expect(secondChatId).toBeDefined();
      expect(result.current.isFirstMessage).toBe(true);
      expect(firstChatId).not.toBe(secondChatId);
      expect(mockNavigate).toHaveBeenCalledTimes(2);
      expect(mockNavigate).toHaveBeenCalledWith(`/chat/${secondChatId}`, { replace: true });
    });

    it('should not navigate if an initial chat ID is provided', () => {
      const initialChatId = 'chat_initial123';
      renderHook(() => useChatSession(initialChatId), { wrapper });

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});