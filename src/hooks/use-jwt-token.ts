// hooks/use-jwt-token.ts
import { useEffect } from 'react';
import { useAuthStore } from '@/store/chat';

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
        const response = await fetch('https://chatbackend.yourfinadvisor.com/api/v1/auth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            username: 'testuser',
            password: '', // Secure this in a real implementation
          }).toString(),
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