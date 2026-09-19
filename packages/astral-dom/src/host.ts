/**
 * The host capability seam for the React-DOM binding (docs/73 ASTRAL-321,
 * from F153 — which is F22 repeating on the other platform).
 *
 * ── why this file exists ───────────────────────────────────────────────────
 *
 * The DOM binding used to live inside the web app at
 * `src/components/astral/` and reach into it: `dom-primitives.tsx` imported
 * `getApiUrl` from `@/config/environment` and `useAuthStore` from
 * `@/store/auth` and used both inside the image picker's upload;
 * `astral-block.tsx` dispatched the web's `chat-quick-reply` CustomEvent.
 *
 * `@/*` maps to `./src/*` in MORE THAN ONE tsconfig in this workspace, so a
 * copy of those files into `apps/astromatch` would have COMPILED — resolving
 * to different modules per app — rather than failing loudly. That is exactly
 * the failure `packages/astral-native/src/host.ts` records for React Native,
 * and the fix is the same one: the app-local capabilities are INJECTED here
 * instead of imported.
 *
 * ── what the binding may NOT do, and why the contract is shaped this way ───
 *
 * The package performs NO network of its own. The web app has a fetch and a
 * token store; the AstroMatch extension has neither in its panel — all of its
 * network lives in the service worker (docs/73 F154), because a content-facing
 * document with credentials is the thing an extension review reads first. A
 * contract that handed the package a `getApiUrl` and a token would have made
 * the panel fetch, which is the rule it exists under. So `upload` is the
 * host's whole job, and the binding only asks for its result.
 *
 * ── injection mechanism: an init function, not a React context ─────────────
 *
 * Same decision, same reasons as `astral-native`'s: both apps already install
 * a platform adapter this way at module load (`initCore` in `@wealthai/core`),
 * and a context would force every leaf primitive — a plain object of leaf
 * components — to become hook-bearing.
 *
 * A missing host THROWS, naming the fix. It does not fall back to a plausible
 * default: a binding that silently renders with no way to send an answer is a
 * dead card.
 */

/** Where an uploaded file landed. Mirrors `AstralUploadResult` on the native
 *  binding so a host serving both speaks one vocabulary. */
export interface AstralDomUploadResult {
  url: string;
}

export interface AstralDomHost {
  /**
   * How a composed message becomes a turn on this host.
   *
   * The binding does not know about event buses, chat windows or side
   * panels — it knows that an answer leaves through here. The web app wires
   * this to the shipped `chat-quick-reply` channel; the extension panel
   * wires it to its service-worker transport.
   */
  send: (text: string) => void;

  /**
   * An image upload, when the host has one.
   *
   * OPTIONAL, and its absence is a real state rather than an oversight. A
   * host without one gets a VISIBLE refusal from the photo slot — never a
   * tap that appears to work. It takes a `File` rather than the native
   * binding's `{uri, name, type}` because on this platform the picker
   * already holds the bytes.
   */
  upload?: (file: File) => Promise<AstralDomUploadResult>;
}

let host: AstralDomHost | null = null;

/**
 * Install this app's capabilities. Call once, at module load, before any
 * screen renders a block.
 */
export function installAstralDomHost(capabilities: AstralDomHost): void {
  host = capabilities;
}

/** Test seam, and the honest way to ask whether installation happened. */
export function isAstralDomHostInstalled(): boolean {
  return host !== null;
}

/**
 * The installed host, or a throw that says what to do.
 *
 * Loud on purpose. This cannot happen in a correctly wired app, so if it
 * ever does the message is worth more than a fallback would be.
 */
export function getAstralDomHost(): AstralDomHost {
  if (!host) {
    throw new Error(
      '[astral-dom] no host installed. Call installAstralDomHost({ send, ' +
        'upload? }) from the app root before rendering a block ' +
        '(docs/73 ASTRAL-321).',
    );
  }
  return host;
}

/** Test seam — forget the installed host between cases. */
export function resetAstralDomHost(): void {
  host = null;
}
