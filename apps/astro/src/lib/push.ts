// Push notifications — the native half (docs/69 sprint 3, build 14).
//
// Builds 12 and 13 share this runtime version and do NOT contain the native
// module, and every OTA reaches them too. So the module is probed with
// `requireOptionalNativeModule` BEFORE `expo-notifications` is required — the
// rule `use-current-place.ts` learned on the simulator, where a plain require
// threw at evaluation. On an older binary everything here answers "not
// supported" and the surfaces remove themselves (capability rule).
import { Platform } from 'react-native';
import { getPlatform } from '@wealthai/core';
import { requireOptionalNativeModule } from 'expo-modules-core';

import { getToken } from './auth';
import { apiUrl } from './core-adapter';
import type { PushPermission } from './push-view';

const PROJECT_ID = 'a29f5cc6-27f6-42ae-a511-8cf905edb3e1';
const DISMISSED_KEY = 'astro.pushOfferDismissedAt';
const TOKEN_KEY = 'astro.pushToken';

type Notifications = typeof import('expo-notifications');

function mod(): Notifications | null {
  try {
    if (!requireOptionalNativeModule('ExpoPushTokenManager')) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as Notifications;
  } catch {
    return null;
  }
}

export function pushSupported(): boolean {
  return mod() !== null;
}

export async function pushPermission(): Promise<PushPermission> {
  const n = mod();
  if (!n) return 'undetermined';
  const p = await n.getPermissionsAsync();
  if (p.granted) return 'granted';
  return p.canAskAgain === false || p.status === 'denied' ? 'denied' : 'undetermined';
}

async function api<T>(path: string, method: string, body?: unknown): Promise<T> {
  const token = await getToken();
  const res = await fetch(apiUrl(path), {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

/** Ask the OS (once — it only ever shows one prompt), get the Expo token,
 *  register it. Returns the permission the user ended up with. */
export async function enablePush(): Promise<PushPermission> {
  const n = mod();
  if (!n) return 'undetermined';
  let p = await n.getPermissionsAsync();
  if (!p.granted && p.canAskAgain !== false) p = await n.requestPermissionsAsync();
  if (!p.granted) return p.canAskAgain === false ? 'denied' : 'undetermined';
  const { data: token } = await n.getExpoPushTokenAsync({ projectId: PROJECT_ID });
  await api('push/device', 'PUT', { token, platform: Platform.OS === 'android' ? 'android' : 'ios' });
  await api('push/prefs', 'PUT', { morning: true });
  await getPlatform().storage.setItem(TOKEN_KEY, token);
  return 'granted';
}

/** Re-register quietly on launch: tokens rotate, and a reinstall is a new one. */
export async function refreshPushRegistration(): Promise<void> {
  const n = mod();
  if (!n) return;
  try {
    if (!(await n.getPermissionsAsync()).granted) return;
    const { data: token } = await n.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    if ((await getPlatform().storage.getItem(TOKEN_KEY)) === token) return;
    await api('push/device', 'PUT', { token, platform: Platform.OS === 'android' ? 'android' : 'ios' });
    await getPlatform().storage.setItem(TOKEN_KEY, token);
  } catch (e: unknown) {
    console.warn('[push] refresh skipped', String((e as Error)?.message ?? e));
  }
}

export async function morningPref(): Promise<boolean> {
  const r = await api<{ prefs: { morning: boolean } }>('push/prefs', 'GET');
  return Boolean(r.prefs?.morning);
}

export async function setMorningPref(on: boolean): Promise<boolean> {
  const r = await api<{ prefs: { morning: boolean } }>('push/prefs', 'PUT', { morning: on });
  return Boolean(r.prefs?.morning);
}

export async function sendTestPush(): Promise<number> {
  const r = await api<{ ok: number }>('push/test', 'POST');
  return r.ok ?? 0;
}

export async function offerDismissedAt(): Promise<number | null> {
  const v = await getPlatform().storage.getItem(DISMISSED_KEY);
  return v ? Number(v) : null;
}

export function dismissOffer(): void {
  void getPlatform().storage.setItem(DISMISSED_KEY, String(Date.now()));
}

/** Foreground banner + tap routing. Returns the unsubscribe. */
export function installPushHandlers(onOpen: (url: unknown) => void): () => void {
  const n = mod();
  if (!n) return () => undefined;
  n.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false,
    }),
  });
  const sub = n.addNotificationResponseReceivedListener((r) => {
    onOpen(r.notification.request.content.data?.url);
  });
  return () => sub.remove();
}
