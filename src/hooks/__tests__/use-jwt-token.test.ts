import { renderHook, waitFor } from '@testing-library/react';
import { useJwtToken } from '../use-jwt-token';
import { useAuthStore } from '@/store/chat';
import { getApiUrl } from '@/config/environment';

// Mock fetch globally
const mockFetch = jest.fn();
globalThis.fetch = mockFetch as any;

// Mock the auth store
jest.mock('@/store/chat', () => ({
  useAuthStore: jest.fn()
}));

const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

describe('useJwtToken', () => {
  const mockSetToken = jest.fn();
  const mockSetTokenError = jest.fn();
  const mockSetIsLoadingToken = jest.fn();

  beforeEach(() => {
    // Reset all mocks
    mockFetch.mockClear();
    mockSetToken.mockClear();
    mockSetTokenError.mockClear();
    mockSetIsLoadingToken.mockClear();

    // Default mock implementation for useAuthStore
    mockUseAuthStore.mockReturnValue({
      token: null,
      tokenError: null,
      isLoadingToken: true,
      setToken: mockSetToken,
      setTokenError: mockSetTokenError,
      setIsLoadingToken: mockSetIsLoadingToken
    });
  });

  describe('TC_001: Token Fetching - Success', () => {
    it('should successfully fetch authentication token from API', async () => {
      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'mock-jwt-token-12345' })
      });

      const { result } = renderHook(() => useJwtToken());

      // Initially should return the store values
      expect(result.current.isLoadingToken).toBe(true);
      expect(result.current.token).toBeNull();
      expect(result.current.tokenError).toBeNull();

      // Wait for the fetch to complete and setToken to be called
      await waitFor(() => {
        expect(mockSetToken).toHaveBeenCalledWith('mock-jwt-token-12345');
      });

      // Verify fetch was called with correct parameters
      expect(mockFetch).toHaveBeenCalledWith(
        getApiUrl('/auth/token'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: expect.any(URLSearchParams)
        })
      );

      // Verify the body contains correct form data
      const fetchCall = mockFetch.mock.calls[0];
      const body = fetchCall[1].body;
      expect(body.get('username')).toBe('test_username');
      expect(body.get('password')).toBe('kzjdbv');

      // Verify loading state was set to true initially
      expect(mockSetIsLoadingToken).toHaveBeenCalledWith(true);
      
      // Verify setToken was called (which should handle setting loading to false)
      expect(mockSetToken).toHaveBeenCalledWith('mock-jwt-token-12345');
    });

    it('should not refetch token if already exists in store', () => {
      // Mock store with existing token
      mockUseAuthStore.mockReturnValue({
        token: 'existing-token',
        tokenError: null,
        isLoadingToken: false,
        setToken: mockSetToken,
        setTokenError: mockSetTokenError,
        setIsLoadingToken: mockSetIsLoadingToken
      });

      const { result } = renderHook(() => useJwtToken());

      // Should immediately return existing token
      expect(result.current.isLoadingToken).toBe(false);
      expect(result.current.token).toBe('existing-token');
      expect(result.current.tokenError).toBeNull();
      
      // Fetch should not be called
      expect(mockFetch).not.toHaveBeenCalled();
      
      // setIsLoadingToken should not be called since token already exists
      expect(mockSetIsLoadingToken).not.toHaveBeenCalled();
    });
  });

  describe('TC_005: Token Fetching - Failure Scenario', () => {
    it('should handle API error response', async () => {
      // Mock error response with proper status
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      const { result } = renderHook(() => useJwtToken());

      // Initially loading
      expect(result.current.isLoadingToken).toBe(true);

      // Wait for the error to be handled and setTokenError to be called
      await waitFor(() => {
        expect(mockSetTokenError).toHaveBeenCalledWith('HTTP error! status: 401');
      });

      // Verify loading state was set to true initially
      expect(mockSetIsLoadingToken).toHaveBeenCalledWith(true);
      
      // Verify fetch was called
      expect(mockFetch).toHaveBeenCalledWith(
        getApiUrl('/auth/token'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: expect.any(URLSearchParams)
        })
      );
      
      // Verify setTokenError was called (which should handle setting loading to false)
      expect(mockSetTokenError).toHaveBeenCalledWith('HTTP error! status: 401');
    });

    it('should handle network errors', async () => {
      // Suppress console.error for this test to avoid noise
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result: _result } = renderHook(() => useJwtToken());

      // Wait for the error to be handled and setTokenError to be called
      await waitFor(() => {
        expect(mockSetTokenError).toHaveBeenCalledWith('Network error');
      });

      // Verify loading state was set to true initially
      expect(mockSetIsLoadingToken).toHaveBeenCalledWith(true);
      
      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalledWith('Error getting JWT token:', expect.any(Error));
      
      // Verify setTokenError was called (which should handle setting loading to false)
      expect(mockSetTokenError).toHaveBeenCalledWith('Network error');
      
      // Restore console.error
      consoleSpy.mockRestore();
    });

    it('should not refetch if error already exists in store', () => {
      // Mock store with existing error
      mockUseAuthStore.mockReturnValue({
        token: null,
        tokenError: 'Previous error',
        isLoadingToken: false,
        setToken: mockSetToken,
        setTokenError: mockSetTokenError,
        setIsLoadingToken: mockSetIsLoadingToken
      });

      const { result } = renderHook(() => useJwtToken());

      // Should immediately return existing error
      expect(result.current.isLoadingToken).toBe(false);
      expect(result.current.token).toBeNull();
      expect(result.current.tokenError).toBe('Previous error');
      
      // Fetch should not be called
      expect(mockFetch).not.toHaveBeenCalled();
      
      // setIsLoadingToken should not be called since error already exists
      expect(mockSetIsLoadingToken).not.toHaveBeenCalled();
    });
  });

  describe('TC_006: Additional Edge Cases', () => {
    it('should call fetch with correct parameters', async () => {
      // Mock successful response
      const mockTokenData = { access_token: 'test-token-123' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTokenData
      });

      renderHook(() => useJwtToken());

      // Wait for the fetch to complete
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      // Verify the exact fetch call
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(getApiUrl('/auth/token'));
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      expect(options.body).toBeInstanceOf(URLSearchParams);
      
      // Verify form data
      const formData = options.body;
      expect(formData.get('username')).toBe('test_username');
      expect(formData.get('password')).toBe('kzjdbv');
    });

    it('should handle component unmounting during fetch', async () => {
      // Mock a delayed response
      let resolvePromise: (value: any) => void;
      const delayedPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });
      
      mockFetch.mockReturnValueOnce(delayedPromise);

      const { unmount } = renderHook(() => useJwtToken());

      // Verify loading state was set
      expect(mockSetIsLoadingToken).toHaveBeenCalledWith(true);

      // Unmount the component
      unmount();

      // Resolve the promise after unmounting
      resolvePromise!({
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'test-token' })
      });

      // Wait a bit to ensure no state updates occur
      await new Promise(resolve => setTimeout(resolve, 10));

      // setToken should not be called after unmounting
      expect(mockSetToken).not.toHaveBeenCalled();
    });
  });
});