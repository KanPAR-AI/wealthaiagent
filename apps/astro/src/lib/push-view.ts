// Push notifications — the decisions, pure (docs/69 sprint 3).
//
// The native half lives in `lib/push.ts`. What is decided HERE, and tested at
// the workspace root: when the app may OFFER the morning line (never on first
// launch, never twice in a fortnight, never when the OS has already said no —
// a second system prompt does not exist, so a card that asks again would be a
// button that does nothing), and where a tapped notification may go (an
// allowlist of in-app routes; a push payload is outside input).
export type PushPermission = 'granted' | 'denied' | 'undetermined';

export interface PushOfferState {
  /** the native module exists in THIS binary (builds 12/13 lack it) */
  supported: boolean;
  permission: PushPermission;
  /** Home has a day card to promise a colour from */
  hasDayCard: boolean;
  /** epoch ms of the last "Not now", or null */
  dismissedAt: number | null;
  now: number;
}

export const OFFER_QUIET_DAYS = 14;

export function shouldOfferPush(s: PushOfferState): boolean {
  if (!s.supported || !s.hasDayCard) return false;
  if (s.permission !== 'undetermined') return false;
  if (s.dismissedAt !== null
      && s.now - s.dismissedAt < OFFER_QUIET_DAYS * 86_400_000) return false;
  return true;
}

/** The Profile row: absent on a binary without the module (capability rule:
 *  absent REMOVES), "off in Settings" when the OS said no, else the switch. */
export type PushRow = 'absent' | 'os_denied' | 'switch';

export function pushRow(supported: boolean, permission: PushPermission): PushRow {
  if (!supported) return 'absent';
  return permission === 'denied' ? 'os_denied' : 'switch';
}

const ROUTES = new Set(['home', 'insights', 'timeline', 'day', 'matches', 'chart']);

/** `astro://day?date=2026-09-21` → { pathname: '/day', params: { date } }.
 *  Anything else → Home. Pure. */
export function routeForPush(url: unknown): { pathname: string; params?: Record<string, string> } {
  const m = /^astro:\/\/([a-z-]+)(?:\?(.*))?$/.exec(typeof url === 'string' ? url : '');
  if (!m || !ROUTES.has(m[1])) return { pathname: '/home' };
  const params: Record<string, string> = {};
  for (const pair of (m[2] ?? '').split('&')) {
    const [k, v] = pair.split('=');
    if (k && v && /^[a-z_]{1,20}$/.test(k) && /^[\w.:-]{1,40}$/.test(v)) params[k] = v;
  }
  return Object.keys(params).length ? { pathname: `/${m[1]}`, params } : { pathname: `/${m[1]}` };
}
