/**
 * The MV3 manifest, as a value (docs/73 §2, ASTRAL-322).
 *
 * It is a module rather than a checked-in `manifest.json` for one reason: the
 * row's verification is "the permission set equals the declared set exactly,
 * in BOTH directions", and a test can only assert that against something it
 * can import. The build writes this object to `dist/manifest.json`; the test
 * reads the same object. There is no second copy to drift.
 *
 * EVERY permission below carries the reason it exists. A permission with no
 * reason on its row is a spec deviation, and `manifest.test.ts` fails on a
 * permission this file does not declare a reason for.
 */

import { BADGE_READY_TITLE } from './badge';

export const BACKEND_HOST_PERMISSION = 'https://chatbackend.yourfinadvisor.com/*';

/**
 * The dev build's SECOND host, and why the production build must not have it.
 *
 * A local run of the backend answers on :8080, and a service-worker fetch to
 * a host that is not in `host_permissions` is an ordinary CORS request — which
 * `core/constants.py`'s origin list does not admit a `chrome-extension://`
 * origin to, and cannot, because `allow_credentials=True` forbids `*`
 * (docs/73 F154). So the DEV manifest names localhost and the PRODUCTION
 * manifest does not. The test asserts production has exactly one host.
 */
export const DEV_HOST_PERMISSION = 'http://localhost:8080/*';

export type BuildMode = 'production' | 'development';

/**
 * Why each permission is here. Keyed by the permission string; the test
 * asserts this map and the manifest's `permissions` array are the same set in
 * both directions, so a permission cannot be added without a reason and a
 * reason cannot outlive its permission.
 */
export const PERMISSION_REASONS: Record<string, string> = {
  sidePanel:
    'The UI is Chrome\'s side panel, never an injected overlay — an overlay ' +
    'mutates somebody else\'s page, which both site terms and store policy ' +
    'object to.',
  activeTab:
    'The ONLY page access: granted by the user\'s gesture on the extension, ' +
    'for that tab, until it navigates. It carries the snapshot — the visible ' +
    'viewport, captured on a gesture, with no DOM read and no site host.',
  scripting:
    'The selection flow: ONE programmatic injection on the user\'s gesture, ' +
    'which reads the text they highlighted and returns it. There is ' +
    'deliberately no `content_scripts` key in this manifest, so nothing runs ' +
    'on any page at load and nothing is left behind afterwards.',
  storage:
    'The user\'s own settings. No captured content and no raw token is ever ' +
    'written here — the session token lives in `chrome.storage.session`, ' +
    'which is memory-backed and cleared with the browser (ASTRAL-323).',
  contextMenus:
    '"Read this page into AstroMatch" — one of the two gestures that grant ' +
    'activeTab unambiguously, measured (docs/73 F159). It is created by ' +
    'PH-40, which is the phase that can honour it.',
};

export const MANIFEST_PERMISSIONS = Object.keys(PERMISSION_REASONS);

/**
 * The keyboard gesture (docs/73 §2, F159).
 *
 * `_execute_action` is Chrome's own reserved name and is deliberately NOT
 * used: this shortcut does not open the panel, it CAPTURES — and a command
 * the extension handles itself is what grants `activeTab` for the tab the
 * user is looking at. `suggested_key` is a suggestion; Chrome lets the user
 * rebind it and may leave it unbound if another extension took it, which is
 * why `chrome.commands.getAll()` is what the panel's instruction reads
 * rather than this literal.
 */
export const CAPTURE_COMMAND = 'capture';

/**
 * PH-41's keyboard gesture, and it is a SECOND command rather than a mode on
 * the first (docs/73 ASTRAL-338).
 *
 * A shortcut does one thing. "Capture this page" and "read what I selected"
 * are two different acts on two different kinds of content, and a single key
 * that guessed between them would be the panel inferring intent from state —
 * which is the class of bug `family_add.py` exists to prevent. Both commands
 * ship with their listeners in `sw.ts`; a command nothing answers is removed.
 */
export const SELECTION_COMMAND = 'selection';

export interface ChromeCommands {
  [name: string]: { suggested_key: { default: string }; description: string };
}

export interface ChromeManifest {
  manifest_version: 3;
  name: string;
  version: string;
  description: string;
  minimum_chrome_version: string;
  action: { default_title: string };
  side_panel: { default_path: string };
  background: { service_worker: string; type: 'module' };
  permissions: string[];
  commands: ChromeCommands;
  host_permissions: string[];
  content_security_policy: { extension_pages: string };
}

