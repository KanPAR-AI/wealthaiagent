// Push notifications — the decisions, pure. The native half is `lib/push.ts`.
//
// What is decided here, and tested at the workspace root: what the Settings
// row shows (absent on a binary without the module — capability rule: absent
// REMOVES; "off in Settings" when the OS has already said no, because a second
// system prompt does not exist), and where a tapped notification may go (an
// allowlist; a push payload is outside input).
export type PushPermission = 'granted' | 'denied' | 'undetermined';

export type PushRow = 'absent' | 'os_denied' | 'switch';

export function pushRow(supported: boolean, permission: PushPermission): PushRow {
  if (!supported) return 'absent';
  return permission === 'denied' ? 'os_denied' : 'switch';
}

/** Arthur has one screen a push can open: the chat. `yourfinadvisor://home`
 *  (what the backend sends) and anything else both land there — the payload
 *  never chooses a route, and a `chat_id` it carries is not followed until the
 *  chat screen can open a chat by id. Pure. */
export function routeForPush(_url: unknown): { pathname: string } {
  return { pathname: '/' };
}
