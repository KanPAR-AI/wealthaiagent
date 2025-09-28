// Test environment configuration
// This file is used during testing to avoid import.meta issues

interface EnvironmentConfig {
  apiBaseUrl: string;
  apiVersion: string;
  appBasePath: string;
  appName: string;
  appPort: number;
  enableAnalytics: boolean;
  enableDebug: boolean;
  buildTarget: 'development' | 'staging' | 'production';
  isDevelopment: boolean;
  isProduction: boolean;
  testUsername?: string;
  testPassword?: string;
  sentryDsn?: string;
  gaTrackingId?: string;
}

export const env: EnvironmentConfig = {
  apiBaseUrl: 'http://localhost:8080',
  apiVersion: 'v1',
  appBasePath: '',
  appName: 'WealthAI Agent Test',
  appPort: 5173,
  enableAnalytics: false,
  enableDebug: false,
  buildTarget: 'development',
  isDevelopment: true,
  isProduction: false,
  testUsername: 'testuser',
  testPassword: 'testpass123'
};

export function getApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${env.apiBaseUrl}/api/${env.apiVersion}${cleanEndpoint}`;
}

export function getAppUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${env.appBasePath}${cleanPath}`;
} 