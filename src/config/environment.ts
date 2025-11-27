// Environment configuration with validation and defaults

interface EnvironmentConfig {
  // API Configuration
  apiBaseUrl: string;
  apiVersion: string;
  
  // Application Configuration
  appBasePath: string;
  appName: string;
  appPort: number;
  
  // Feature Flags
  enableAnalytics: boolean;
  enableDebug: boolean;
  
  // Build Configuration
  buildTarget: 'development' | 'staging' | 'production';
  isDevelopment: boolean;
  isProduction: boolean;
  
  // Authentication (testing only)
  testUsername?: string;
  testPassword?: string;
  
  // External Services
  sentryDsn?: string;
  gaTrackingId?: string;
  massiveApiKey?: string;
}

// Helper function to get required environment variable
function _getRequiredEnv(key: string, fallback?: string): string {
  const value = import.meta.env[key];
  if (!value) {
    if (fallback) {
      console.warn(`Missing environment variable: ${key}, using fallback`);
      return fallback;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

// Helper function to get optional environment variable
function getOptionalEnv(key: string, defaultValue?: string): string | undefined {
  return import.meta.env[key] || defaultValue;
}

// Helper function to get boolean environment variable
function getBooleanEnv(key: string, defaultValue: boolean = false): boolean {
  const value = import.meta.env[key];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
}

// Helper function to get number environment variable
function getNumberEnv(key: string, defaultValue: number): number {
  const value = import.meta.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Create and export the environment configuration
export const env: EnvironmentConfig = {
  // API Configuration
  apiBaseUrl: getOptionalEnv('VITE_API_BASE_URL', 'https://chatbackend.yourfinadvisor.com') || '',
  apiVersion: getOptionalEnv('VITE_API_VERSION', 'v1') || '',
  
  // Application Configuration
  appBasePath: getOptionalEnv('VITE_APP_BASE_PATH', '/chataiagent') || '',
  appName: getOptionalEnv('VITE_APP_NAME', 'WealthAI Agent') || '',
  appPort: getNumberEnv('VITE_APP_PORT', 5173),
  
  // Feature Flags
  enableAnalytics: getBooleanEnv('VITE_ENABLE_ANALYTICS', false),
  enableDebug: getBooleanEnv('VITE_ENABLE_DEBUG', false),
  
  // Build Configuration
  buildTarget: (getOptionalEnv('VITE_BUILD_TARGET', 'production') as EnvironmentConfig['buildTarget']) || 'production',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  
  // Authentication (testing only)
  testUsername: getOptionalEnv('VITE_TEST_USERNAME', 'testuser'),
  testPassword: getOptionalEnv('VITE_TEST_PASSWORD', ''),
  
  // External Services
  sentryDsn: getOptionalEnv('VITE_SENTRY_DSN'),
  gaTrackingId: getOptionalEnv('VITE_GA_TRACKING_ID'),
  // Note: In .env file, use VITE_MASSIVE_API_KEY (Vite requires VITE_ prefix for client-side env vars)
  massiveApiKey: getOptionalEnv('VITE_MASSIVE_API_KEY'),
};

// Validate configuration in development
if (env.isDevelopment && env.enableDebug) {
  console.log('Environment Configuration:', {
    ...env,
    // Don't log sensitive values
    testPassword: '***',
  });
}

// Export helper to construct API URLs
export function getApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Avoid double prefixing if endpoint already includes /api/v1
  if (cleanEndpoint.startsWith(`/api/${env.apiVersion}`)) {
    return `${env.apiBaseUrl}${cleanEndpoint}`;
  }

  return `${env.apiBaseUrl}/api/${env.apiVersion}${cleanEndpoint}`;
}


// Export helper to construct app URLs
export function getAppUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${env.appBasePath}${cleanPath}`;
} 