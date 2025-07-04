import { useState, useEffect } from 'react';

export const useJwtToken = () => {
  const [token, setToken] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const getJwtToken = async () => {
      try {
        const response = await fetch('https://chatbackend.yourfinadvisor.com/api/v1/auth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            username: 'testuser',
            password: '', // Secure this in real implementation
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
      } finally {
        if (isMounted) {
          setIsLoadingToken(false);
        }
      }
    };

    getJwtToken();

    return () => {
      isMounted = false; // cleanup to prevent state updates on unmounted components
    };
  }, []);

  return { token, isLoadingToken, tokenError };
};
