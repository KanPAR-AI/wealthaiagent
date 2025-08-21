import { useJwtToken } from '@wealthwise/hooks';
import { useAuthStore } from '../store/chat';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useEffect } from 'react';

// Extend globalThis to include our mobile storage
declare global {
  var __mobileStorage: Record<string, string> | undefined;
}

// Environment configuration helper
const getEnvironmentConfig = () => {
  // Priority order: .env file > app.json > platform-specific defaults
  const envApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
  const appJsonApiUrl = Constants.expoConfig?.extra?.apiUrl;
  
  let baseUrl = envApiBaseUrl || envApiUrl || appJsonApiUrl;
  
  // If no explicit URL is set, determine the correct localhost IP based on platform
  if (!baseUrl) {
    const isAndroid = Platform.OS === 'android';
    const isIOS = Platform.OS === 'ios';
    
    if (isAndroid) {
      // Android emulator uses 10.0.2.2 to access host machine's localhost
      baseUrl = 'http://10.0.2.2:8080';
    } else if (isIOS) {
      // iOS simulator can use localhost directly
      baseUrl = 'http://localhost:8080';
    } else {
      // Web or other platforms
      baseUrl = 'http://localhost:8080';
    }
  }
  
  // Remove /api/v1 suffix if present to normalize the base URL
  baseUrl = baseUrl.replace(/\/api\/v\d+$/, '');
  
  // Get API version from environment or default to v1
  const apiVersion = process.env.EXPO_PUBLIC_API_VERSION || 'v1';
  
  console.log('Mobile Environment Config:', {
    envApiBaseUrl,
    envApiUrl,
    appJsonApiUrl,
    platform: Platform.OS,
    resolvedBaseUrl: baseUrl,
    apiVersion,
    finalApiUrl: `${baseUrl}/api/${apiVersion}`
  });
  
  return {
    baseUrl,
    apiVersion,
    fullApiUrl: `${baseUrl}/api/${apiVersion}`
  };
};

// Mobile-specific storage adapter using AsyncStorage
const mobileStorageAdapter = {
  getItem: async (key: string) => {
    try {
      // For React Native, we'll use a simple in-memory storage for now
      // In a production app, you'd want to use AsyncStorage or SecureStore
      const value = globalThis.__mobileStorage?.[key] || null;
      return value;
    } catch (error) {
      console.warn('Storage getItem failed:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      // Initialize storage if it doesn't exist
      if (!globalThis.__mobileStorage) {
        globalThis.__mobileStorage = {};
      }
      globalThis.__mobileStorage[key] = value;
    } catch (error) {
      console.warn('Storage setItem failed:', error);
    }
  },
  removeItem: async (key: string) => {
    try {
      if (globalThis.__mobileStorage) {
        delete globalThis.__mobileStorage[key];
      }
    } catch (error) {
      console.warn('Storage removeItem failed:', error);
    }
  },
};

// Mobile-specific API config
const mobileApiConfig = {
  getApiUrl: (endpoint: string) => {
    const config = getEnvironmentConfig();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const fullUrl = `${config.fullApiUrl}${cleanEndpoint}`;
    
    console.log('Mobile API URL constructed:', { endpoint, fullUrl });
    return fullUrl;
  },
};

export const useJwtTokenMobile = () => {
  const authStore = useAuthStore();
  
  console.log('useJwtTokenMobile - Initial state:', {
    token: authStore.token,
    isLoadingToken: authStore.isLoadingToken,
    tokenError: authStore.tokenError
  });
  
  // Force reset the loading state to trigger the hook
  useEffect(() => {
    console.log('🔄 Resetting auth store state to trigger JWT fetch...');
    authStore.setIsLoadingToken(false);
    authStore.setTokenError(null);
  }, []);
  
  // Add a test API call to verify connectivity
  useEffect(() => {
    const testApiConnection = async () => {
      try {
        const testUrl = mobileApiConfig.getApiUrl('/auth/token');
        console.log('Testing API connection to:', testUrl);
        
        const response = await fetch(testUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'username=test_username&password=kzjdbv',
        });
        
        console.log('API test response status:', response.status);
        console.log('API test response headers:', Object.fromEntries(response.headers.entries()));
        
        if (response.ok) {
          const responseText = await response.text();
          console.log('API connection successful, response:', responseText);
          try {
            const responseJson = JSON.parse(responseText);
            console.log('Parsed JSON response:', responseJson);
          } catch (e) {
            console.log('Response is not JSON:', responseText);
          }
        } else {
          const errorText = await response.text();
          console.warn('API test failed with status:', response.status, 'Error:', errorText);
        }
      } catch (error) {
        console.error('API connection test failed:', error);
        console.error('Error details:', {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    };
    
    testApiConnection();
  }, []);
  
  const result = useJwtToken({
    authStore,
    apiConfig: mobileApiConfig,
    storage: mobileStorageAdapter,
  });
  
  console.log('useJwtTokenMobile - Hook result:', result);
  
  return result;
};
