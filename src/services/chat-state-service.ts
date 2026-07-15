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
}

export interface StateDomain {
  domain: string;
  version: number;
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
