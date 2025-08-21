// Core chat types
export interface MessageFile {
  name: string;
  type: string;
  size: number;
  url?: string; // For web usage (file URLs)
  content?: string; // For mobile usage (base64 content)
}

export interface Message {
  id: string;
  message: string;
  sender: 'user' | 'bot';
  timestamp?: string;
  files?: MessageFile[];
  isLoading?: boolean;
  isStreaming?: boolean;
  error?: string;
  liked?: boolean;
  disliked?: boolean;
}

export interface Chat {
  id: string;
  title: string;
  date?: string;
  isFavorite?: boolean;
}

// Suggestion tile data interface
export interface SuggestionTileData {
  id: number;
  title: string;
  description: string;
}

// Chat window props interface
export interface ChatWindowProps {
  chatId?: string;
  className?: string;
}

// Auth store interface (platform-agnostic)
export interface AuthStore {
  token: string | null;
  tokenError: string | null;
  isLoadingToken: boolean;
  setToken: (token: string | null) => void;
  setTokenError: (error: string | null) => void;
  setIsLoadingToken: (loading: boolean) => void;
}

// API configuration interface (platform-agnostic)
export interface ApiConfig {
  getApiUrl: (endpoint: string) => string;
}

// Storage interface (platform-agnostic)
export interface StorageAdapter {
  setItem: (key: string, value: string) => void;
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
}

// JWT token response interface
export interface JwtTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

// Hook return type
export interface UseJwtTokenReturn {
  token: string | null;
  isLoadingToken: boolean;
  tokenError: string | null;
}
