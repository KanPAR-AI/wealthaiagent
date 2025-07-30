# Testing Architecture Guide

This document provides a comprehensive overview of the testing architecture for the WealthAI Agent frontend application.

## Table of Contents
- [How Unit Testing Works - A Simple Example](#how-unit-testing-works---a-simple-example)
- [Overview](#overview)
- [Testing Stack](#testing-stack)
- [Architecture Components](#architecture-components)
- [Test Structure](#test-structure)
- [Configuration Details](#configuration-details)
- [Common Issues & Solutions](#common-issues--solutions)
- [Best Practices](#best-practices)

## How Unit Testing Works - A Simple Example

Let's understand how unit testing works by following a real example: testing the file upload feature in our chat application.

### The Story: Testing File Upload

Imagine you want to test if users can upload files in the chat. Here's how the test flows through our system:

#### 1. The Component We're Testing
**File**: `src/components/chat/chat-input.tsx`
```typescript
// This is the actual component that users interact with
export function PromptInputWithActions({ onSubmit }) {
  // Has a file input button
  // When user selects files, it calls onSubmit with the files
}
```

#### 2. The Test File
**File**: `src/components/chat/__tests__/chat-input.test.tsx`
```typescript
// This is where we write our test
test('user can upload a file', async () => {
  // We'll simulate a user uploading a file
});
```

#### 3. How The Test Runs - Step by Step

**Step 1: Jest Starts**
- You run `npm test`
- Jest reads `jest.config.js` to understand how to run tests
- It finds all files ending with `.test.tsx`

**Step 2: Test Environment Setup**
- Jest creates a fake browser environment using `jsdom`
- It runs `src/test/setup-simple.ts` which:
  - Adds missing browser features (like TextEncoder)
  - Sets up environment variables
  - Creates mock functions for things Node.js doesn't have

**Step 3: The Test Executes**
```typescript
// In chat-input.test.tsx
test('user can upload a file', async () => {
  // 1. Create a fake function to track what happens
  const mockOnSubmit = jest.fn();
  
  // 2. Render the component in the fake browser
  render(<PromptInputWithActions onSubmit={mockOnSubmit} />);
  
  // 3. Create a fake file (not a real file on disk!)
  const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
  
  // 4. Find the file input button and simulate clicking it
  const fileInput = screen.getByTestId('file-input');
  await userEvent.upload(fileInput, file);
  
  // 5. Check if our component called the submit function with the file
  expect(mockOnSubmit).toHaveBeenCalledWith({
    message: '',
    files: [expect.objectContaining({ name: 'test.txt' })]
  });
});
```

### The Infrastructure That Makes This Work

#### 1. Mock Files and Functions

**Mocking = Creating Fake Versions**

Instead of:
- Real files on your computer → We create fake File objects in memory
- Real API calls → We return fake responses
- Real timers → We control time in tests

**Example Mock Files:**
```
src/test/__mocks__/
├── fileMock.js         # When code imports an image, return 'test-file-stub'
└── nanoid.js           # When code needs random IDs, return predictable ones
```

#### 2. The Testing Libraries

Each library has a specific job:

- **Jest**: The boss that runs everything
  - Finds test files
  - Runs them in order
  - Reports results
  
- **React Testing Library**: Helps test React components
  - `render()`: Creates components in fake browser
  - `screen`: Finds elements like buttons and inputs
  - `userEvent`: Simulates user actions (clicking, typing)

- **jsdom**: The fake browser
  - Provides `document`, `window`, `localStorage`
  - All in memory, nothing real

#### 3. Configuration Files

**jest.config.js** - The rulebook:
```javascript
{
  testEnvironment: 'jsdom',        // Use fake browser, not Node.js
  setupFilesAfterEnv: ['setup.ts'], // Run this before tests
  moduleNameMapper: {              // When you see X, use Y instead
    '@/config/environment': 'fake-environment-for-tests',
    '*.css': 'just-return-empty-object'
  }
}
```

**setup-simple.ts** - The preparation:
```javascript
// Add things the fake browser is missing
global.TextEncoder = TextEncoder;

// Set up fake environment variables
global.import = {
  meta: {
    env: {
      VITE_API_BASE_URL: 'http://fake-api.com'
    }
  }
};
```

### A Complete Test Flow Example

Let's trace what happens when testing JWT token fetching:

1. **Test starts**: `use-jwt-token.test.ts`
   ```typescript
   test('fetches token on mount', async () => {
   ```

2. **Mock the fetch function**:
   ```typescript
   global.fetch = jest.fn(() => 
     Promise.resolve({
       ok: true,
       text: () => Promise.resolve('fake-jwt-token')
     })
   );
   ```

3. **Run the hook**:
   ```typescript
   const { result } = renderHook(() => useJwtToken());
   ```

4. **The hook runs** (`use-jwt-token.ts`):
   - Calls `fetch('/api/user/token')`
   - But it's our fake fetch!
   - Returns 'fake-jwt-token'

5. **Check the result**:
   ```typescript
   await waitFor(() => {
     expect(result.current.token).toBe('fake-jwt-token');
   });
   ```

### The Automation Flow

When you push code:

1. **Local Development** (`test-local.sh`):
   ```bash
   # Runs tests before starting dev server
   npm run test:ci
   npm run dev
   ```

2. **GitHub Actions** (`.github/workflows/ci.yml`):
   - Triggered on every push
   - Installs dependencies
   - Runs all tests
   - Fails the build if tests fail

3. **Google Cloud Build** (`cloudbuild.yaml`):
   ```yaml
   # Step 1: Run tests
   - name: 'node:18'
     entrypoint: npm
     args: ['run', 'test:ci']
   
   # Step 2: Only build Docker image if tests pass
   - name: 'gcr.io/cloud-builders/docker'
     args: ['build', '-t', 'app-image', '.']
   ```

4. **Docker Build** (`Dockerfile`):
   ```dockerfile
   # Tests run during image build too!
   RUN npm run test:ci
   RUN npm run lint
   ```

### Why This Architecture?

1. **Fast Feedback**: Tests run in seconds, not minutes
2. **No Real Side Effects**: 
   - No real files created
   - No real API calls made
   - No real database changes
3. **Predictable**: Same test gives same result every time
4. **Isolated**: Each test is independent
5. **Automated**: Runs on every code change

### Common Patterns You'll See

1. **Mocking API Calls**:
   ```typescript
   jest.spyOn(global, 'fetch').mockResolvedValue({
     ok: true,
     json: async () => ({ data: 'fake' })
   });
   ```

2. **Waiting for Async Operations**:
   ```typescript
   await waitFor(() => {
     expect(screen.getByText('Loaded')).toBeInTheDocument();
   });
   ```

3. **Simulating User Actions**:
   ```typescript
   const user = userEvent.setup();
   await user.click(button);
   await user.type(input, 'Hello');
   ```

4. **Checking Component State**:
   ```typescript
   expect(screen.getByRole('button')).toBeDisabled();
   expect(screen.queryByText('Error')).not.toBeInTheDocument();
   ```

This is how our unit tests work - they create a fake world where we can safely test our code without affecting anything real!

## Overview

Our testing architecture is designed to provide comprehensive coverage for a React/TypeScript application built with Vite. The setup handles unit tests, component tests, and integration tests while managing environment-specific configurations and modern JavaScript features.

```
┌─────────────────────────────────────────────────────────────┐
│                      Test Runner (Jest)                      │
├─────────────────────────────────────────────────────────────┤
│                   Test Environment (jsdom)                   │
├─────────────────────────────────────────────────────────────┤
│              TypeScript Compiler (ts-jest)                   │
├─────────────────────────────────────────────────────────────┤
│           Testing Libraries & Utilities                      │
│  (React Testing Library, user-event, jest-dom)             │
├─────────────────────────────────────────────────────────────┤
│                    Test Files                               │
│  (*.test.ts, *.test.tsx in __tests__ folders)             │
└─────────────────────────────────────────────────────────────┘
```

## Testing Stack

### Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `jest` | ^29.7.0 | Test runner and assertion library |
| `ts-jest` | ^29.2.5 | TypeScript preprocessor for Jest |
| `@testing-library/react` | ^16.1.0 | React component testing utilities |
| `@testing-library/user-event` | ^14.5.2 | User interaction simulation |
| `@testing-library/jest-dom` | ^6.6.3 | Custom Jest matchers for DOM |
| `jsdom` | ^25.0.1 | DOM implementation for Node.js |
| `identity-obj-proxy` | ^3.0.0 | CSS module mocking |

### Supporting Tools

- **ESLint**: Code quality and consistency
- **TypeScript**: Type safety in tests
- **Coverage Reports**: Track test coverage with thresholds

## Architecture Components

### 1. Jest Configuration (`jest.config.js`)

```javascript
export default {
  preset: 'ts-jest',                    // Use ts-jest for TypeScript
  testEnvironment: 'jsdom',             // Browser-like environment
  setupFilesAfterEnv: ['<rootDir>/src/test/setup-simple.ts'],
  moduleNameMapper: {
    // Path aliases and mocks
    '^@/config/environment$': '<rootDir>/src/config/environment.test.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/src/test/__mocks__/fileMock.js',
    '^nanoid$': '<rootDir>/src/test/__mocks__/nanoid.js'
  },
  // ... additional configuration
}
```

**Key Features:**
- **Module Name Mapping**: Redirects imports during tests
- **Transform Configuration**: Handles TypeScript compilation
- **Coverage Thresholds**: Enforces 70% coverage minimums
- **Test Pattern Matching**: Finds test files in `__tests__` folders

### 2. Test Setup (`src/test/setup-simple.ts`)

This file runs before all tests and sets up the testing environment:

```typescript
// Polyfills for Node.js environment
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock import.meta.env (Vite-specific)
(global as any).import = {
  meta: {
    env: {
      DEV: true,
      PROD: false,
      VITE_API_BASE_URL: 'http://localhost:8080',
      // ... other env vars
    }
  }
};

// Browser API mocks
global.ReadableStream = class ReadableStream { /* ... */ };
Object.defineProperty(navigator, 'mediaDevices', { /* ... */ });
```

### 3. Environment Configuration

**Production Code** (`src/config/environment.ts`):
- Uses Vite's `import.meta.env`
- Provides type-safe access to environment variables

**Test Code** (`src/config/environment.test.ts`):
- Static configuration without `import.meta`
- Prevents TypeScript compilation errors in Jest

### 4. Mock System

```
src/test/
├── __mocks__/
│   ├── fileMock.js         # Static file imports
│   └── nanoid.js           # ES module mocking
├── mocks/
│   ├── handlers.ts         # MSW request handlers
│   └── server.ts           # MSW server setup
├── setup-simple.ts         # Jest setup file
└── utils.tsx              # Testing utilities
```

## Test Structure

### Component Tests

Located in `src/components/*/__tests__/`:

```typescript
// Example: chat-input.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PromptInputWithActions } from '../chat-input';

describe('PromptInputWithActions', () => {
  it('should handle file upload', async () => {
    const user = userEvent.setup();
    const mockOnSubmit = jest.fn();
    
    render(<PromptInputWithActions onSubmit={mockOnSubmit} />);
    
    // Test implementation
  });
});
```

### Hook Tests

Located in `src/hooks/__tests__/`:

```typescript
// Example: use-jwt-token.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useJwtToken } from '../use-jwt-token';

describe('useJwtToken', () => {
  it('should fetch token on mount', async () => {
    const { result } = renderHook(() => useJwtToken());
    
    await waitFor(() => {
      expect(result.current.token).toBe('mock-jwt-token');
    });
  });
});
```

### Service Tests

Located in `src/services/__tests__/`:

```typescript
// Example: chat-service.test.ts
import * as chatService from '../chat-service';

describe('Chat Service', () => {
  it('should create new chat', async () => {
    const chatId = await chatService.createChat('token');
    expect(chatId).toMatch(/^chat_/);
  });
});
```

## Configuration Details

### TypeScript Configuration for Tests

The Jest TypeScript configuration differs from the main app:

```javascript
transform: {
  '^.+\\.tsx?$': ['ts-jest', {
    tsconfig: {
      jsx: 'react',              // Not 'react-jsx' for compatibility
      module: 'commonjs',        // Not 'esnext' for Node.js
      target: 'es2017',         // Compatible with Node.js
      lib: ['es2017', 'dom']    // Include DOM types
    }
  }]
}
```

### Coverage Configuration

```javascript
collectCoverageFrom: [
  'src/**/*.{ts,tsx}',
  '!src/**/*.d.ts',           // Exclude type definitions
  '!src/test/**/*',           // Exclude test files
  '!src/main.tsx',            // Exclude entry point
  '!src/config/environment.ts' // Exclude due to import.meta
],
coverageThreshold: {
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70
  }
}
```

## Common Issues & Solutions

### 1. `import.meta` Errors

**Problem**: TypeScript/Jest doesn't understand Vite's `import.meta.env`

**Solution**: 
- Mock environment in test setup
- Use separate test configuration file
- Map imports in Jest config

### 2. ES Module Issues

**Problem**: `Cannot use import statement outside a module`

**Solution**:
- Mock the module (e.g., `nanoid`)
- Add to `transformIgnorePatterns`
- Use CommonJS in test environment

### 3. React Not Defined

**Problem**: JSX requires React in scope

**Solution**:
- Import React explicitly in test files
- Use `jsx: 'react'` instead of `'react-jsx'`

### 4. TextEncoder/TextDecoder Not Defined

**Problem**: Node.js doesn't have these browser APIs

**Solution**:
- Import from `util` package
- Add polyfills in setup file

## Best Practices

### 1. Test Organization

```
feature/
├── component.tsx           # Implementation
├── component.module.css    # Styles
└── __tests__/
    └── component.test.tsx  # Tests
```

### 2. Test Naming

- **Files**: `*.test.ts` or `*.test.tsx`
- **Test Suites**: Use descriptive `describe` blocks
- **Test Cases**: Start with "should" for clarity

### 3. Mocking Strategy

```typescript
// Mock external dependencies
jest.mock('@/services/api-service');

// Mock browser APIs
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock modules with issues
moduleNameMapper: {
  'problematic-module': '<rootDir>/src/test/__mocks__/problematic-module.js'
}
```

### 4. Async Testing

```typescript
// Always use async/await with user interactions
const user = userEvent.setup();
await user.click(button);
await user.type(input, 'text');

// Wait for async operations
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});
```

### 5. Environment Isolation

- Each test should be independent
- Clean up after tests (handled by Testing Library)
- Reset mocks between tests

## Running Tests

### Local Development

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage

# CI mode
npm run test:ci
```

### Using test-local.sh

```bash
# Full test suite with build
./test-local.sh

# Skip tests for quick development
./test-local.sh --skip-tests

# Run with coverage report
./test-local.sh --coverage
```

### Debugging Tests

```bash
# Run specific test file
npm test -- chat-input.test.tsx

# Run tests matching pattern
npm test -- --testNamePattern="should upload"

# Debug in Node
node --inspect-brk node_modules/.bin/jest --runInBand
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run tests
  run: npm run test:ci
  
- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

### Google Cloud Build

```yaml
- name: 'gcr.io/cloud-builders/npm'
  args: ['run', 'test:ci']
  env:
    - 'CI=true'
```

## Troubleshooting

### Check Configuration

```bash
# Verify environment setup
npm run env:check

# Check Jest configuration
npx jest --showConfig
```

### Common Fixes

1. **Clear Jest cache**: `npx jest --clearCache`
2. **Reinstall dependencies**: `rm -rf node_modules && npm install`
3. **Check Node version**: Ensure Node.js 18+ is installed
4. **Verify test setup**: Check that setup files are running

## Future Improvements

1. **E2E Testing**: Add Playwright or Cypress for end-to-end tests
2. **Visual Regression**: Implement screenshot testing
3. **Performance Testing**: Add metrics for component render times
4. **Mutation Testing**: Use Stryker to verify test quality
5. **Contract Testing**: Add API contract tests with Pact

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [ts-jest Documentation](https://kulshekhar.github.io/ts-jest/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices) 