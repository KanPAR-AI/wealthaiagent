# CLAUDE.md — Web App (wealthaiagent)

React 19 + TypeScript 5.7 frontend for the YourFinAdvisor chat platform. See [`../docs/`](../docs/) for detailed docs.

This repo is also an npm-workspaces monorepo with **two shipped React Native
(Expo) apps**:

| App | Path | Store identity | What it is |
|---|---|---|---|
| **Arthur1203** | [`apps/mobile/`](apps/mobile/) (own CLAUDE.md/AGENTS.md) | `com.yourfinadvisor.mobile` | the YourFinAdvisor app — all agents, drawer, credits, Control Centre |
| **Astral AI** | [`apps/astro/`](apps/astro/) | `com.yourfinadvisor.astro` | the standalone Jyotish app — five tabs, agent pinned, routing off |

Shared platform-agnostic services live in `packages/core` (`@wealthai/core`),
the chat surface in `packages/chat-native`, the astrology renderers in
`packages/astral`. The web app stays at the repo root.

**Before running or shipping either app**, read
[`../docs/51-astral-operations.md`](../docs/51-astral-operations.md): the
local backend is configured as a real production user, and a client shipped
ahead of the backend gets 404s that render as an outage. Skills:
`SKILLS/astral-ai.md` (engineering) and `SKILLS/mobile-release.md`
(shipping).

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
- **Zustand 5.0** for state (admin.ts, auth.ts, chat.ts, meal-plan.ts, memory-ui.ts, trade.ts)
- **React Router 7.5** with basename `/chataiagent` on web (`'/'` on native Capacitor builds)
- **Radix UI** + shadcn/ui patterns
- **Jest + React Testing Library + MSW**

## Key Directories

```
src/components/chat/        # Chat UI (message list, input, streaming, sidebar)
src/components/ui/          # Reusable UI primitives (25+ shadcn-style)
src/components/widgets/     # 24 SSE widget types registered in widget-renderer.tsx
                            #   + 4 fenced-markdown widgets in chat/response.tsx
src/components/meal-plan/   # Meal plan components (variety score, staleness)
src/pages/                  # 15 page files + pages/memory/
src/store/                  # Zustand stores: admin.ts, auth.ts, chat.ts,
                            #   meal-plan.ts, memory-ui.ts, trade.ts (6)
src/hooks/                  # Custom hooks (use-auth, use-chat-messages, use-chat-session)
src/services/               # API layer: ~29 service files + repositories/
                            #   (memory-engine, loops, jarvis, orderbook,
                            #    agent-builder, corpus-*, …)
src/types/                  # TypeScript definitions
```

npm workspaces cover both `packages/*` and `apps/*`: `packages/core`
(`@wealthai/core`, platform-agnostic services shared by web and mobile) and
`apps/mobile` (the Expo app).

## Routes

| Path | Component | Notes |
|------|-----------|-------|
| `/` | Login | Google / Phone OTP / Email / Anonymous |
| `/new` | New chat | |
| `/chat` | New chat | Alias of `/new` |
| `/chat/:chatid` | Chat | Main interface |
| `/a/:slug` | AgentLanding | Agent landing page |
| `/settings` | Settings | `<ProtectedRoute requireAuth>` |
| `/orderbook` | Order Book | `<ProtectedRoute requireAuth>` |
| `/trade` | Trade | |
| `/logs` | Logs | |
| `/admin` | Admin | `<ProtectedRoute requireAdmin>` |
| `/admin/bugs` | Bug reports | `<ProtectedRoute requireAdmin>` |
| `/admin/test/:agentId` | Agent test | `<ProtectedRoute requireAdmin>` |
| `/memory/*` | Memory OS "Control Centre" | Overview/Memories/Inbox/Timeline/Graph/Debugger/Run; gated signed-in non-anonymous (`MemoryRouteGuard`); entry in chat-sidebar footer. Docs: `../docs/memory-ui/` |
| `/mealplan/:chatid` | MealPlan | Week nav, generate, swap |
| `/debug/:chatid` | Debug | Slot inspector |

