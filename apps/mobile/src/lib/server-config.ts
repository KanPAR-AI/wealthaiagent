// Runtime backend switcher.
//
// The API base URL used to be frozen into the bundle from
// EXPO_PUBLIC_API_BASE_URL, which meant every local↔prod flip needed a
// .env edit + Metro restart + Xcode rebuild (and a phone tethered to the
// Mac to test local at all). The base URL is now a runtime setting:
// persisted, applied instantly, defaulting to the bundle env value —
// so TestFlight/prod builds behave exactly as before until someone
// deliberately switches.
//
// Consumers must call getBaseUrl() at REQUEST time (not import time).

import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL, API_VERSION } from './env';

const STORAGE_KEY = 'server_base_url_override';
export const PROD_BASE_URL = 'https://chatbackend.yourfinadvisor.com';

let baseUrl: string = API_BASE_URL;
const listeners = new Set<(url: string) => void>();

/** Load the persisted override before the first request. Called once at
 *  app boot (core-adapter init); safe to call repeatedly. */
export async function initServerConfig(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) baseUrl = saved;
  } catch {
    /* storage unavailable — bundle default stands */
  }
}

export function getBaseUrl(): string {
  return baseUrl;
}

export function isProd(): boolean {
  return baseUrl === PROD_BASE_URL;
}

/** Switch backends. Pass null to clear the override (back to the bundle
 *  default). The caller is responsible for resetting per-server state
 *  (chat store, auth session). */
export async function setBaseUrl(url: string | null): Promise<void> {
  const clean = (url || '').trim().replace(/\/+$/, '');
  baseUrl = clean || API_BASE_URL;
  try {
    if (clean) await AsyncStorage.setItem(STORAGE_KEY, clean);
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* in-memory switch still applies for this session */
  }
  listeners.forEach((l) => l(baseUrl));
}

export function onServerChange(fn: (url: string) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Build a full API URL against the CURRENT server. */
export function apiUrl(endpoint: string): string {
  const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (clean.startsWith(`/api/${API_VERSION}`)) return `${baseUrl}${clean}`;
  return `${baseUrl}/api/${API_VERSION}${clean}`;
}
