# CLAUDE.md — Astral AI (`apps/astro`)

The standalone Jyotish app. Expo SDK 57 / RN 0.86 / expo-router, an npm
workspace inside `wealthaiagent`. Bundle `com.yourfinadvisor.astro`, App Store
name **Astral AI**.

**Read first:**
- `.claude/skills/astral-doctrine` — the invariants. Non-optional.
- [`docs/51-astral-operations.md`](../../../docs/51-astral-operations.md) —
  environments, releases, verification, incidents.
- [`docs/49-astral-spec.md`](../../../docs/49-astral-spec.md) — the ASTRAL-*
  rows for whatever you are building.
- `AGENTS.md` next door: **Expo has changed.** Read the versioned docs at
  https://docs.expo.dev/versions/v57.0.0/ before writing code.

---

## ⚠️ Before you run anything

The local backend talks to the **production Firestore project**. Since
2026-08-25 the container identity is a throwaway uid
(`SKIP_AUTH_USER_ID=local-dev-throwaway-uid`) — but that is a configuration,
not a law, and `docker compose restart` does **not** re-read `.env`. Verify it
every session before any write-capable run:

```bash
docker exec yourfinadvisor_api env | grep -E "SKIP_AUTH_USER_ID|GOOGLE_CLOUD_PROJECT"
```

`GET` is safe. **Typing into a form is still a write to production Firestore**
(under whatever uid is set) — a real-user uid here is how the owner's birth
record was overwritten on 2026-08-25 (docs/51 §3 and §9).

`.env.local` (gitignored) points the app at a backend; with no `.env.local` it
talks to **production**. `EXPO_PUBLIC_*` is inlined at bundle time, so restart
Metro after changing it.

---

## Layout

```
src/app/            expo-router routes
  index.tsx           screen 1 — splash / onboarding (OUTSIDE the tabs)
  (tabs)/             the five-tab shell — a LAYOUT GROUP, not a URL segment
    home.tsx            screen 3 — the day's card (N1)
    insights.tsx        screen 8 — the same card, faceted into four tabs
    chat.tsx            screen 4 — <ChatSurface> from @wealthai/chat-native
    timeline.tsx        screen 9 — dasha-first (N2)
    settings.tsx        screen 12 — "Profile" on the bar; rows from the map
  birth-details.tsx   screen 2 · profile.tsx · matches.tsx · preferences.tsx
                      privacy.tsx · help.tsx · about.tsx   (push OVER the bar)
  chart.tsx           screen 5 — Your Birth Chart (chart/grahas/dasha tabs;
                      capability `chart`)                         (PH-27)
  match.tsx           screen 6 — native scorecard from one stored read (PH-27)
  palm.tsx            palm capture → reading; Home tile — capability `palm`
                      currently FALSE, so tile + route are removed  (AMB-26a)
  muhurta.tsx         muhurta windows; Home tile                   (AMB-26a)
src/lib/            the decisions — pure modules, tested at the workspace ROOT
src/components/     drawn glyphs, sky/scene SVG, tab icons
src/theme/          the ONLY place a colour, size or type step is declared
```

Because `(tabs)` is a layout group, `/chat` and `/settings` are unchanged —
every deep link, the birth-details handoff and "Ask AI about this match" keep
resolving. Moving a screen in or out of the group must preserve its path.

## Three rules, enforced by tests

1. **`lib/capabilities.ts` is the only thing a surface may consult.** A `false`
   **removes** the tab, row or tile — not greyed, not "coming soon". Every
   `false` carries its reason in a comment. `lib/tabs.ts` and
   `lib/settings-rows.ts` derive from it; flipping one entry changes the SET.
2. **Every decision lives in a pure `*-view.ts`** — no React, no react-native,
   no expo — so the root jest project can run it. The screen renders what the
   view model returns and decides nothing.
3. **The client derives nothing.** No sign from a longitude, no dasha from a
   date, no "today" from a device clock, no category from a planet. If a screen
   needs it, the engine computes it and it travels on the wire.

## Tests

They live in `src/lib/__tests__/` and run in the **root** jest project:

```bash
cd wealthaiagent
npx tsc --noEmit -p apps/astro/tsconfig.json
npx jest apps/astro packages/astral
cd apps/astro && npx expo lint && npx expo export --platform ios --output-dir /tmp/x
```

- **Import by relative path.** `@/*` maps to the *web* app's `src` in the root
  jest project, so `@/lib/foo` silently resolves to a different file.
- **Fixtures are captured from the running engine** (`__tests__/fixtures/`),
  never hand-written — a hand-written fixture proves the client parses what
  somebody imagined. Re-capture when the wire shape changes.
- Source greps (`no fetch here`, `no clock here`) **strip comments first**;
  otherwise a comment explaining the rule trips the rule.

## Shipping

`SKILLS/mobile-release.md`. Short version: **backend first**, verify the Cloud
Run revision changed, then OTA (`eas update --channel production`) for JS, or a
TestFlight build for anything native — bumping `CURRENT_PROJECT_VERSION` **and**
`app.json`'s `ios.buildNumber`, because `ios/` is gitignored.

Android exists since 2026-08-28: `eas.json` has one `production` profile
(EAS Build, APK, internal distribution, `node: 24.10.0`) — unlike iOS, the
Android binary is EAS-built, so EAS injects the OTA channel/runtime headers
itself. And after ANY push, confirm the frontend Cloud Build **STATUS** —
five builds failed silently 2026-08-28→09-03 (docs/51 §9, ASTRAL-119).
