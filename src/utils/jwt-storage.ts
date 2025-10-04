// utils/jwt-storage.ts

const JWT_TOKEN_KEY = 'jwt_token';
const JWT_EXPIRY_KEY = 'jwt_token_expiry';
const TOKEN_EXPIRY_DAYS = 30;

export interface StoredToken {
  token: string;
  expiry: number;
}

/**
 * Store JWT token in localStorage with 30-day expiration
 */
export const storeJwtToken = (token: string): void => {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + TOKEN_EXPIRY_DAYS);
  
  localStorage.setItem(JWT_TOKEN_KEY, token);
  localStorage.setItem(JWT_EXPIRY_KEY, expiryDate.getTime().toString());
};

/**
 * Retrieve JWT token from localStorage if it exists and hasn't expired
 */
export const getStoredJwtToken = (): string | null => {
  try {
    const token = localStorage.getItem(JWT_TOKEN_KEY);
    const expiryStr = localStorage.getItem(JWT_EXPIRY_KEY);
    
    if (!token || !expiryStr) {
      return null;
    }
    
    const expiry = parseInt(expiryStr, 10);
    const now = Date.now();
    
    // Check if token has expired
    if (now > expiry) {
      // Token has expired, clean up storage
      clearJwtToken();
      return null;
    }
    
    return token;
  } catch (error) {
    console.error('Error retrieving JWT token from localStorage:', error);
    // Clear potentially corrupted data
    clearJwtToken();
    return null;
  }
};

/**
 * Clear JWT token from localStorage
 */
export const clearJwtToken = (): void => {
  localStorage.removeItem(JWT_TOKEN_KEY);
  localStorage.removeItem(JWT_EXPIRY_KEY);
};

/**
 * Check if a stored JWT token exists and is valid (not expired)
 */
export const hasValidStoredToken = (): boolean => {
  return getStoredJwtToken() !== null;
};

/**
 * Get token expiry information for debugging/logging
 */
export const getTokenExpiryInfo = (): { isExpired: boolean; daysUntilExpiry?: number } | null => {
  try {
    const expiryStr = localStorage.getItem(JWT_EXPIRY_KEY);
    
    if (!expiryStr) {
      return null;
    }
    
    const expiry = parseInt(expiryStr, 10);
    const now = Date.now();
    const isExpired = now > expiry;
    
    if (isExpired) {
      return { isExpired: true };
    }
    
    const daysUntilExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    return { isExpired: false, daysUntilExpiry };
  } catch (error) {
    console.error('Error checking token expiry:', error);
    return null;
  }
};
