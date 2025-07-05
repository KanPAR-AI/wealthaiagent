# Testing Documentation

## Overview

This project uses Jest and React Testing Library for unit testing React components and hooks. The tests are integrated into both local development workflow and CI/CD pipelines.

## Test Structure

```
src/
├── components/
│   └── chat/
│       └── __tests__/
│           ├── chat-input.test.tsx
│           └── file-preview-modal.test.tsx
├── hooks/
│   └── __tests__/
│       ├── use-jwt-token.test.ts
│       └── use-chat-session.test.ts
├── services/
│   └── __tests__/
│       └── chat-service.test.ts
├── store/
│   └── __tests__/
│       └── chat.test.ts
└── test/
    ├── mocks/
    │   ├── handlers.ts
    │   └── server.ts
    ├── setup.ts
    └── utils.tsx
```

## Running Tests

### Local Development

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with summary report
npm run test:summary

# Run CI tests (used in pipelines)
npm run test:ci
```

### Using the test-local.sh Script

```bash
# Make script executable (first time only)
chmod +x test-local.sh

# Run complete local test suite
./test-local.sh
```

This script will:
1. Check for npm installation
2. Install dependencies if needed
3. Run linting
4. Run unit tests
5. Build the application
6. Start the development server (if all tests pass)

## Test Coverage

Current test coverage requirements:
- Statements: 70%
- Branches: 70%
- Functions: 70%
- Lines: 70%

## Test Cases Implemented

### Authentication & Session Management
- **TC_001**: Token Fetching - Success ✅
- **TC_002**: Token Session Validation ✅
- **TC_003**: New Chat Creation - Success Flow ✅
- **TC_004**: First Message Display and Streaming ✅
- **TC_005**: Token Fetching - Failure Scenario ✅
- **TC_006**: Chat Creation - Invalid Token ⏳

### File Upload & Management
- **TC_007**: Single Image Upload ✅
- **TC_008**: Multiple Image Upload ✅
- **TC_009**: Mixed File Types Upload ✅
- **TC_010**: File Preview Display ✅
- **TC_011**: File Upload Failure - Network Error ⏳
- **TC_012**: File Upload Failure - Size Limit Exceeded ⏳
- **TC_013**: File Upload Failure - Unsupported Format ⏳
- **TC_014**: Optimistic UI - Instant File Display ✅
- **TC_015**: Firebase Storage Upload Success ⏳
- **TC_016**: Firebase Storage Upload Failure ⏳
- **TC_017**: Loading State Visibility ✅
- **TC_018**: Multiple File Upload with Partial Failure ⏳

### File Preview
- **TC_019**: Full Screen Preview - Images ✅
- **TC_020**: Full Screen Preview - PDF ✅

## Writing New Tests

### Component Test Example

```typescript
import { render, screen } from '@/test/utils';
import userEvent from '@testing-library/user-event';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  const user = userEvent.setup();

  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    render(<MyComponent />);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    expect(screen.getByText('Updated Text')).toBeInTheDocument();
  });
});
```

### Hook Test Example

```typescript
import { renderHook, act } from '@testing-library/react';
import { useMyHook } from '../useMyHook';

describe('useMyHook', () => {
  it('should update state correctly', () => {
    const { result } = renderHook(() => useMyHook());
    
    act(() => {
      result.current.updateValue('new value');
    });
    
    expect(result.current.value).toBe('new value');
  });
});
```

## Mocking

### API Mocking with MSW

We use Mock Service Worker (MSW) to mock API calls:

```typescript
// src/test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/endpoint', () => {
    return HttpResponse.json({ data: 'mocked' });
  })
];
```

### File Uploads

Use the `createMockFile` utility:

```typescript
import { createMockFile } from '@/test/utils';

const file = createMockFile('test.pdf', 'application/pdf');
```

## CI/CD Integration

### GitHub Actions

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main`

See `.github/workflows/ci.yml` for configuration.

### Google Cloud Build

Tests are integrated into the Cloud Build pipeline:
1. Tests run before Docker image build
2. Build only proceeds if tests pass
3. Test coverage is stored as build artifacts

See `cloudbuild.yaml` for configuration.

### Docker Build

The Dockerfile includes test execution:
```dockerfile
# Run tests during build
RUN npm run test:ci

# Run linting
RUN npm run lint
```

## Troubleshooting

### Common Issues

1. **Tests fail with "Cannot find module"**
   - Run `npm install` to ensure all dependencies are installed
   - Check that path aliases in `jest.config.js` match `tsconfig.json`

2. **MSW not intercepting requests**
   - Ensure MSW server is started in `src/test/setup.ts`
   - Check that request URLs match handler patterns

3. **Coverage not meeting thresholds**
   - Run `npm run test:coverage` to see detailed coverage report
   - Focus on testing critical paths and edge cases

## Best Practices

1. **Test Organization**
   - Place tests in `__tests__` folders next to the code they test
   - Use descriptive test names that explain what is being tested

2. **Test Quality**
   - Test behavior, not implementation details
   - Use React Testing Library queries that reflect how users interact
   - Avoid testing third-party libraries

3. **Mocking**
   - Mock external dependencies (APIs, timers, etc.)
   - Keep mocks simple and focused on the test case
   - Update mocks when API contracts change

4. **Performance**
   - Use `beforeEach` to reset state between tests
   - Clean up after tests to prevent memory leaks
   - Run tests in parallel when possible (`--maxWorkers`)

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [MSW Documentation](https://mswjs.io/docs/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) 