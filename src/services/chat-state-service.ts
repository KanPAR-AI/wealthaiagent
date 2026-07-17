// Client for the conversation-state debug/erasure API (chatservice
// api/v1/endpoints/chat_state.py). Powers the "What I've learned" panel:
// read the slots/belief/event-log the assistant is carrying, and let the user
// forget one value or wipe the chat's whole state.

import { getApiUrl } from "@/config/environment";

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
  kind: string; // asserted | hypothetical | committed | cleared
  source_seq: number | null;
  evidence?: string | null;
  version: number;
  created_at: string;
}

export interface ChatState {
  chat_id: string;
  domains: StateDomain[];
  belief: Record<string, unknown> | null;
  events: StateEvent[];
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchChatState(chatId: string, token: string): Promise<ChatState> {
  const res = await fetch(getApiUrl(`/chats/${chatId}/state`), {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to load chat state: ${res.status}`);
  return res.json();
}

export async function forgetSlot(
  chatId: string,
  domain: string,
  slot: string,
  token: string,
): Promise<void> {
  const res = await fetch(
    getApiUrl(`/chats/${chatId}/state/slots/${encodeURIComponent(domain)}/${encodeURIComponent(slot)}`),
    { method: "DELETE", headers: authHeaders(token) },
  );
  if (!res.ok && res.status !== 204) throw new Error(`Failed to forget slot: ${res.status}`);
}

export async function forgetAllState(chatId: string, token: string): Promise<void> {
  const res = await fetch(getApiUrl(`/chats/${chatId}/state`), {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok && res.status !== 204) throw new Error(`Failed to wipe state: ${res.status}`);
}

// ── User-level "learned about you" + personalization toggle ──────────────

export interface UserMemory {
  personalization_enabled: boolean;
  fact_count: number;
  memory: Record<string, Array<Record<string, unknown>>>;
}

export async function fetchUserMemory(token: string): Promise<UserMemory> {
  const res = await fetch(getApiUrl("/users/me/memory"), { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Failed to load user memory: ${res.status}`);
  return res.json();
}

export async function setPersonalization(enabled: boolean, token: string): Promise<void> {
  const res = await fetch(getApiUrl("/users/me/personalization"), {
    method: "PUT",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error(`Failed to set personalization: ${res.status}`);
}
