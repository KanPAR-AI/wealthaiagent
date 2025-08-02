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
      // Your store methods already handle setting isLoadingToken to false
      return;
    }

    let isMounted = true;
    
    const getJwtToken = async () => {
      setIsLoadingToken(true);
      
      try {
        // Using URLSearchParams for form data
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
   
        // Handle response
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
       
        const data = await response.json();
        
        // Store the token if component is still mounted
        if (isMounted && data.access_token) {
          // Your setToken method automatically sets isLoadingToken to false and clears tokenError
          setToken(data.access_token);
          
          // Optional: Store in sessionStorage for persistence across page reloads
          sessionStorage.setItem('jwt_token', data.access_token);
        }
        
        return data;
       
      } catch (error: any) {
        console.error('Error getting JWT token:', error);
        
        // Store the error if component is still mounted
        if (isMounted) {
          // Your setTokenError method automatically sets isLoadingToken to false and clears token
          setTokenError(error.message);
        }
      }
      // Note: No finally block needed since setToken/setTokenError handle isLoadingToken
    };
    
    getJwtToken();
    
    return () => {
      isMounted = false; // Cleanup to prevent state updates on unmounted components
    };
  }, [token, tokenError, setToken, setTokenError, setIsLoadingToken]);
  
  return { token, isLoadingToken, tokenError };
};