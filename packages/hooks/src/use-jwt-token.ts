import { useEffect } from 'react';
import { 
  AuthStore, 
  ApiConfig, 
  StorageAdapter, 
  JwtTokenResponse, 
  UseJwtTokenReturn 
} from '@wealthwise/types';

export interface UseJwtTokenOptions {
  authStore: AuthStore;
  apiConfig: ApiConfig;
  storage?: StorageAdapter; // Optional storage for persistence
  username?: string;
  password?: string;
}

export const useJwtToken = (options: UseJwtTokenOptions): UseJwtTokenReturn => {
  const { 
    authStore, 
    apiConfig, 
    storage, 
    username = 'test_username', 
    password = 'kzjdbv' 
  } = options;
  
  const { token, tokenError, isLoadingToken, setToken, setTokenError, setIsLoadingToken } = authStore;
  
  useEffect(() => {
    console.log('🔐 useJwtToken useEffect triggered with:', { token, tokenError, isLoadingToken });
    
    // Only fetch the token if it's not already in the store
    if (token || tokenError) {
      console.log('🔐 Skipping JWT fetch - already have token or error');
      // If we already have a token or an error, the loading is done.
      return;
    }

    console.log('🔐 Proceeding with JWT token fetch...');
    let isMounted = true;
    
    const getJwtToken = async () => {
      setIsLoadingToken(true);
      console.log('🔐 Starting JWT token fetch...');
      
      try {
        // Using URLSearchParams for form data
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);
   
        const apiUrl = apiConfig.getApiUrl('/auth/token');
        console.log('🔐 Fetching JWT token from:', apiUrl);
        console.log('🔐 Using credentials:', { username, password: '***' });
   
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData,
        });
   
        console.log('🔐 JWT response status:', response.status);
        console.log('🔐 JWT response headers:', Object.fromEntries(response.headers.entries()));
   
        // Handle response
        if (!response.ok) {
          const errorText = await response.text();
          console.error('🔐 JWT fetch failed:', response.status, errorText);
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
       
        const responseText = await response.text();
        console.log('🔐 JWT response text:', responseText);
        
        const data: JwtTokenResponse = JSON.parse(responseText);
        console.log('🔐 JWT parsed data:', { ...data, access_token: data.access_token ? '***' : null });
        
        // Store the token if component is still mounted
        if (isMounted && data.access_token) {
          console.log('🔐 Setting JWT token in store...');
          // Your setToken method automatically sets isLoadingToken to false and clears tokenError
          setToken(data.access_token);
          
          // Optional: Store in provided storage for persistence
          if (storage) {
            console.log('🔐 Storing JWT token in storage...');
            storage.setItem('jwt_token', data.access_token);
          }
        } else {
          console.log('🔐 Component unmounted or no token received');
        }
        
        return data;
       
      } catch (error: any) {
        console.error('🔐 Error getting JWT token:', error);
        
        // Store the error if component is still mounted
        if (isMounted) {
          console.log('🔐 Setting JWT error in store...');
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
  }, [token, tokenError, setToken, setTokenError, setIsLoadingToken, apiConfig, storage, username, password]);
  
  return { token, isLoadingToken, tokenError };
};
