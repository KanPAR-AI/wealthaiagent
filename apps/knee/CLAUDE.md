# CLAUDE.md — KneeFit (`apps/knee`)

The knee-arthritis workout app. Expo SDK 57 / expo-router, an npm workspace
inside `wealthaiagent`, modeled file-for-file on `apps/astro` (read its
CLAUDE.md — the three enforced rules apply here verbatim):

1. **`src/lib/capabilities.ts` is the only thing a surface consults.** A
   `false` REMOVES its tab/row/tile; every `false` carries its reason.
   Today and Progress are absent until the user_progress store exists in
   chatservice — that map entry is where they flip on.
2. **Every screen rule lives in a pure `*-view.ts`** tested from the
   workspace root (`npx jest apps/knee`), fixtures captured from the running
   engine (`src/lib/__tests__/fixtures/`), imports by relative path.
3. **The client derives nothing.** Membership, order, counts, completeness
   and dub languages come from `GET /api/v1/knee/program*`
   (`chatservice/api/v1/endpoints/knee_program.py`); the screen states the
   server's count verbatim.

The design of record is the "KneeFit App Design" canvas (Terra direction);
`src/theme/index.ts` is its checked-in token twin, including the four-hue
phase ramp. Agent pinned to `knee_arthritis` (`lib/chat-host.ts`), routing
off — the astro D3 pattern.

No native Firebase, no store identity yet: bundle `com.yourfinadvisor.knee`
is declared but unregistered; auth is the JS SDK against the project's web
registration. Before shipping anything, read `../../../docs/51` — the local
backend writes PRODUCTION data.

```bash
npx tsc --noEmit -p apps/knee/tsconfig.json
npx jest apps/knee
cd apps/knee && npx expo export --platform ios --output-dir /tmp/x
```

## Android build traps (both measured)

- `npx expo prebuild -p android` REGENERATES `android/gradle.properties`,
  wiping the memory bump — re-apply
  `org.gradle.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=2g` after every prebuild
  or `:expo-updates:kspReleaseKotlin` dies with a Metaspace OOM.
- Always build with `-x lintVitalRelease -x lintVitalAnalyzeRelease -x lint`
  (lint crashes on this dependency set under JBR 21).
