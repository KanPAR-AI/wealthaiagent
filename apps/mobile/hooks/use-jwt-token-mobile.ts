import { useJwtToken } from '@wealthwise/hooks';
import { useAuthStore } from '../store/chat';

// Mobile-specific storage adapter using AsyncStorage
const mobileStorageAdapter = {
  getItem: async (key: string) => {
    try {
      // For now, we'll use a simple in-memory storage
      // TODO: Implement AsyncStorage when available
      const value = globalThis.localStorage?.getItem(key);
      return value;
    } catch (error) {
      console.warn('Storage getItem failed:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      // For now, we'll use a simple in-memory storage
      // TODO: Implement AsyncStorage when available
      globalThis.localStorage?.setItem(key, value);
    } catch (error) {
      console.warn('Storage setItem failed:', error);
    }
  },
  removeItem: async (key: string) => {
    try {
      // For now, we'll use a simple in-memory storage
      // TODO: Implement AsyncStorage when available
      globalThis.localStorage?.removeItem(key);
    } catch (error) {
      console.warn('Storage removeItem failed:', error);
    }
  },
};

// Mobile-specific API config
const mobileApiConfig = {
  getApiUrl: (endpoint: string) => {
    const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
    return `${baseUrl}${endpoint}`;
  },
};

export const useJwtTokenMobile = () => {
  const authStore = useAuthStore();
  return useJwtToken({
    authStore,
    apiConfig: mobileApiConfig,
    storage: mobileStorageAdapter,
  });
};
