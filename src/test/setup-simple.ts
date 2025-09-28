import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';

// Mock import.meta.env
(global as any).import = {
  meta: {
    env: {
      DEV: true,
      PROD: false,
      VITE_API_BASE_URL: 'http://localhost:8080',
      VITE_API_VERSION: 'v1',
      VITE_APP_BASE_PATH: '',
      VITE_APP_NAME: 'WealthAI Agent Test',
      VITE_APP_PORT: 5173,
      VITE_ENABLE_ANALYTICS: false,
      VITE_ENABLE_DEBUG: false,
      VITE_BUILD_TARGET: 'development'
    }
  }
};

// Add TextEncoder/TextDecoder polyfills
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// Add ReadableStream polyfill
if (typeof ReadableStream === 'undefined') {
  global.ReadableStream = class ReadableStream {
    constructor(underlyingSource?: any) {
      if (underlyingSource?.start) {
        underlyingSource.start({
          enqueue: (_chunk: any) => {
            // Mock enqueue
          },
          close: () => {
            // Mock close
          },
          error: (_e: any) => {
            // Mock error
          }
        });
      }
    }
    
    getReader() {
      const chunks: any[] = [];
      return {
        read: async () => {
          if (chunks.length > 0) {
            return { value: chunks.shift(), done: false };
          }
          return { done: true };
        }
      };
    }
  } as any;
}

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: () => [{
        stop: jest.fn()
      }]
    })
  },
  writable: true
});

// Mock MediaRecorder
(global as any).MediaRecorder = class MediaRecorder {
  state = 'inactive';
  ondataavailable: any;
  onstop: any;
  
  constructor(stream: any) {
    // Mock constructor
  }
  
  start() {
    this.state = 'recording';
  }
  
  stop() {
    this.state = 'inactive';
    if (this.ondataavailable) {
      this.ondataavailable({ data: new Blob(['mock audio'], { type: 'audio/webm' }) });
    }
    if (this.onstop) {
      this.onstop();
    }
  }
};

// Mock window.alert
global.alert = jest.fn();

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = jest.fn();

// Mock fetch globally
global.fetch = jest.fn();

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
}); 