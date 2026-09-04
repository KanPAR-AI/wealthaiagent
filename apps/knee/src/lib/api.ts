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
