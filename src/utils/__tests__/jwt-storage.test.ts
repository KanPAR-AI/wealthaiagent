// utils/__tests__/jwt-storage.test.ts

import {
  storeJwtToken,
  getStoredJwtToken,
  clearJwtToken,
  hasValidStoredToken,
  getTokenExpiryInfo,
} from '../jwt-storage';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('jwt-storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console.error to avoid noise in tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('storeJwtToken', () => {
    it('should store token and expiry date in localStorage', () => {
      const testToken = 'test-jwt-token-123';
      
      storeJwtToken(testToken);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(2);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('jwt_token', testToken);
      
      // Check that expiry is set (should be approximately 30 days from now)
      const [, expiryCall] = mockLocalStorage.setItem.mock.calls;
      expect(expiryCall[0]).toBe('jwt_token_expiry');
      
      const expiryTime = parseInt(expiryCall[1], 10);
      const now = Date.now();
      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
      
      // Should be within a reasonable range (allowing for test execution time)
      expect(expiryTime).toBeGreaterThan(now + thirtyDaysInMs - 1000);
      expect(expiryTime).toBeLessThanOrEqual(now + thirtyDaysInMs + 1000);
    });
  });

  describe('getStoredJwtToken', () => {
    it('should return token when valid and not expired', () => {
      const testToken = 'valid-token';
      const futureTime = Date.now() + (10 * 24 * 60 * 60 * 1000); // 10 days from now
      
      mockLocalStorage.getItem
        .mockReturnValueOnce(testToken) // jwt_token
        .mockReturnValueOnce(futureTime.toString()); // jwt_token_expiry
      
      const result = getStoredJwtToken();
      
      expect(result).toBe(testToken);
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('jwt_token');
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('jwt_token_expiry');
    });

    it('should return null when token is missing', () => {
      mockLocalStorage.getItem
        .mockReturnValueOnce(null) // jwt_token
        .mockReturnValueOnce('123456789'); // jwt_token_expiry
      
      const result = getStoredJwtToken();
      
      expect(result).toBeNull();
    });

    it('should return null when expiry is missing', () => {
      mockLocalStorage.getItem
        .mockReturnValueOnce('valid-token') // jwt_token
        .mockReturnValueOnce(null); // jwt_token_expiry
      
      const result = getStoredJwtToken();
      
      expect(result).toBeNull();
    });

    it('should return null and clear storage when token is expired', () => {
      const testToken = 'expired-token';
      const pastTime = Date.now() - (10 * 24 * 60 * 60 * 1000); // 10 days ago
      
      mockLocalStorage.getItem
        .mockReturnValueOnce(testToken) // jwt_token
        .mockReturnValueOnce(pastTime.toString()); // jwt_token_expiry
      
      const result = getStoredJwtToken();
      
      expect(result).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('jwt_token');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('jwt_token_expiry');
    });

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });
      
      const result = getStoredJwtToken();
      
      expect(result).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('jwt_token');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('jwt_token_expiry');
      expect(console.error).toHaveBeenCalledWith(
        'Error retrieving JWT token from localStorage:',
        expect.any(Error)
      );
    });
  });

  describe('clearJwtToken', () => {
    it('should remove both token and expiry from localStorage', () => {
      clearJwtToken();
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledTimes(2);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('jwt_token');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('jwt_token_expiry');
    });
  });

  describe('hasValidStoredToken', () => {
    it('should return true when valid token exists', () => {
      const testToken = 'valid-token';
      const futureTime = Date.now() + (10 * 24 * 60 * 60 * 1000);
      
      mockLocalStorage.getItem
        .mockReturnValueOnce(testToken)
        .mockReturnValueOnce(futureTime.toString());
      
      const result = hasValidStoredToken();
      
      expect(result).toBe(true);
    });

    it('should return false when no valid token exists', () => {
      mockLocalStorage.getItem
        .mockReturnValueOnce(null)
        .mockReturnValueOnce('123456789');
      
      const result = hasValidStoredToken();
      
      expect(result).toBe(false);
    });
  });

  describe('getTokenExpiryInfo', () => {
    it('should return expiry info for valid token', () => {
      const futureTime = Date.now() + (5 * 24 * 60 * 60 * 1000); // 5 days from now
      
      mockLocalStorage.getItem.mockReturnValueOnce(futureTime.toString());
      
      const result = getTokenExpiryInfo();
      
      expect(result).toEqual({
        isExpired: false,
        daysUntilExpiry: 5
      });
    });

    it('should return expired info for expired token', () => {
      const pastTime = Date.now() - (5 * 24 * 60 * 60 * 1000); // 5 days ago
      
      mockLocalStorage.getItem.mockReturnValueOnce(pastTime.toString());
      
      const result = getTokenExpiryInfo();
      
      expect(result).toEqual({
        isExpired: true
      });
    });

    it('should return null when no expiry stored', () => {
      mockLocalStorage.getItem.mockReturnValueOnce(null);
      
      const result = getTokenExpiryInfo();
      
      expect(result).toBeNull();
    });

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });
      
      const result = getTokenExpiryInfo();
      
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        'Error checking token expiry:',
        expect.any(Error)
      );
    });
  });
});
