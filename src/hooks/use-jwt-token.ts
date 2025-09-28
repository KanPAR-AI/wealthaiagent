// Local hook implementation to replace @wealthwise/hooks

interface StorageAdapter {
  setItem: (key: string, value: string) => void;
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
}

interface ApiConfig {
  getApiUrl: (path: string) => string;
}

interface AuthStore {
  token: string | null;
  tokenError: string | null;
  isLoadingToken: boolean;
  setToken: (token: string | null) => void;
  setTokenError: (error: string | null) => void;
  setIsLoadingToken: (loading: boolean) => void;
}

interface UseJwtTokenOptions {
  authStore: AuthStore;
  apiConfig: ApiConfig;
  storage: StorageAdapter;
}

export const useJwtToken = ({ authStore, apiConfig, storage }: UseJwtTokenOptions) => {
  const { token, tokenError, isLoadingToken, setToken, setTokenError, setIsLoadingToken } = authStore;

  const refreshToken = async () => {
    try {
      setIsLoadingToken(true);
      setTokenError(null);

      const response = await fetch(apiConfig.getApiUrl('/auth/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const data = await response.json();
      const newToken = data.access_token;

      setToken(newToken);
      storage.setItem('jwt_token', newToken);
      
      return newToken;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Token refresh failed';
      setTokenError(errorMessage);
      storage.removeItem('jwt_token');
      throw error;
    } finally {
      setIsLoadingToken(false);
    }
  };

  const clearToken = () => {
    setToken(null);
    setTokenError(null);
    storage.removeItem('jwt_token');
  };

  return {
    token,
    tokenError,
    isLoadingToken,
    refreshToken,
    clearToken,
  };
};