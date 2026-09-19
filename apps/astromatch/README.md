# AstroMatch — the Chrome side panel (`apps/astromatch`)

The MV3 extension from [`docs/73`](../../../docs/73-astromatch-extension-spec.md).
**PH-39 (the shell) + PH-40 (the snapshot)**: sign in, **read the page with the
camera** or type or paste the other person's details, review what was read,
get the Kundli Milan scorecard the engine computed, and then either add the
person to your matches or take the reading and keep nothing. The selection
read, the shortlist and the compare view (PH-41) are **absent, not disabled**
— see `src/lib/capabilities.ts`, where every `false` carries its reason.

## The camera, and what Chrome will and will not allow (F159)

`chrome.tabs.captureVisibleTab` needs `activeTab`, and `activeTab` is granted
by a gesture **on the extension** — the toolbar action, a keyboard command, a
context-menu item. Whether that grant reaches a button INSIDE the side panel
is the question docs/73 F159 refused to answer from documentation.

**Measured in Chromium 145.0.7632.6 on 2026-09-19** (`e2e/spike-f159.mjs`):

| probe | result |
|---|---|
| panel document → `captureVisibleTab`, no gesture, https page | REFUSED — `Either the '<all_urls>' or 'activeTab' permission is required.` |
| service worker → the same | REFUSED, same sentence |
| worker → a `localhost:8099` page, with `http://localhost:8080/*` in `host_permissions` | REFUSED — a match pattern does **not** wildcard the port |
| worker → the extension's OWN page | REFUSED — there is no implicit self-grant |

What the spike could **not** do is click Chrome's toolbar, press a
browser-level shortcut or open a native context menu: all three are
browser-process gestures and Playwright drives the renderer. So the exact
F159 question — does the action click's grant reach the panel's button? — is
still owed by a **human at a real Chrome**.

**The build does not wait for that answer.** The camera button ASKS the
worker; the worker either captures or answers `needs-gesture`, and the panel
then prints the shortcut **Chrome actually bound** (`chrome.commands.getAll()`
— "⌥⇧M" on macOS, "Alt+Shift+M" elsewhere) and the "Read this page into
AstroMatch" menu item. A button that cannot capture becomes words. Both
fallbacks are built, and both ship with the listener that honours them.

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

`photo-masks.json` holds three synthetic layouts with a **procedural**
photo-like texture (value noise + soft blobs + a gradient — not a face, not a
downloaded image, not a real person) and records each layout's OWN rectangles,
so the photo-exclusion assertions run against ground truth rather than against
the algorithm.

Fixtures under `src/lib/__tests__/fixtures/` are **captured from the running
engine** — three SSE streams (including the time-less firm-only reading the
camera actually produces), two `resolve-location` responses, and one live
`extract-profile` answer. `ink-profiles.json` is measured from the ENGINE's
own synthetic screenshot corpus (`chatservice/tests/fixtures/profile_shots/`)
in a real Chromium. The parser's corpus is **synthetic biodata text written
for the test**; no text and no image is copied from any live profile.

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
  capture.ts      the camera's decisions: the three gestures, the refusal,
                  the instruction, the one-capture hand-off slot
  crop.ts         the crop geometry — the edge mask, the block segmentation
                  (text / photograph / rule), where the box OPENS (never the
                  page, never the photo), the keyboard moves, the size bound,
                  the encoding
  consent.ts      the per-capture consent, verbatim, and the one-key body
  extract.ts      the §4 response and its five designed failures
  chips.ts        the six common questions; which cost nothing and why
  confirmed.ts    the trust boundary: parsed ≠ confirmed, branded
  review-view.ts  the review screen's rules, the three place failures, and
                  the confidence bands
  transport.ts    the docs/73 §3a sequence over @wealthai/core
  messages.ts     the panel ↔ worker protocol
src/sw.ts       the service worker — the ONLY thing with network (F154), and
                the only place `chrome.tabs.captureVisibleTab` is called
src/panel/      React. bridge.ts is the only file that touches chrome.*
  crop.tsx        the crop tool and the consent line
  chips.tsx       the chips and their answers
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

Six rules, enforced by tests rather than by convention:

1. **The client derives nothing.** No percentage, no band, no `/36` on a
   firm-only match, no ranking. The scorecard is `@wealthai/astral`'s,
   rendered through `@wealthai/astral-dom` at 380 px.
2. **Parsed is not confirmed.** Only the object the user approved, field by
   field, leaves the browser — and the type system refuses the other one.
3. **All network lives in the service worker.** The panel has no fetch and no
   credential.
4. **The default box excludes the PHOTOGRAPH.** The capture is measured in
   two dimensions — a packed edge mask, transient, dropped with the bitmap —
   and segmented into column blocks classified `text` / `solid` / `rule` by
   edge density and size. The box is the span of TEXT blocks. When one
   rectangle cannot have everything the order is: exclude the photograph >
   never cut through text > include the name, so a name in a banner above a
   photo is left out WHOLE and comes back `missing` rather than sliced. Two
   live warnings, never blocks: text on the boundary, and a dense block
   inside the box.
5. **The image never persists.** Not in `chrome.storage`, not in IndexedDB,
   not in a module-level cache — `capture.test.ts` greps the four modules the
   bytes pass through, and `outcomes.test.tsx` scans the whole storage area
   for a fixture birth value rather than checking a list of keys. The
   UNCROPPED capture is never transmitted; only the rectangle the user drew.
6. **Nothing durable is written unless the user says so.** "Instant reading"
   sends no message at all (F149), and the chat it created is deleted when
   the user leaves. "Add to my matches" answers the engine's own save offer
   on the one carrier, with `capture_source` so a fact accepted unchanged
   lands `parsed_from_page` rather than `stated_by_user`.

## The walk

`e2e/walk.mjs` drives the built extension in a real Chromium against a local
backend. **It is run by hand and it creates real data** — read the ⚠ above.

```bash
npm run build:dev && node e2e/walk.mjs     # HEADED=1 to watch it
CAPTURE_BUDGET=4 node e2e/walk.mjs         # …including the four LIVE capture legs
node e2e/save-walk.mjs                     # outcome (a), on the FREE path
node e2e/spike-f159.mjs                    # the activeTab probe, no backend needed
node e2e/measure-encoding.mjs              # PNG vs JPEG, live — SPENDS captures
node e2e/capture-stream.mjs                # re-capture a match_report fixture
node e2e/make-crop-fixtures.mjs            # re-measure the ink profiles
```

**The one substitution, stated.** Legs 14-24 inject a real screenshot of a
locally-served SYNTHETIC page through the same `capture/delivered` broadcast a
keyboard gesture uses, because `captureVisibleTab` cannot be reached from
automation at all (see the table above). Everything downstream of it — the
crop, the consent, the live extractor, the review, the scorecard, the chips,
the save, the delete — is real. **No matrimonial site is ever visited,
screenshotted or committed.**

The walk declares how many live captures it may spend — `CAPTURE_BUDGET`,
**0 by default**. Legs beyond the budget skip and print why. Discovering the
allowance by hitting the 429 spends it; declaring it does not.

⚠ Each capture leg spends one of the account's **ten daily captures** and one
paid Flash call. And the local backend **reloads on every file change**: a
reviewer editing `chatservice/services/.../graph.py` kills every in-flight
SSE turn, which the panel reports as "the reading came back empty". Check
`docker logs yourfinadvisor_api | grep WatchFiles` before blaming the client.
