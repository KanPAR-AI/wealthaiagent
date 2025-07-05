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
        const response = await fetch(getApiUrl('/auth/token'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: 'user@example.com', // Replace with actual user info
            password: 'password123'        // Replace with actual auth
          }),
        });

        if (!response.ok) {
          throw new Error(`Authentication failed: ${response.statusText}`);
        }

        const data = await response.json();
        if (isMounted) {
          setToken(data.access_token);
        }
      } catch (error: any) {
        console.error("Error fetching JWT token:", error);
        if (isMounted) {
          setTokenError(error.message || "Unknown error occurred");
        }
      }
    };

    getJwtToken();

    return () => {
      isMounted = false; // Cleanup to prevent state updates on unmounted components
    };
  }, [token, tokenError, setToken, setTokenError, setIsLoadingToken]);

  return { token, isLoadingToken, tokenError };
};