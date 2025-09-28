import { createContext } from 'react';

// --- TYPE DEFINITIONS ---
export interface NetworkLog {
  id: number;
  url: string;
  method: string;
  status: number | 'pending' | 'error';
  statusText?: string;
  startTime: number;
  endTime: number | null;
  duration: number | null;
  requestHeaders: Record<string, string | undefined>;
  requestBody: BodyInit | null;
  responseHeaders: Record<string, string>;
  responseBody: string | object | null;
  error: string | null;
  success: boolean | null;
  type: 'fetch' | 'xhr';
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

interface LogContextType {
  logs: NetworkLog[];
  clearLogs: () => void;
  isLogging: boolean;
  toggleLogging: () => void;
}

// --- CONTEXT CREATION ---
export const LogContext = createContext<LogContextType>({
  logs: [],
  clearLogs: () => {},
  isLogging: true,
  toggleLogging: () => {},
});