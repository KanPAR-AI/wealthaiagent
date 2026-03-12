# CLAUDE.md — Web App (wealthaiagent)

React 19 + TypeScript 5.7 frontend for the YourFinAdvisor chat platform. See [`../docs/`](../docs/) for detailed docs.

## Commands

```bash
npm run dev              # Vite dev server on :5173
npm run build            # TypeScript + Vite production build
npm run lint             # ESLint
npm test                 # Jest tests
npm run test:coverage    # Coverage (70% threshold)
npm run deploy:gcp       # Deploy to GCP
```

## Tech Stack

- **React 19** with TypeScript 5.7 (strict mode)
- **Vite 6.3** — path alias `@/*` → `src/*`, base path `/chataiagent/`
- **Tailwind CSS 4.x** with Vite plugin
- **Zustand 5.0** for state (chat.ts, auth.ts, meal-plan.ts)
- **React Router 7.5** with basename `/chataiagent`
- **Radix UI** + shadcn/ui patterns
- **Jest + React Testing Library + MSW**

## Key Directories

```
src/components/chat/        # Chat UI (message list, input, streaming, sidebar)
src/components/ui/          # Reusable UI primitives (25+ shadcn-style)
src/components/widgets/     # Interactive inline widgets (5 types)
src/components/meal-plan/   # Meal plan components (variety score, staleness)
src/pages/                  # MealPlan.tsx, Login.tsx, Admin.tsx
src/store/                  # Zustand stores
src/hooks/                  # Custom hooks (use-auth, use-chat-history)
src/services/               # API layer (chat-service.ts, meal-plan-service.ts)
src/types/                  # TypeScript definitions
```

## Routes

| Path | Component | Notes |
|------|-----------|-------|
| `/` | Login | Google / Phone OTP / Email / Anonymous |
| `/new` | New chat | |
| `/chat/:chatid` | Chat | Main interface |
| `/admin` | Admin | `<ProtectedRoute requireAdmin>` |
| `/mealplan/:chatid` | MealPlan | Week nav, generate, swap |
| `/debug/:chatid` | Debug | Slot inspector |

All routes under base path `/chataiagent/`.

## Widget System

See [`../docs/11-widget-system.md`](../docs/11-widget-system.md).

All widgets dispatch `chat-quick-reply` CustomEvent (not direct store calls):
```typescript
window.dispatchEvent(new CustomEvent('chat-quick-reply', { detail: { text } }))
```

| Widget | File | Purpose |
|--------|------|---------|
| Onboarding Form | `onboarding-form-widget.tsx` | Profile collection (sliders, dropdowns, pills) |
| Specialist Picker | `specialist-picker-widget.tsx` | 6 nutrition specialist cards |
| Multi-Select | `multi-select-widget.tsx` | Multi-choice with "Other" input |
| Cuisine Proportion | `cuisine-proportion-widget.tsx` | Slider-based cuisine weights |
| Action Tiles | `action-tiles-widget.tsx` | Quick-reply buttons |

Mobile-first: 24px slider thumbs, `touch-none`, `active:scale` feedback.

## Auth

Firebase Auth with anonymous → signed-in → admin tiers.
See [`../docs/06-authentication.md`](../docs/06-authentication.md).

## Environment

```bash
# .env.local
VITE_API_BASE_URL=http://localhost:8080
VITE_API_VERSION=v1
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=aiagentapi.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=aiagentapi
VITE_FIREBASE_STORAGE_BUCKET=aiagentapi.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=388592327571
VITE_FIREBASE_APP_ID=...
```
