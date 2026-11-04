// Push notifications — the native half.
//
// Every Arthur binary before the one that carries `expo-notifications` lacks
// the native module, and every OTA reaches those binaries too. So the module
// is probed with `requireOptionalNativeModule` BEFORE `expo-notifications` is
// required (the rule apps/astro learned on the simulator, where a plain
// require threw at evaluation). On an older binary everything here answers
// "not supported" and the Settings row removes itself (capability rule).
//
// The backend addresses a push to an APP, not a uid (chatservice
// `services/push/notify.py`): this device registers as `arthur`, so Astral's
// morning colour never lands here and Arthur's alerts never land there.
import { Platform } from 'react-native';
import { getPlatform } from '@wealthai/core';
import { requireOptionalNativeModule } from 'expo-modules-core';

import { getToken } from './auth';
import type { PushPermission } from './push-view';
import { apiUrl } from './server-config';

const PROJECT_ID = '77f24ba3-df61-4df4-a7f3-2511cdb9cbdf';
const TOKEN_KEY = 'arthur.pushToken';
const APP = 'arthur';

type Notifications = typeof import('expo-notifications');

function mod(): Notifications | null {
  try {
    if (!requireOptionalNativeModule('ExpoPushTokenManager')) return null;
     
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
  if (!token) throw new Error('Sign in first.');
  const res = await fetch(apiUrl(path), {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

function platform(): 'ios' | 'android' {
  return Platform.OS === 'android' ? 'android' : 'ios';
}

/** This device has registered and not since turned alerts off. */
export async function isPushRegistered(): Promise<boolean> {
  return Boolean(await getPlatform().storage.getItem(TOKEN_KEY));
}

/** Ask the OS (once — it only ever shows one prompt), get the Expo token,
 *  register it as this app's. Returns the permission the user ended up with. */
export async function enablePush(): Promise<PushPermission> {
  const n = mod();
  if (!n) return 'undetermined';
  let p = await n.getPermissionsAsync();
  if (!p.granted && p.canAskAgain !== false) p = await n.requestPermissionsAsync();
  if (!p.granted) return p.canAskAgain === false ? 'denied' : 'undetermined';
  const { data: token } = await n.getExpoPushTokenAsync({ projectId: PROJECT_ID });
  await api('push/device', 'PUT', { token, platform: platform(), app: APP });
  await getPlatform().storage.setItem(TOKEN_KEY, token);
  return 'granted';
}

/** Stop alerts on this device: the backend forgets the address, so it is
 *  gone server-side and not merely muted here. */
export async function disablePush(): Promise<void> {
  const n = mod();
  const stored = await getPlatform().storage.getItem(TOKEN_KEY);
  const token = stored ?? (n ? (await n.getExpoPushTokenAsync({ projectId: PROJECT_ID })).data : null);
  if (token) await api('push/device', 'DELETE', { token, platform: platform(), app: APP });
  await getPlatform().storage.removeItem(TOKEN_KEY);
}

/** Re-register quietly on launch, only for a device that opted in: tokens
 *  rotate, and a reinstall is a new one. */
export async function refreshPushRegistration(): Promise<void> {
  const n = mod();
  if (!n) return;
  try {
    const stored = await getPlatform().storage.getItem(TOKEN_KEY);
    if (!stored) return;
    if (!(await n.getPermissionsAsync()).granted) return;
    const { data: token } = await n.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    if (stored === token) return;
    await api('push/device', 'PUT', { token, platform: platform(), app: APP });
    await getPlatform().storage.setItem(TOKEN_KEY, token);
  } catch (e: unknown) {
    console.warn('[push] refresh skipped', String((e as Error)?.message ?? e));
  }
}

/** A push to this account's own devices — how a fresh install is proven. */
export async function sendTestPush(): Promise<number> {
  const r = await api<{ ok: number }>('push/test', 'POST');
  return r.ok ?? 0;
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
