import { useJwtToken } from '@wealthwise/hooks';
import { useAuthStore } from '@/store/chat';
import { getApiUrl } from '@/config/environment';

// Web-specific storage adapter
const webStorageAdapter = {
  setItem: (key: string, value: string) => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(key, value);
    }
  },
  getItem: (key: string) => {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(key);
    }
    return null;
  },
  removeItem: (key: string) => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(key);
    }
  },
};

// Web-specific API config
const webApiConfig = {
  getApiUrl,
};

export const useJwtTokenWeb = () => {
  const authStore = useAuthStore();
  
  return useJwtToken({
    authStore,
    apiConfig: webApiConfig,
    storage: webStorageAdapter,
  });
};
