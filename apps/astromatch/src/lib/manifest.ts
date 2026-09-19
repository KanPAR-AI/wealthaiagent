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
    'for that tab, until it navigates. Carries both the snapshot (PH-40) and ' +
    'the selection read (PH-41).',
  scripting:
    'PH-41\'s selection flow: one programmatic injection on the user\'s ' +
    'click. There is deliberately no `content_scripts` key in this manifest.',
  storage:
    'The user\'s own settings. No captured content and no raw token is ever ' +
    'written here — the session token lives in `chrome.storage.session`, ' +
    'which is memory-backed and cleared with the browser (ASTRAL-323).',
  contextMenus:
    '"Read this page into AstroMatch" — a second gesture that grants ' +
    'activeTab unambiguously (docs/73 F159\'s designed fallback).',
};

export const MANIFEST_PERMISSIONS = Object.keys(PERMISSION_REASONS);

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
 *                        for an inline asset; nothing uses it today.
 *                        ⚠ PH-40's crop preview is a `blob:` URL (the shared
 *                        `ImagePicker` shows one before it uploads) and will
 *                        need `blob:` added HERE, in the same commit.
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
 * Permissions that are declared for PH-40 and unused today (docs/73 B5).
 *
 * PH-39 and PH-40 ship to a user as ONE release (§5), which is the only thing
 * that makes an unused permission legitimate. This list is asserted against
 * `capabilities.ts` from both sides: a permission whose capability is false
 * must be named here, and a name here that no longer has a false capability
 * must be removed. If PH-39 is ever shipped alone, every entry below comes
 * out of the manifest with it.
 *
 * `commands` is deliberately NOT here — it is GONE. A keyboard shortcut whose
 * only job is to grant `activeTab` for a capture that does not exist yet is a
 * dead affordance with a key binding: Chrome shows it in chrome://extensions
 * /shortcuts, a user presses it, and nothing happens. PH-40 adds it back in
 * the same commit as the thing it triggers.
 */
export const SHIPS_WITH_PH40 = ['activeTab', 'scripting', 'contextMenus'] as const;

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
    host_permissions:
      mode === 'development'
        ? [BACKEND_HOST_PERMISSION, DEV_HOST_PERMISSION]
        : [BACKEND_HOST_PERMISSION],
    content_security_policy: { extension_pages: cspFor(mode) },
  };
}
