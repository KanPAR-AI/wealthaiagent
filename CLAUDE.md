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
- `src/store/` - Zustand stores (chat.ts for messages/sessions, auth.ts for Firebase auth state)
- `src/hooks/` - Custom React hooks for shared logic (use-auth.ts is the primary auth hook)
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
   - Firebase auth state (firebaseUser, AppUser, idToken)
   - Anonymous message counter (backed by localStorage)
   - Admin status tracking

### Routing Structure
React Router v7 with AppLayout wrapper:
- `/` - Login page (Google / Phone OTP / Email+Password / "Continue without signing in")
- `/new` - Start new chat
- `/chat` or `/chat/:chatid` - Chat interface
- `/admin` - Admin portal (`<ProtectedRoute requireAdmin>` — 403 for non-admins)
- `/trade` - Trade page
- `/debug/:chatid` - Slot debug page
- `/logs` - Debug/activity logs
- Base path: `/chataiagent/` for all routes

### Header Components
The `ChatHeader` (`src/components/chat/chat-header.tsx`) contains:
- **Sidebar trigger** - Toggle navigation sidebar
- **Logo** - Application branding
- **Debug logs link** - Bug icon linking to `/logs` for viewing debug information
- **Theme toggle** - Light/dark mode switcher
- **New chat button** - Quick access to start new conversation

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
- **Authentication**: All API calls include Firebase ID token in `Authorization: Bearer <token>` header
- **Optimistic Updates**: UI updates immediately for favorites, then syncs with backend
- **Memory Management**: Blob URLs cleaned up via `URL.revokeObjectURL()`
- **Error Handling**: SSE streams handle reconnection and error states
- **Pending Messages**: Stored in Zustand for new chat creation flow

## Authentication & Authorization

### Architecture Overview

```
Browser                              Backend (FastAPI)
──────                              ────────────────
Firebase Auth SDK                    firebase-admin SDK
  ↓ signInAnonymously() on first visit
  ↓ or signInWithPopup(Google) / signInWithEmail / signInWithPhoneNumber(OTP)
  ↓ getIdToken() → Firebase JWT
  ↓
Authorization: Bearer <firebase-id-token>
  ──────────────────────────────────→  auth.verify_id_token()
                                       ↓ extract uid, email, provider
                                       ↓ check admin_config/admin_users
                                       ↓ upsert users/{uid} in Firestore
                                       ↓ return User(is_admin, is_anonymous)
  ←──────────────────────────────────  response
```

### User Tiers

| Tier | How | Limits | Admin Link | /admin Access |
|------|-----|--------|------------|---------------|
| **Anonymous** | Auto sign-in on first visit | 3 messages, then sign-in wall | Hidden | 403 |
| **Signed-in** | Google / Email+Password / Phone OTP | Unlimited | Hidden | 403 |
| **Admin** | Email in Firestore allowlist | Unlimited | Visible in sidebar | Full access |

### Key Auth Files

**Frontend:**
| File | Role |
|------|------|
| `src/config/firebase.ts` | Firebase SDK init (API key, project ID from env vars) |
| `src/store/auth.ts` | Zustand store: `AppUser`, `idToken`, `isAuthLoading`, `anonymousMessageCount` |
| `src/components/providers/auth-provider.tsx` | `onAuthStateChanged` listener → auto anonymous → fetch `/auth/me` |
| `src/hooks/use-auth.ts` | Primary auth hook: `idToken`, `isSignedIn`, `isAdmin`, `getToken()`, sign-in/out actions |
| `src/components/auth/protected-route.tsx` | Route guard: 403 page if `requireAdmin && !isAdmin` |
| `src/components/auth/sign-in-wall.tsx` | Dialog shown after 3 anonymous messages |
| `src/pages/Login.tsx` | Login page: Google / Phone OTP / Email+Password, centered card UI |

**Backend (chatservice):**
| File | Role |
|------|------|
| `core/firebase.py` | Firebase Admin SDK init + `verify_firebase_token()` |
| `security/auth.py` | `get_current_user()`: Firebase verify → legacy JWT fallback → `get_admin_user()` |
| `services/admin_allowlist.py` | Email allowlist check (5-min cache) from Firestore `admin_config/admin_users` |
| `services/user_profile_service.py` | Upsert `users/{uid}` on login |
| `models/user.py` | `User` model: `is_anonymous`, `is_admin`, `provider`, `photo_url` |

### Admin Allowlist (Firestore)

Admin emails are stored in Firestore document `admin_config/admin_users`:
```json
{ "emails": ["ravi@yourfinadvisor.com", "ravipradeep@gmail.com"] }
```

To add a new admin: add their email to this array in Firestore Console.

### Environment Variables

```bash
# .env.local (frontend)
VITE_FIREBASE_API_KEY=AIzaSyBaV0-...
VITE_FIREBASE_AUTH_DOMAIN=aiagentapi.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=aiagentapi
VITE_FIREBASE_STORAGE_BUCKET=aiagentapi.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=388592327571
VITE_FIREBASE_APP_ID=1:388592327571:web:9b928ed2deb914ca35e666
```

### Firebase Console Setup (One-time)

