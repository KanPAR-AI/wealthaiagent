import { useAuthStore } from '@/store/chat';
import { getApiUrl } from '@/config/environment';
import { useEffect } from 'react';

export const useJwtTokenWeb = () => {
  const { token, tokenError, isLoadingToken, setToken, setTokenError, setIsLoadingToken } = useAuthStore();

  const refreshToken = async () => {
    try {
      console.log('Starting token refresh...');
      setIsLoadingToken(true);
      setTokenError(null);

      const apiUrl = getApiUrl('/auth/token');
      console.log('Calling auth API:', apiUrl);
      console.log('Environment config:', { 
        apiBaseUrl: 'https://chatbackend.yourfinadvisor.com',
        apiVersion: 'v1',
        fullUrl: apiUrl 
      });

      // Use test credentials to get a real token from your API
      // Based on Postman collection: POST /api/v1/auth/token with form data
      const formData = new URLSearchParams();
      formData.append('username', 'test_user');
      formData.append('password', ''); // Empty password as per Postman
      
      console.log('Form data:', formData.toString());
      console.log('Form data entries:', Array.from(formData.entries()));

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      console.log('Auth response status:', response.status);
      console.log('Auth response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Auth failed:', errorText);
        console.error('Response status:', response.status);
        console.error('Response statusText:', response.statusText);
        throw new Error(`Authentication failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Auth response data:', data);
      const newToken = data.access_token || data.token;

      console.log('Got token:', newToken);
      setToken(newToken);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('jwt_token', newToken);
      }
      
      return newToken;
    } catch (error) {
      console.error('Token refresh error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      setTokenError(errorMessage);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('jwt_token');
      }
      throw error;
    } finally {
      setIsLoadingToken(false);
    }
  };

  const clearToken = () => {
    setToken(null);
    setTokenError(null);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('jwt_token');
    }
  };

  // Auto-fetch token on initialization if we don't have one
  useEffect(() => {
    console.log('useEffect triggered with:', { isLoadingToken, token });
    
    const initializeToken = async () => {
      console.log('Initializing token...', { isLoadingToken, token });
      
      // Check if we already have a token in storage
      const storedToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('jwt_token') : null;
      if (storedToken) {
        console.log('Found stored token:', storedToken);
        setToken(storedToken);
        return;
      }

      // If no token and we're loading, fetch a new one
      if (isLoadingToken && !token) {
        console.log('Fetching new token...');
        try {
          await refreshToken();
        } catch (error) {
          console.error('Failed to initialize token:', error);
        }
      } else {
        console.log('Skipping token fetch:', { isLoadingToken, token });
      }
    };

    initializeToken();
  }, [isLoadingToken, token, setToken]);

  return {
    token,
    tokenError,
    isLoadingToken,
    refreshToken,
    clearToken,
  };
};
