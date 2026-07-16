// Client for the conversation-state debug/erasure API (chatservice
// api/v1/endpoints/chat_state.py) — the data behind the mobile "What I've
// learned" panel. Mirrors the web src/services/chat-state-service.ts.

import { apiUrl } from '@/lib/server-config';
import { getToken } from '@/lib/auth';

export interface StateSlot {
  key: string;
  value: unknown;
  label: string;
  source?: string | null;
  stale?: boolean;
  age_days?: number | null;
}

export interface StateDomain {
  domain: string;
  version: number;
  overlay?: Record<string, unknown> | null;
  overlay_label?: string | null;
  slots: StateSlot[];
}

export interface StateEvent {
  domain: string;
  slot: string;
  value: unknown;
  kind: string;
  source_seq: number | null;
  created_at: string;
}

export interface ChatState {
  chat_id: string;
  domains: StateDomain[];
  belief: Record<string, unknown> | null;
  events: StateEvent[];
}

async function authHeaders(): Promise<Record<string, string>> {
  const t = await getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function fetchChatState(chatId: string): Promise<ChatState> {
  const res = await fetch(apiUrl(`/chats/${chatId}/state`), { headers: await authHeaders() });
  if (!res.ok) throw new Error(`state ${res.status}`);
  return res.json();
}

export async function forgetSlot(chatId: string, domain: string, slot: string): Promise<void> {
  const res = await fetch(
    apiUrl(`/chats/${chatId}/state/slots/${encodeURIComponent(domain)}/${encodeURIComponent(slot)}`),
    { method: 'DELETE', headers: await authHeaders() },
  );
  if (!res.ok && res.status !== 204) throw new Error(`forget ${res.status}`);
}

export async function forgetAllState(chatId: string): Promise<void> {
  const res = await fetch(apiUrl(`/chats/${chatId}/state`), {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok && res.status !== 204) throw new Error(`wipe ${res.status}`);
}

// ── User-level "learned about you" + personalization toggle ──────────────

export interface UserMemory {
  personalization_enabled: boolean;
  fact_count: number;
  // { collectionId: [ {key,value,category,...}, … ] }
  memory: Record<string, Array<Record<string, unknown>>>;
}

export async function fetchUserMemory(): Promise<UserMemory> {
  const res = await fetch(apiUrl('/users/me/memory'), { headers: await authHeaders() });
  if (!res.ok) throw new Error(`memory ${res.status}`);
  return res.json();
}

export async function setPersonalization(enabled: boolean): Promise<void> {
  const res = await fetch(apiUrl('/users/me/personalization'), {
    method: 'PUT',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error(`personalization ${res.status}`);
}