Layout: `/orderbook` and `/settings` render **inside** `AppLayout` (chat chrome
— sidebar etc.), while `/trade`, `/logs`, `/debug`, `/admin/*`, and `/memory/*`
render outside it.

Base path: routes live under `/chataiagent/` on web, but the router basename is
`'/'` on native Capacitor builds (`const basename = isNativePlatform ? '/' :
'/chataiagent'`).

## Widget System

See [`../docs/11-widget-system.md`](../docs/11-widget-system.md).

**24 SSE widget types** are registered in `widget-renderer.tsx` (the registry of
record), plus **4 fenced-markdown widgets** in `chat/response.tsx`:

| Group | Types |
|-------|-------|
| Charts | pie / bar / line / composed |
| Calculators | compound-interest / SIP / mortgage / retirement |
| Conversational input | action-tiles, multi-select, onboarding-form, cuisine-proportions, specialist-picker |
| Financial planner | 10 `widget_financial_*` types in `widgets/financial-planner/` |
| Table | table widget |

Interactive widgets dispatch `chat-quick-reply` CustomEvent (not direct store calls):
```typescript
window.dispatchEvent(new CustomEvent('chat-quick-reply', { detail: { text } }))
```

**Fenced-markdown path** (bypasses `chat-quick-reply`): `response.tsx` hands
every fenced block to the **block registry** in `chat/block-registry.tsx`
(docs/49 ASTRAL-20). Seven types are registered — `bedtime_video`,
`palm_scanning` (streaming-only), `palm_analysis`, `palm_predictions`, and,
since PH-3, `natal_chart` / `match_report` / `muhurta_results`, which render
through `@wealthai/astral`. A fence is treated as *data* only when its language
equals the JSON body's own `type`, so an ordinary ```json or ```python fence
still renders as code. An **unregistered** data block renders nothing and logs
one warning naming the type — the three astrology blocks above were silently
dropped for months because that warning did not exist.

**`@wealthai/astral`** (`packages/astral/`): the astrology renderers — natal
wheel, match scorecard, muhurta windows — written ONCE against a small
primitive contract (`primitives.ts`) so the same source file serves the web
app, the 380px AstroMatch extension panel and the React Native app. Web binds
it in `src/components/astral/` (`dom-primitives.tsx`, `astral-block.tsx`);
mobile in `apps/mobile/src/components/astral/`. A second implementation of the
scorecard anywhere in the workspace is a SPEC-DEVIATION and
`packages/astral/src/__tests__/structural.test.ts` fails on it.

Mobile-first: 24px slider thumbs, `touch-none`, `active:scale` feedback.

## apps/astro (Astral AI)

Expo Router with a **five-tab shell** at `src/app/(tabs)/` — Home · Insights ·
AI Chat · Timeline · Profile. `(tabs)` is a *layout group*, **not a URL
segment**: `/chat` and `/settings` are unchanged, so every deep link and
handoff still resolves.

Three rules that are enforced by tests, not by convention:

- **`src/lib/capabilities.ts` is the only thing a surface may consult.** A
  capability marked `false` **removes** its tab, row or tile — never greys it,
  never "coming soon". Every `false` carries its reason.
- **Every screen rule lives in a pure `*-view.ts` module** (no React, no
  react-native, no expo) so the ROOT jest project can run it. Tests sit in
  `src/lib/__tests__/` and import by **relative path** — `@/*` maps to the
  *web* app's `src` there, so `@/lib/foo` silently resolves elsewhere.
- **The client derives nothing.** No sign from a longitude, no dasha from a
  date, no "today" from a device clock, no category from a planet. Fixtures
  under `src/lib/__tests__/fixtures/` are **captured from the running
  engine**, not hand-written.

```bash
npx tsc --noEmit -p apps/astro/tsconfig.json
npx jest apps/astro packages/astral
cd apps/astro && npx expo lint && npx expo export --platform ios --output-dir /tmp/x
```

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
