// lib/analytics.ts — Firebase Analytics (GA4) for the web app.
//
// Once VITE_FIREBASE_MEASUREMENT_ID is set (enable Analytics on the Firebase
// project), GA4 AUTO-collects page_view / session_start / user_engagement, so
// the Firebase console Engagement, Retention (cohorts) and DAU/MAU dashboards
// populate with NO custom event code. The helpers below add product-specific
// events on top (e.g. campaign tile CTR).
//
// Everything is env-gated and failure-swallowing: with no measurementId, or in
// an unsupported context (SSR, some in-app webviews), these are silent no-ops
// and never throw into the UI.

import { getAnalytics, isSupported, logEvent, setUserId, type Analytics } from "firebase/analytics";
import app from "@/config/firebase";

let _analytics: Analytics | null = null;
let _init: Promise<Analytics | null> | null = null;

function ensure(): Promise<Analytics | null> {
  if (_analytics) return Promise.resolve(_analytics);
  if (!import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) return Promise.resolve(null);
  if (!_init) {
    _init = isSupported()
      .then((ok) => {
        if (!ok) return null;
        _analytics = getAnalytics(app);
        return _analytics;
      })
      .catch(() => null);
  }
  return _init;
}

/** Log a product event (e.g. "tile_tap"). Silent no-op if analytics is off. */
export function track(event: string, params?: Record<string, unknown>): void {
  ensure()
    .then((a) => { if (a) logEvent(a, event as string, params as Record<string, unknown> | undefined); })
    .catch(() => {});
}

/** Associate events with a stable user id (cross-device). Optional. */
export function identify(uid: string | null | undefined): void {
  if (!uid) return;
  ensure().then((a) => { if (a) setUserId(a, uid); }).catch(() => {});
}
