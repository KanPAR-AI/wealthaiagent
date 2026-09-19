/**
 * The host capability seam (docs/49 ASTRAL-99, from F22).
 *
 * ── why this file exists ───────────────────────────────────────────────────
 *
 * The React Native binding used to live inside `apps/mobile` and reach into
 * it: `rn-primitives.tsx` imported `getToken` from `@/lib/auth` and
 * `uploadFileNative` from `@/lib/upload`; `astral-block.tsx` imported
 * `QUICK_REPLY_EVENT` from `@/lib/events`. `@/*` maps to `./src/*` in BOTH
 * apps' tsconfigs, so a copy of those files into the second app would have
 * COMPILED — resolving to different modules per app — rather than failing
 * loudly. That is the shape ASTRAL-18 exists to forbid, and it is why the
 * three capabilities are injected here instead of imported.
 *
 * ── the getToken type seam, resolved rather than cast away ─────────────────
 *
 * `apps/mobile/src/lib/auth.ts` declares `getToken(): Promise<string | null>`
 * and `apps/astro/src/lib/auth.ts` declares `getToken(): Promise<string>`.
 * The CONTRACT below is the wider of the two, so:
 *   - astro's narrower function is assignable with no cast (a function
 *     returning `Promise<string>` satisfies `Promise<string | null>`);
 *   - mobile's null case is not lost — it arrives as null and the one
 *     consumer refuses to upload rather than sending an unauthenticated
 *     request.
 * The alternative — narrowing the contract and casting mobile's — would
 * delete exactly the case that matters.
 *
 * ── injection mechanism: an init function, not a React context ─────────────
 *
 * DECIDED, and here is the reasoning rather than a preference. Both apps
 * already install a platform adapter this way at module load
 * (`ensureCoreInitialized()` → `getPlatform()` in `@wealthai/core`), so this
 * is the convention already in the tree. A context would additionally require
 * a provider in two component trees and would force `rnPrimitives` — a plain
 * object of leaf components — to become hook-bearing at every leaf.
 *
 * A missing host THROWS, naming the fix. It does not fall back to a plausible
 * default: a binding that silently renders with no way to send an answer is
 * a dead card, and a silent no-op upload is the failure class that made the
 * photo slot ambiguous in the first place.
 */

import type { ReactNode } from 'react';

/** What a host's upload takes. The picker already downscaled it. */
export interface AstralUploadAsset {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

/** What a host's upload returns: at minimum, where the file landed. */
export interface AstralUploadResult {
  url: string;
}

export interface AstralHost {
  /**
   * A bearer token for the backend, or null when nobody is signed in.
   * See the type-seam note above — the wider signature is deliberate.
   */
  getToken: () => Promise<string | null>;

  /**
   * A native multipart upload, when the host has one.
   *
   * OPTIONAL, and its absence is a real state rather than an oversight:
   * `apps/astro` has no upload path yet. A host without one gets a VISIBLE
   * refusal from the photo slot — never a tap that appears to work.
   */
  upload?: (token: string, asset: AstralUploadAsset) => Promise<AstralUploadResult>;

  /**
   * How a composed message becomes a turn on this host.
   *
   * The binding does not know about event buses, chat screens or send
   * hooks — it knows that an answer leaves through here. `apps/mobile`
   * wires this to the shipped quick-reply channel; `apps/astro` wires it to
   * its own chat send.
   */
  send: (text: string) => void;

  /**
   * docs/65 B2: the place lookup the birth-details carrier suggests from
   * as the user types — the app's gazetteer read. OPTIONAL: a host without
   * one gets the plain place field, exactly as before.
   */
  suggestPlaces?: (query: string) => Promise<Array<{ name: string; country?: string | null; timezone?: string | null }>>;

  /**
   * Per-field helper copy, keyed by field `key` then field `kind`
   * (docs/49 ASTRAL-104's amendment).
   *
   * OPTIONAL and app-owned, because it is BRAND copy and this package serves
   * two brands in two markets: the board's own place hint is "City, State, or
   * ZIP code", which is a form asking an Indian user for something that does
   * not exist. The engine does not send it either — a hint is how a product
   * talks, not a fact about the belief — and an engine-supplied `hint` on a
   * field always wins over this.
   *
   * A host that supplies none gets no hint, which is what shipped.
   */
  fieldHints?: Record<string, string>;

  /**
   * docs/64 W-3: open a day's card (`/day?date=`) from a ranked-days
   * block. OPTIONAL: a host without a day page renders the rows without
   * the door — never a tap that does nothing.
   */
  openDay?: (isoDate: string) => void;

