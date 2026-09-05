// The library's reads — `GET /api/v1/knee/program*`, authenticated as the
// signed-in (or anonymous) user. Thin on purpose: the wire shapes live in
// `library-view.ts` where they are tested against captured fixtures, and
// nothing here reshapes a response.

import { fetch as expoFetch } from 'expo/fetch';

import { getToken } from './auth';
import { apiUrl } from './core-adapter';
import type { WirePhaseDetail, WireProgram } from './library-view';

async function get<T>(endpoint: string): Promise<T> {
  const token = await getToken();
  const res = await expoFetch(apiUrl(endpoint), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`The program could not be loaded (HTTP ${res.status}).`);
  }
  return (await res.json()) as T;
}

export function fetchProgram(): Promise<WireProgram> {
  return get<WireProgram>('/knee/program');
}

export function fetchPhase(phase: string): Promise<WirePhaseDetail> {
  return get<WirePhaseDetail>(`/knee/program/${encodeURIComponent(phase)}`);
}

export interface WireProgress {
  streak_days: number;
  today_done: boolean;
  gate: { pain_free_days: number; needed: number; ready: boolean };
  pain: { date: string; pain: number }[];
  sessions_recorded: number;
}

async function post<T>(endpoint: string, body: unknown): Promise<T> {
  const token = await getToken();
  const res = await expoFetch(apiUrl(endpoint), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Request failed (HTTP ${res.status}).`);
  return (await res.json()) as T;
}

export function fetchProgress(today: string): Promise<WireProgress> {
  return get<WireProgress>(`/knee/progress?today=${today}`);
}

export function recordSession(body: {
  date: string; phase: string; recipe: string;
  exercises_done: string[]; duration_s: number; pain_0_10: number | null;
}): Promise<WireProgress & { recorded: boolean }> {
  return post(`/knee/session`, body);
}

/** `app=knee` sizes the one-time welcome grant (200k, owner ruling). */
export function fetchBalance(): Promise<{ balance: number; unlimited: boolean }> {
  return get(`/credits/balance?app=knee`);
}

export function requestCredits(note: string): Promise<unknown> {
  return post(`/credits/request`, { amount: 200000, note });
}
