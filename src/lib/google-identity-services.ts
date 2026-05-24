// lib/google-identity-services.ts
//
// Google Identity Services (GIS) wrapper — the modern, ITP-safe Google
// sign-in path. Returns an ID token via JS callback so we can hand it
// to Firebase's `signInWithCredential` and skip the broken
// authDomain redirect chain entirely.
//
// Why we need this: iOS Safari (and CriOS / Chrome iOS, which is also
// WebKit) enforces ITP that blocks the cross-site session cookies
// Firebase's `signInWithRedirect` flow depends on. The auth handler at
// `aiagentapi.firebaseapp.com` can't read its own session cookie when
// the user returns to `chat.yourfinadvisor.com`, so getRedirectResult()
// returns null and the user stays anonymous. This was confirmed in
// prod logs (ravi.ismystery@gmail.com, multiple attempts, all silent
// failures).
//
// GIS runs as a first-party `accounts.google.com` flow. The browser
// trusts it cross-origin to issue an ID token via JS callback because
// the user actively consents inside the prompt UI. No iframe storage,
// no cookies to lose.
//
// The OAuth client id below is the *Firebase-managed* Google OAuth
// client for project aiagentapi — the same one Firebase Auth uses
// internally. Pinned here as a constant because we need it before
// React renders the sign-in button.

const FIREBASE_WEB_CLIENT_ID =
  "388592327571-onpvgba3j318162sqm5h7brd4ackpl07.apps.googleusercontent.com";

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

// Each `prompt()` call has to wait for the previous one to settle —
// the user dismissing One Tap is a real state we honor.
let gisLoadPromise: Promise<void> | null = null;

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: GisIdConfig) => void;
          prompt: (cb?: (notification: GisPromptNotification) => void) => void;
          cancel: () => void;
        };
        oauth2?: {
          initTokenClient: (config: any) => any;
        };
      };
    };
  }
}

type GisIdConfig = {
  client_id: string;
  callback: (response: { credential: string; select_by?: string }) => void;
  context?: "signin" | "signup" | "use";
  ux_mode?: "popup" | "redirect";
  auto_select?: boolean;
  itp_support?: boolean;
  use_fedcm_for_prompt?: boolean;
  cancel_on_tap_outside?: boolean;
};

type GisPromptNotification = {
  isDisplayMoment: () => boolean;
  isDisplayed: () => boolean;
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  isDismissedMoment: () => boolean;
  getNotDisplayedReason?: () => string;
  getDismissedReason?: () => string;
  getSkippedReason?: () => string;
  getMomentType?: () => string;
};

function loadGisScript(): Promise<void> {
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise<void>((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("GIS requires DOM"));
      return;
    }
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SCRIPT_SRC}"]`,
    );
    if (existing) {
      // Already loading — wait for it.
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("GIS script failed to load")));
      return;
    }
    const s = document.createElement("script");
    s.src = GIS_SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("GIS script failed to load"));
    document.head.appendChild(s);
  });

  return gisLoadPromise;
}

/**
 * Trigger the GIS sign-in prompt and resolve with the ID token the
 * user produced — or `null` if the prompt was dismissed / unavailable
 * (caller falls back to popup/redirect).
 *
 * Resolves to:
 *   - ID token string on success
 *   - `null` if One Tap couldn't display (cooldown, missing 3p
 *     storage permission in old browsers, etc.) — caller should fall
 *     back to another method
 *   - rejects only on truly exceptional errors (script load failure,
 *     bad client config)
 */
export async function signInWithGoogleViaGIS(): Promise<string | null> {
  await loadGisScript();

  const gis = window.google?.accounts?.id;
  if (!gis) {
    console.warn("[AUTH/GIS] google.accounts.id not available after script load");
    return null;
  }

  return new Promise<string | null>((resolve, reject) => {
    // Watchdog: if One Tap doesn't display AND the user doesn't act
    // within 30s, give up and let the caller fall through.
    const watchdog = setTimeout(() => {
      gis.cancel();
      resolve(null);
    }, 30_000);

    let settled = false;
    const settle = (value: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      resolve(value);
    };

    try {
      gis.initialize({
        client_id: FIREBASE_WEB_CLIENT_ID,
        callback: (resp) => {
          if (resp?.credential) {
            settle(resp.credential);
          } else {
            settle(null);
          }
        },
        ux_mode: "popup",
        // FedCM is the post-3p-cookie successor for One Tap; Chrome
        // requires this opt-in starting late 2024.
        use_fedcm_for_prompt: true,
        // Keep ITP-friendly storage hops on iOS.
        itp_support: true,
        // Don't auto-pick a previously-used account silently — the
        // user explicitly clicked Sign In, so show them the picker.
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      gis.prompt((notification) => {
        // One Tap couldn't display (cooldown, no eligible accounts,
        // disabled, etc.). Let the caller try popup/redirect.
        if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
          const reason =
            notification.getNotDisplayedReason?.() ||
            notification.getSkippedReason?.() ||
            "unknown";
          console.info("[AUTH/GIS] prompt not displayed:", reason);
          settle(null);
        } else if (notification.isDismissedMoment?.()) {
          // User actively dismissed — treat as a real signal not to
          // continue, but caller may still want to fall back.
          const reason = notification.getDismissedReason?.() || "unknown";
          console.info("[AUTH/GIS] prompt dismissed:", reason);
          settle(null);
        }
        // isDisplayed / isDisplayMoment → wait for the callback above.
      });
    } catch (e) {
      reject(e);
    }
  });
}
