/**
 * What this build talks to, and the one flag that is waiting on the engine.
 *
 * ONE backend (docs/48 D2): the extension talks to the same chatservice as
 * the web app and both phone apps. Only the client is separate.
 */

import { BACKEND_HOST_PERMISSION, DEV_HOST_PERMISSION, type BuildMode } from './manifest';

export const PROD_API_ORIGIN = BACKEND_HOST_PERMISSION.replace(/\/\*$/, '');
export const DEV_API_ORIGIN = DEV_HOST_PERMISSION.replace(/\/\*$/, '');
export const API_VERSION = 'v1';

export function apiOrigin(mode: BuildMode): string {
  return mode === 'development' ? DEV_API_ORIGIN : PROD_API_ORIGIN;
}

/** `/chats` → `https://…/api/v1/chats`. The one place a URL is built. */
export function apiUrl(mode: BuildMode, endpoint: string): string {
  return `${apiOrigin(mode)}/api/${API_VERSION}${endpoint}`;
}

/**
 * docs/48 D3 — the product is pinned to the astrology agent, exactly as
 * `apps/astro` is. Routing is off on this surface, so `force_agent` is
 * mandatory on every stream (ASTRAL-324).
 */
export const PINNED_AGENT = 'astrology_ai';

/** ASTRAL-18's width prop for this surface. */
export const PANEL_WIDTH = 380;

/**
 * The Firebase project's WEB API key. A public identifier, not a secret —
 * access control lives in Firebase security rules and in the backend's token
 * verification, and the same value is already in `.env.local` and in
 * `apps/astro/src/lib/env.ts` per platform.
 */
export const FIREBASE_API_KEY = 'AIzaSyBaV0-3rpmqPwwmF-DxrzOxo7RMeZGPxc0';

/**
 * PH-38's two capture fields, gated on ONE constant.
 *
 * `capture_source` (choice) and `capture_edited` (multi over the belief KEYS)
 * are declared in `graph.INPUT_FIELDS` as of PH-38 (docs/73 ASTRAL-313). They
 * are what makes a fact read off a page land `parsed_from_page` (rank 2)
 * rather than `stated_by_user` (rank 3), with the fields the user typed
 * keeping `stated_by_user` — AMB-68(a), both halves.
 *
 * The gate exists because an undeclared key is NOT ignored:
 * `graph._parse_input_response` refuses it BY NAME —
 *
 *     spec = _input_field(str(key))
 *     if spec is None:
 *         refusals.append((str(key), "is not a field I asked for"))
 *
 * — which would put a visible refusal into a turn that otherwise worked.
 *
 * ⚠ SHIPPING ORDER. `true` means this client REQUIRES a backend that
 * declares both fields. PH-38 is in the chatservice tree and live locally; it
 * must reach the Cloud Run revision BEFORE a production build of this
 * extension is loaded (docs/51 §4, backend before client). If PH-38 is ever
 * rolled back, flip this to `false` in one place and the carrier stops
 * sending them — `trust-boundary.test.ts` asserts both branches.
 */
export const ENGINE_HAS_CAPTURE_FIELDS = true;