/**
 * The panel's content security policy — each directive checked against what
 * this build actually does (docs/73 B4, safety).
 *
 * `extension_pages` governs the panel document AND the service worker, and a
 * host permission does NOT bypass it, so `connect-src` has to name every host
 * the worker talks to or sign-in stops working.
 *
 *   default-src 'self'   nothing loads from anywhere else unless a directive
 *                        below says so.
 *   script-src 'self'    no remote code, no eval. The bundle is local.
 *   object-src 'self'    no plugins.
 *   img-src 'self' data: the panel renders NO remote image — `narration.tsx`
 *                        drops the element entirely, because an image in
 *                        model output about somebody's pasted page is a
 *                        request to a host of their choosing. `data:` is here
 *                        for the CAPTURE (PH-40), which arrives from
 *                        `chrome.tabs.captureVisibleTab` as a `data:` URI and
 *                        is drawn into a canvas. `blob:` was considered for
 *                        the crop preview and is NOT here: the preview is a
 *                        <canvas>, which CSP does not govern, and the crop
 *                        that is sent is `canvas.toDataURL`. So the camera
 *                        widened this policy by nothing at all — the
 *                        directive that was already here simply stopped
 *                        being unused (F301).
 *   style-src 'self' 'unsafe-inline'
 *                        REQUIRED, measured: the panel styles through React's
 *                        `style={{…}}` (39 occurrences across `app.tsx` and
 *                        `review.tsx`) and `panel.html` carries one `<style>`
 *                        block. Without `'unsafe-inline'` the panel renders
 *                        unstyled. It is a real cost and it buys the CSS
 *                        injection surface of our own bundle only — no
 *                        remote stylesheet can load, because `default-src`
 *                        is `'self'`.
 *   connect-src          our backend, plus the two Google identity hosts the
 *                        WORKER uses for `signInWithCustomToken` and the
 *                        token refresh (`auth.ts`). The PANEL makes no
 *                        request at all. The dev build adds localhost.
 *
 * There is deliberately no `frame-src`, `media-src` or `font-src`: nothing
 * frames, plays or loads a font, so `default-src 'self'` covers them.
 */
export const CONNECT_HOSTS = [
  'https://chatbackend.yourfinadvisor.com',
  'https://identitytoolkit.googleapis.com',
  'https://securetoken.googleapis.com',
] as const;

export const DEV_CONNECT_HOST = 'http://localhost:8080';

export function cspFor(mode: BuildMode): string {
  const connect = [
    ...CONNECT_HOSTS,
    ...(mode === 'development' ? [DEV_CONNECT_HOST] : []),
  ].join(' ');
  return [
    "default-src 'self'",
    "script-src 'self'",
    "object-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${connect}`,
  ].join('; ');
}

/** The production policy, as a literal, for the test to assert against. */
export const CSP = cspFor('production');

/**
 * Permissions that are declared and NOT USED YET (docs/73 B5).
 *
 * **EMPTY as of PH-41, and that is the whole point of the list.** Every
 * permission in this manifest now has a capability behind it that is `true`:
 * PH-40 took `activeTab` and `contextMenus` off, and PH-41 took `scripting`
 * — its one call site is `sw.readSelection`, on the user's gesture. The list
 * stays, because the next permission added ahead of its phase belongs on it
 * and the assertions below run in both directions whether it is empty or not.
 *
 * The list is asserted against `capabilities.ts` from both sides: a
 * permission whose capability is false must be named here, and a name here
 * that no longer has a false capability must be removed — so a stale entry
 * is a red diff, and so is a permission quietly added ahead of its use.
 *
 * The export keeps its name because the rule it encodes is the same one: a
 * permission nothing uses is exactly what a store review reads first.
 *
 * `commands` is not in this file's negative space either: both shortcuts
 * ship TOGETHER WITH the `chrome.commands.onCommand` branches that honour
 * them, which is the condition PH-39 set for their return.
 */
export const SHIPS_WITH_PH40: readonly string[] = [];

export function buildManifest(mode: BuildMode): ChromeManifest {
  return {
    manifest_version: 3,
    // AMB-75(a): the extension's job is intent capture on a matrimonial
    // page, and the name should say what it does there.
    name: mode === 'development' ? 'AstroMatch — Kundli Milan (dev)' : 'AstroMatch — Kundli Milan',
    version: '0.1.0',
    description:
      'Check a kundli match against your own chart, from any page you are ' +
      'reading — the scorecard is computed by the Astral engine, never guessed.',
    // the sidePanel API
    minimum_chrome_version: '116',
    // ONE source for the toolbar's words. `badge.ts` is where what the
    // toolbar may claim is decided — "I could help here", never "I have
    // looked" — and it is the SAME function PH-40 calls once `activeTab`
    // gives it a URL it is allowed to read (docs/73 B5, F193). Reading it
    // here keeps the module live rather than leaving a tested decision
    // nothing consults.
    action: { default_title: BADGE_READY_TITLE },
    side_panel: { default_path: 'panel.html' },
    background: { service_worker: 'sw.js', type: 'module' },
    permissions: [...MANIFEST_PERMISSIONS],
    // F159's first designed fallback, and it returns WITH its listener
    // (`sw.ts`'s `chrome.commands.onCommand`). A shortcut Chrome lists under
    // chrome://extensions/shortcuts and nothing answers is a dead affordance
    // with a key binding, which is why PH-39 removed it.
    commands: {
      [CAPTURE_COMMAND]: {
        suggested_key: { default: 'Alt+Shift+M' },
        description: 'Capture this page into AstroMatch',
      },
      [SELECTION_COMMAND]: {
        suggested_key: { default: 'Alt+Shift+S' },
        description: 'Read my selection into AstroMatch',
      },
    },
    host_permissions:
      mode === 'development'
        ? [BACKEND_HOST_PERMISSION, DEV_HOST_PERMISSION]
        : [BACKEND_HOST_PERMISSION],
    content_security_policy: { extension_pages: cspFor(mode) },
  };
}
