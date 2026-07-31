// services/memory-service.ts — admin memory explorer API client
// (chatservice api/v1/endpoints/memory_explorer.py).
//
// Lookup is by EMAIL. A Firebase uid is 28 opaque characters nobody can type
// from memory; having to paste one is why this data went uninspected.

import { getApiUrl } from "@/config/environment";
import { auth } from "@/config/firebase";

/** How far a piece of memory travels — the thing that is invisible in a reply
 *  but determines everything about behaviour. */
export type MemoryScope = "chat" | "agent" | "user";

export interface ResolvedUser {
  uid: string;
  email: string;
  /** firebase_auth | firestore | uid | uid_unverified */
  source: string;
}

export interface MemoryFact {
  key?: string;
  value?: unknown;
  category?: string;
  confidence?: number;
  weight?: number;
  updated_at?: string;
}

export interface FactStore {
  collection: string;
  agent_id: string | null;
  scope: MemoryScope;
  /** True when the store follows the user across every agent. */
  cross_domain: boolean;
  fact_count: number;
  facts: MemoryFact[];
}

export interface UserMemory {
  agent_scoped: FactStore[];
  user_scoped: FactStore[];
  preferences: { personalization_enabled?: boolean };
  total_facts?: number;
}

export interface AuditRow {
  at: string;
  scope: MemoryScope;
  /** asserted | committed | cleared | pinned | superseded | released | learned | tool_call | artifact */
  action: string;
  what: string;
  detail: string;
  source: string;
  agent: string;
}

export interface MemoryView {
  user: ResolvedUser;
  user_memory: UserMemory;
  // The chat snapshot is a loose bag of per-domain state; it is rendered
  // generically rather than typed field-by-field, because domains add slots
  // without this client knowing.
  chat_memory: Record<string, unknown>;
  audit: AuditRow[];
  audit_limit: number;
  /** Non-empty means part of the timeline is MISSING, not that nothing
   *  happened. Rendering a confident blank over a failed read is the one thing
   *  this page must never do. */
  errors?: string[];
}

async function memFetch(endpoint: string) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(getApiUrl(`/admin${endpoint}`), {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `Memory API error: ${res.status}`);
  }
  return res.json();
}

/** Confirm WHO an email resolves to before showing anything about them —
 *  rendering another user's memory because of a typo is worse than nothing. */
export const resolveUser = (identifier: string): Promise<ResolvedUser> =>
  memFetch(`/memory/resolve?identifier=${encodeURIComponent(identifier)}`);

export const fetchMemory = (
  opts: { identifier?: string; chatId?: string; auditLimit?: number },
): Promise<MemoryView> => {
  const q = new URLSearchParams();
  if (opts.identifier) q.set("identifier", opts.identifier);
  if (opts.chatId) q.set("chat_id", opts.chatId);
  q.set("audit_limit", String(opts.auditLimit ?? 50));
  return memFetch(`/memory?${q.toString()}`);
};
