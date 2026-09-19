# AstroMatch — the Chrome side panel (`apps/astromatch`)

The MV3 extension from [`docs/73`](../../../docs/73-astromatch-extension-spec.md).
**PH-39 (the shell) only**: sign in, type or paste the other person's details,
review what was read, and get the Kundli Milan scorecard the engine computed.
The camera (PH-40), the selection read, the shortlist and the compare view
(PH-41) are **absent, not disabled** — see `src/lib/capabilities.ts`, where
every `false` carries its reason.

**Read first:** `.claude/skills/astral-doctrine`, and
[`docs/51`](../../../docs/51-astral-operations.md) before running anything —
a local backend writes the PRODUCTION Firestore.

## Build and load

```bash
cd wealthaiagent/apps/astromatch

npm run build:dev     # dist/ talks to http://localhost:8080   (name says "(dev)")
npm run build         # dist/ talks to https://chatbackend.yourfinadvisor.com
npm run dev           # the dev build, rebuilt on save
npm run typecheck
```

Then: **chrome://extensions → Developer mode → Load unpacked → pick
`apps/astromatch/dist`**. Click the toolbar icon to open the side panel. After
a rebuild, press **Reload** on the extension card — Chrome does not watch the
directory.

The dev/prod switch is the build mode and nothing else:

| | dev build | production build |
|---|---|---|
| backend | `http://localhost:8080` | `https://chatbackend.yourfinadvisor.com` |
| `host_permissions` | the backend **and** localhost | the backend, and only it |
| name in Chrome's list | `AstroMatch — Kundli Milan (dev)` | `AstroMatch — Kundli Milan` |

`manifest.json` is **generated** from `src/lib/manifest.ts` at build time, so
`manifest.test.ts` asserts the same object Chrome loads. Do not hand-edit
`dist/`.

> ⚠ A dev build points at localhost, and the local container is configured as
> a user against the **production** Firestore project. Check
> `docker exec yourfinadvisor_api env | grep SKIP_AUTH_USER_ID` before a run
> that can write. Anything you create in a walkthrough is real; delete it.

## Tests

They run in the **root** jest project (`wealthaiagent/`), like `apps/astro`'s:

```bash
cd wealthaiagent
npx jest apps/astromatch packages/astral packages/astral-dom
npx tsc --noEmit -p apps/astromatch/tsconfig.json
```

Fixtures under `src/lib/__tests__/fixtures/` are **captured from the running
engine** — two SSE streams and two `resolve-location` responses. The parser's
corpus is **synthetic biodata text written for the test**; no text is copied
from any live profile.

`type-fixtures/` holds two files that exist to **fail** type-checking (a parse
handed to the worker's door; a two-state field). They are excluded from
`tsconfig.json` on purpose and are compiled by the tests that assert their
errors.

## The shape of it

```
src/lib/        the decisions — pure, no React, no chrome.*, tested at the root
  manifest.ts     the manifest as a value, with a reason per permission
  capabilities.ts what this build can do; a false REMOVES its control
  badge.ts        the toolbar state, from the tab URL and nothing else
  parse-profile.ts the local biodata parser — offline, output never sent
  confirmed.ts    the trust boundary: parsed ≠ confirmed, branded
  review-view.ts  the review screen's rules and the three place failures
  transport.ts    the docs/73 §3a sequence over @wealthai/core
  messages.ts     the panel ↔ worker protocol
src/sw.ts       the service worker — the ONLY thing with network (F154)
src/panel/      React. bridge.ts is the only file that touches chrome.*
```

An **unsaved reading is deleted**, four ways: *Read another match*, sign out,
*Delete this reading now*, and **closing the panel** — the last one from the
service worker, on the port's disconnect. A browser that quits first leaves the
chat id in `chrome.storage.local` (**ids only**, never a birth value) and the
next worker start or panel open sweeps it, telling the user it did.

The birth details you type travel in a chat MESSAGE, which has no expiry of its
own. `src/lib/retention-view.ts` declares exactly what `DELETE /chats/{id}`
removes — the messages, the slot events, the chat doc, and a best-effort Redis
purge whose TTL is 24 hours — and the sentences may claim nothing beyond the
chat. (The engine side of that contract is pinned by
`chatservice/tests/test_chat_delete_contract.py`.)

Three rules, enforced by tests rather than by convention:

1. **The client derives nothing.** No percentage, no band, no `/36` on a
   firm-only match, no ranking. The scorecard is `@wealthai/astral`'s,
   rendered through `@wealthai/astral-dom` at 380 px.
2. **Parsed is not confirmed.** Only the object the user approved, field by
   field, leaves the browser — and the type system refuses the other one.
3. **All network lives in the service worker.** The panel has no fetch and no
   credential.
