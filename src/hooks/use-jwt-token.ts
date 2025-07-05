// hooks/use-jwt-token.ts
import { useEffect } from 'react';
import { useAuthStore } from '@/store/chat';
import { getApiUrl } from '@/config/environment';

export const useJwtToken = () => {
  const { token, tokenError, isLoadingToken, setToken, setTokenError, setIsLoadingToken } = useAuthStore();

  useEffect(() => {
    // Only fetch the token if it's not already in the store
    if (token || tokenError) {
      // If we already have a token or an error, the loading is done.
      setIsLoadingToken(false);
      return;
    }

    let isMounted = true;
    const getJwtToken = async () => {
      setIsLoadingToken(true);
      try {
        // Option 1: Using URLSearchParams (recommended)
        const formData = new URLSearchParams();
        formData.append('username', 'test_username');
        formData.append('password', 'kzjdbv');
    
        const response = await fetch(getApiUrl('/auth/token'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData,
        });
    
        // Option 2: Manual string construction (alternative)
        /*
        const response = await fetch(getApiUrl('/auth/token'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'username=test_username&password=kzjdbv',
        });
        */
    
        // Handle response
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
        
      } catch (error) {
        console.error('Error getting JWT token:', error);
        throw error;
      } finally {
        setIsLoadingToken(false);
      }
    };

    getJwtToken();

    return () => {
      isMounted = false; // Cleanup to prevent state updates on unmounted components
    };
  }, [token, tokenError, setToken, setTokenError, setIsLoadingToken]);

  return { token, isLoadingToken, tokenError };
};