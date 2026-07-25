// lib/analytics.ts — Firebase Analytics (GA4) for the mobile app.
//
// Uses @react-native-firebase/analytics when it's installed + configured
// (native module + google-services.json / GoogleService-Info.plist). Until
// then every call is a SILENT NO-OP — the module is loaded via a dynamic
// import behind a string-typed specifier so neither tsc nor a build without
// the package fails. This lets us instrument the app now and turn collection
// on later with just a rebuild (no code changes at the call sites).
//
// Once live, GA4 auto-collects screen_view / session_start / user_engagement,
// so DAU/MAU, retention and engagement-time dashboards populate in the Firebase
// console with no extra code; the helpers here add product events (tile CTR).

// `: string` (not a literal) stops TS from trying to resolve the module at
// compile time, and stops the bundler from hard-failing when it's absent.
const ANALYTICS_MODULE: string = '@react-native-firebase/analytics';

let _mod: (() => { logEvent: (n: string, p?: Record<string, unknown>) => Promise<void>; setUserId: (id: string) => Promise<void> }) | null = null;
let _tried = false;

async function ensure() {
  if (_mod || _tried) return _mod;
  _tried = true;
  try {
    const imported: any = await import(ANALYTICS_MODULE);
    _mod = imported?.default ?? null;
  } catch {
    _mod = null; // package not installed / not configured → no-op
  }
  return _mod;
}

// GA4 event/param constraints: name ≤40 chars; string param values ≤100 chars.
function clip(v: unknown): string | number {
  if (typeof v === 'number') return v;
  return String(v ?? '').slice(0, 100);
}

export function track(event: string, params?: Record<string, unknown>): void {
  ensure()
    .then((m) => {
      if (!m) return;
      const p: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(params || {})) p[k.slice(0, 40)] = clip(v);
      m().logEvent(event.slice(0, 40), p).catch(() => {});
    })
    .catch(() => {});
}

export function identify(uid: string | null | undefined): void {
  if (!uid) return;
  ensure().then((m) => { if (m) m().setUserId(uid).catch(() => {}); }).catch(() => {});
}
