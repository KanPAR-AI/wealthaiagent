# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm run dev              # Start Vite dev server on port 5173
npm run preview          # Preview production build
npm run deploy:local     # Run tests and start dev server (recommended for development)
```

### Building & Quality
```bash
npm run build           # TypeScript compilation + Vite production build
npm run lint            # Run ESLint checks with TypeScript rules
```

### Testing
```bash
npm test                # Run Jest tests once
npm run test:watch      # Run tests in watch mode for TDD
npm run test:coverage   # Generate coverage report (thresholds: 70%)
npm run test:ci         # Run tests in CI mode with coverage
```

### Environment Setup
```bash
npm run env:init        # Create .env.local from .env.example
npm run env:check       # Validate environment variables
```

### Deployment
```bash
npm run deploy:production  # Build for production deployment
npm run deploy:gcp         # Deploy to Google Cloud Platform
```

## Architecture

### Tech Stack
- **React 19** with TypeScript 5.7 (strict mode)
- **Vite 6.3** for bundling with path alias `@/*` → `src/*`
- **Tailwind CSS 4.x** with Vite plugin integration
- **Zustand 5.0** for state management
- **React Router 7.5** with basename `/chataiagent`
- **Radix UI** components following shadcn/ui patterns
- **Jest + React Testing Library** for testing with MSW for API mocking

### Key Directories
- `src/components/chat/` - Chat interface components (message list, input, actions)
- `src/components/ui/` - Reusable UI primitives (shadcn-style with Radix UI)
- `src/store/` - Zustand stores (chat.ts for messages/sessions, auth.ts for JWT)
- `src/hooks/` - Custom React hooks for shared logic
- `src/services/` - API service layer and business logic
- `src/types/` - TypeScript type definitions
- `src/test/` - Test utilities and MSW handlers

### State Management
The application uses Zustand with two main stores:

1. **useChatStore** (`src/store/chat.ts`):
   - Chat sessions and messages
   - Pending messages for new chats
   - File attachments with cleanup

2. **useAuthStore** (`src/store/auth.ts`):
   - JWT token management
   - Authentication state

### Routing Structure
React Router v7 with AppLayout wrapper:
- `/` - Home/landing page
- `/new` - Start new chat
- `/chat/:chatid` - Existing chat session
- `/logs` - Activity logs
- Base path: `/chataiagent/` for all routes

### Testing Approach
- Coverage thresholds: 70% (branches, functions, lines, statements)
- Test files co-located with components (`.test.tsx`)
- MSW for API mocking in `src/test/mocks/`
- Custom test utilities in `src/test/utils.tsx`
- Run individual tests: `npm test -- path/to/test`

### Component Patterns
- **Feature-based organization** with domain-specific folders
- **Compound components** for complex UI (e.g., ChatMessage with sub-components)
- **UI primitives** in `src/components/ui/` using Radix UI + CVA for variants
- **Custom hooks** for reusable logic (useChat, useAuth, useFileUpload, etc.)

### Build Configuration
- **Vite config** includes PWA plugin and Tailwind CSS
- **Path aliases**: Use `@/` for imports from `src/`
- **Base path**: `/chataiagent/` for deployment
- **TypeScript**: Strict mode with project references

## Core System Flows

### Chat Creation & Messaging
1. **New Chat**: POST `/api/v1/chats` → returns chat ID → navigate to `/chat/:id`
2. **Existing Chat Messages**: POST `/api/v1/chats/:id/messages` with content and file URLs
3. **History Loading**: GET `/api/v1/chats/:id` fetches full message history (skipped during pending message processing to avoid race conditions)

### Real-time Streaming (SSE)
- Opens connection via GET `/api/v1/chats/:id/stream`
- Processes events: `message_delta` (text chunks), `message_complete`, `graph_data`, `table_data`
- Handles UTF-8 decoding and chunk assembly
- Auto-closes on completion

### File Operations
1. **Upload**: POST `/api/v1/files/upload` as multipart/form-data → returns secure URLs
2. **Preview**: Fetches file with JWT auth → creates blob URL → displays in modal → cleanup on close
3. **Attachments**: Stored as `MessageFile[]` with `{name, type, url, size}`

### Key Implementation Details
- **Authentication**: All API calls include JWT in Authorization header
- **Optimistic Updates**: UI updates immediately for favorites, then syncs with backend
- **Memory Management**: Blob URLs cleaned up via `URL.revokeObjectURL()`
- **Error Handling**: SSE streams handle reconnection and error states
- **Pending Messages**: Stored in Zustand for new chat creation flow

## Important Notes

1. **Financial Domain**: This is a financial advisor chat application - be mindful of financial terminology and user trust when modifying UI/UX.

2. **File Handling**: The app supports file uploads with preview capabilities. File cleanup is handled automatically in the chat store.

3. **Testing Required**: Always run tests before committing. Use `npm run test:watch` during development.

4. **Environment Variables**: Check `.env.example` for required variables. Use `npm run env:check` to validate.

5. **Component Creation**: When creating new components, follow the existing pattern in `src/components/ui/` using Radix UI primitives with CVA for variants.

6. **State Updates**: Use the Zustand stores for global state. Avoid prop drilling - create custom hooks instead.

7. **Routing**: All routes must use the `/chataiagent` base path. Test routing changes with `npm run preview` after building.

8. **Styling**: Use Tailwind CSS classes. The project uses Tailwind CSS 4.x with Vite plugin. Custom components use CVA for variant management.