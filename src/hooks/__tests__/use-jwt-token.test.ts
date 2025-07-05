import { renderHook, waitFor } from '@testing-library/react';
import { useJwtToken } from '../use-jwt-token';
import { useAuthStore } from '@/store/chat';
import { getApiUrl } from '@/config/environment';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('useJwtToken', () => {
  beforeEach(() => {
    // Reset the auth store before each test
    useAuthStore.setState({
      token: null,
      tokenError: null,
      isLoadingToken: true
    });
    
    // Reset fetch mock
    mockFetch.mockClear();
  });

  describe('TC_001: Token Fetching - Success', () => {
    it('should successfully fetch authentication token from API', async () => {
      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'mock-jwt-token-12345' })
      });

      const { result } = renderHook(() => useJwtToken());

      // Initially loading
      expect(result.current.isLoadingToken).toBe(true);
      expect(result.current.token).toBeNull();
      expect(result.current.tokenError).toBeNull();

      // Wait for token to be fetched
      await waitFor(() => {
        expect(result.current.isLoadingToken).toBe(false);
      });

      // Verify token is returned
      expect(result.current.token).toBe('mock-jwt-token-12345');
      expect(result.current.tokenError).toBeNull();
      
      // Verify fetch was called with correct parameters
      expect(global.fetch).toHaveBeenCalledWith(
        getApiUrl('/auth/token'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: 'test_username',
            password: 'password123'
          }),
        })
      );
    });

    it('should not refetch token if already exists in store', () => {
      // Set token in store
      useAuthStore.setState({
        token: 'existing-token',
        tokenError: null,
        isLoadingToken: false
      });

      const { result } = renderHook(() => useJwtToken());

      // Should immediately return existing token
      expect(result.current.isLoadingToken).toBe(false);
      expect(result.current.token).toBe('existing-token');
      expect(result.current.tokenError).toBeNull();
      
      // Fetch should not be called
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('TC_005: Token Fetching - Failure Scenario', () => {
    it('should handle API error response', async () => {
      // Mock error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized'
      });

      const { result } = renderHook(() => useJwtToken());

      // Initially loading
      expect(result.current.isLoadingToken).toBe(true);

      // Wait for error
      await waitFor(() => {
        expect(result.current.isLoadingToken).toBe(false);
      });

      // Verify error handling
      expect(result.current.token).toBeNull();
      expect(result.current.tokenError).toBe('Authentication failed: Unauthorized');
    });

    it('should handle network errors', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useJwtToken());

      // Wait for error
      await waitFor(() => {
        expect(result.current.isLoadingToken).toBe(false);
      });

      // Verify error handling
      expect(result.current.token).toBeNull();
      expect(result.current.tokenError).toBe('Network error');
    });

    it('should not refetch if error already exists in store', () => {
      // Set error in store
      useAuthStore.setState({
        token: null,
        tokenError: 'Previous error',
        isLoadingToken: false
      });

      const { result } = renderHook(() => useJwtToken());

      // Should immediately return existing error
      expect(result.current.isLoadingToken).toBe(false);
      expect(result.current.token).toBeNull();
      expect(result.current.tokenError).toBe('Previous error');
      
      // Fetch should not be called
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
}); 