1. Go to [Firebase Console](https://console.firebase.google.com/project/aiagentapi/authentication/providers)
2. Enable sign-in methods: **Google**, **Email/Password**, **Phone**, **Anonymous**
3. Add authorized domains: `localhost`, `chat.yourfinadvisor.com`
4. (Optional) Add test phone numbers: Phone → "Phone numbers for testing" (sends no real SMS)

### Local Dev Testing

**With SKIP_AUTH=true (no Firebase needed):**
The backend `security/auth.py` has a `SKIP_AUTH` escape hatch. When `SKIP_AUTH=true` in the chatservice environment, all requests are authenticated as a test admin user. This is the default for Docker development.

```bash
# Backend already runs with SKIP_AUTH=true in docker-compose
docker compose up --build

# Frontend will auto-sign-in anonymously via Firebase (requires Firebase Console setup)
# OR: if Firebase Auth isn't enabled yet, the frontend falls back gracefully
npm run dev
```

**With Firebase Auth (full flow):**
1. Enable auth methods in Firebase Console (see above)
2. Start backend: `cd chatservice && docker compose up --build`
3. Start frontend: `cd wealthaiagent && npm run dev`
4. Visit `http://localhost:5173/chataiagent/`
5. Test flows:
   - **Anonymous**: Click "Continue without signing in" → send 3 messages → sign-in wall appears
   - **Google**: Click "Continue with Google" → Google popup → redirected to /chat
   - **Email**: Enter email/password → "Create Account" or "Sign In"
   - **Admin**: Sign in with admin email → Admin Portal link visible in sidebar → /admin loads

### Production Testing

```bash
# Verify backend auth endpoint
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=test_username" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Check user info
curl http://localhost:8080/api/v1/auth/me -H "Authorization: Bearer $TOKEN"

# Verify admin endpoints require admin
curl http://localhost:8080/api/v1/admin/agents -H "Authorization: Bearer $TOKEN"
```

### Legacy Compatibility

The backend supports **both** Firebase ID tokens and legacy JWT tokens:
1. First tries Firebase `auth.verify_id_token()`
2. Falls back to legacy `jose.jwt.decode()` with `JWT_SECRET_KEY`
3. `SKIP_AUTH=true` bypasses all verification (dev/CI only)

This ensures existing test tokens work during migration.

### Auth Debugging Guide

**Blank page in production:**
- Missing Firebase env vars in `.env.production` — Vite bakes them at build time
- Check: `VITE_FIREBASE_API_KEY` must be set in `.env.production`
- Verify build includes Firebase: `npm run build` should not error on `firebase/auth`

**Login page not showing (auto-redirects to chat):**
- `SKIP_AUTH=true` backend returns `isAnonymous: false` for anonymous users
- AuthProvider trusts Firebase SDK's `isAnonymous` over backend (fixed in `auth-provider.tsx`)
- Check: `firebaseUser.isAnonymous || data.isAnonymous` in AuthProvider

**Google sign-in fails:**
- Firebase Console → Authorized domains must include your domain
- Check: `curl "https://identitytoolkit.googleapis.com/admin/v2/projects/aiagentapi/defaultSupportedIdpConfigs" -H "Authorization: Bearer $(gcloud auth print-access-token)" -H "x-goog-user-project: aiagentapi"` → should show `google.com: ENABLED`

**Phone OTP not sending:**
- Requires Firebase Blaze plan (pay-as-you-go) for real SMS (~$0.01/SMS)
- Use test phone numbers in Firebase Console for development (no SMS sent)
- Check for `auth/too-many-requests` in console — Firebase rate-limits SMS
- reCAPTCHA must initialize: check `<div id="recaptcha-container">` exists in DOM

**Anonymous message limit not working:**
- Counter stored in `localStorage` key `anonymous-message-count`
- `useAuthStore.incrementAnonymousMessageCount()` returns new count
- SignInWall shows when count > 3 (checked in `chat-input.tsx`)

**Chat loads slowly (10+ seconds):**
- Auth token must resolve before chat history loads (`use-chat-history.ts` waits for `token`)
- IndexedDB cache check + backend fetch now run in parallel (not sequential)
- Check Network tab: `/auth/me` should be <1s, `/chats/{id}` should be <3s

**Check Firebase auth providers via API:**
```bash
# Anonymous sign-in test
curl "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=YOUR_FIREBASE_API_KEY" \
  -H "Content-Type: application/json" -d '{"returnSecureToken":true}'

# Email/password sign-in test
curl "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=YOUR_FIREBASE_API_KEY" \
  -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"TestPass123!","returnSecureToken":true}'

# Check all enabled providers
curl "https://identitytoolkit.googleapis.com/admin/v2/projects/aiagentapi/config" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "x-goog-user-project: aiagentapi"
```

## Important Notes

1. **Financial Domain**: This is a financial advisor chat application - be mindful of financial terminology and user trust when modifying UI/UX.

2. **File Handling**: The app supports file uploads with preview capabilities. File cleanup is handled automatically in the chat store.

3. **Testing Required**: Always run tests before committing. Use `npm run test:watch` during development.

4. **Environment Variables**: Check `.env.example` for required variables. Use `npm run env:check` to validate.

5. **Component Creation**: When creating new components, follow the existing pattern in `src/components/ui/` using Radix UI primitives with CVA for variants.

6. **State Updates**: Use the Zustand stores for global state. Avoid prop drilling - create custom hooks instead.

7. **Routing**: All routes must use the `/chataiagent` base path. Test routing changes with `npm run preview` after building.

8. **Styling**: Use Tailwind CSS classes. The project uses Tailwind CSS 4.x with Vite plugin. Custom components use CVA for variant management.