  /**
   * "Is the birth block on a kundli card allowed to be drawn in clear right
   * now?" — asked at PAINT TIME, once per block (owner ruling, 2026-09-19).
   *
   * OPTIONAL, and a host that supplies none gets today's behaviour: the
   * Astral AI app hides the user's own exact birth date, time and place
   * behind a device-authentication reveal, `apps/mobile` does not, and this
   * binding serves both. It is a FUNCTION rather than a boolean because the
   * answer changes inside the lifetime of a screen — the unlock expires
   * after a minute and dies when the app backgrounds — and a value captured
   * at install time would be a lock that opened once and stayed open.
   *
   * It says NOTHING about whose chart it is: the `natal_chart` payload
   * carries no subject, so a host that returns true masks every chart in the
   * transcript (see the finding filed with this feature). It returns false,
   * and everything draws exactly as it did.
   */
  maskBirthDetails?: () => boolean;

  /**
   * …and the same question for a FORM. When true, an `input_request` block
   * drops the engine's pre-filled value from the fields the host names as
   * locked, so a correction picker opens blank rather than at the stored
   * birth time.
   *
   * A SEPARATE hook rather than a second use of `maskBirthDetails`, and the
   * difference is the whole reason it exists: the block host does not know
   * which field keys belong to the reader (`dob` is self, `person2_dob` is
   * their partner, and only the app has that list). So the host is handed
   * the parsed request and gives one back — it decides, this package does
   * not. A host without the hook gets the request untouched, which is what
   * the web app and the extension ship.
   */
  maskInputRequest?: <T>(request: T) => T;

  /**
   * A glyph per field KIND, drawn by the host (the board's frame 2 puts a
   * calendar, a clock and a pin on its three rows).
   *
   * Here for the same reason `fieldHints` is here: an icon set is a brand
   * asset, `@wealthai/astral` owns no icons and no font, and the two apps
   * that render this binding are two brands. It also means the CHAT bubble
   * and the full-screen form draw the same rows — the birth-details screen
   * used to pass icons directly and the bubble did not, so one surface got
   * the board's field and the other got a bare wheel.
   *
   * OPTIONAL. Absent is fine: the form is complete without them.
   */
  fieldIcons?: Record<string, ReactNode>;
}

let host: AstralHost | null = null;

/**
 * Install this app's capabilities. Call once, at module load, before any
 * screen renders a block — the same place and the same moment both apps
 * already call `ensureCoreInitialized()`.
 */
export function installAstralHost(capabilities: AstralHost): void {
  host = capabilities;
}

/** Test seam, and the honest way to ask whether installation happened. */
export function isAstralHostInstalled(): boolean {
  return host !== null;
}

/**
 * The installed host, or a throw that says what to do.
 *
 * Loud on purpose. This cannot happen in a correctly wired app — both root
 * layouts install at import time — so if it ever does, the message is worth
 * more than a fallback would be.
 */
export function getAstralHost(): AstralHost {
  if (!host) {
    throw new Error(
      '[astral-native] no host installed. Call installAstralHost({ getToken, ' +
        'send, upload? }) from the app root before rendering a block ' +
        '(docs/49 ASTRAL-99).',
    );
  }
  return host;
}

/** Test seam — forget the installed host between cases. */
export function resetAstralHost(): void {
  host = null;
}

// ── the two mask reads, HERE rather than in the block dispatcher ───────────
//
// Role-3 measured the reason: `astral-block.tsx`'s host read could be changed
// to a constant `false` and the whole suite stayed green, because that module
// imports React Native and no jest project in this workspace can mount it.
// These two functions hold the same logic in a file that imports nothing but
// React's types, so the JOIN between a host's answer and a rendered card is
// testable — and the block dispatcher becomes a call rather than a decision.

/**
 * "Should a kundli card be drawn with its birth block hidden?"
 *
 * Asked at PAINT time: the answer expires (the Astral AI unlock lasts a
 * minute and dies when the app backgrounds), so a value captured at install
 * time would be a lock that opened once. A host that does not lock birth
 * details has no hook and gets `false`, which is today's card.
 */
export function hostMaskBirth(): boolean {
  if (!isAstralHostInstalled()) return false;
  return getAstralHost().maskBirthDetails?.() === true;
}

/**
 * …and the same question for a FORM: the host gets the parsed request and
 * gives one back. A host with no hook gets its request back UNCHANGED —
 * identity, not a guess, because this package does not know which field keys
 * belong to the reader.
 */
export function hostMaskRequest<T>(request: T): T {
  if (!isAstralHostInstalled()) return request;
  const hook = getAstralHost().maskInputRequest;
  return hook ? hook(request) : request;
}
