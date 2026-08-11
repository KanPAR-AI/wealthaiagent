// memory-service.ts — read-only mobile client for the Memory Engine gateway
// (chatservice /memories/*). Mirrors the web's memory-engine-service types
// verbatim; the mobile Control Centre displays engine outputs and computes
// nothing (confidence buckets etc. are display-only labels in the screen).

import { getToken } from '@/lib/auth';
import { apiUrl } from '@/lib/server-config';

export type MemoryType =
  | 'semantic' | 'preference' | 'episodic' | 'procedural' | 'profile' | 'relationship';

export type MemoryStatus =
  | 'active' | 'superseded' | 'expired' | 'disputed' | 'deleted';

export type SourceType =
  | 'user_explicit' | 'user_observed' | 'tool_verified' | 'document_verified'
  | 'agent_inference' | 'episode_consolidation' | 'system';

export interface EntityReference {
  kind: 'entity' | 'literal';
  entity_id: string | null;
  text: string;
}

/** Canonical engine record (MemoryRecord.to_dict) — same shape the web UI uses. */
export interface MemoryRecord {
  id: string;
  namespace: string;
  type: MemoryType;
  subject: EntityReference;
  predicate: string | null;
  value: unknown;
  text: string;
  status: MemoryStatus;
  authority: number;
  confidence: number;
  importance: number;
  source_type: SourceType;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_accessed_at: string | null;
  access_count: number;
  version: number;
  pinned: boolean;
  qualifiers: Record<string, string>;
  tags: string[];
}

export interface RetrievedMemoryRow {
  memory: MemoryRecord;
  score: number;
  score_breakdown: Record<string, number>;
  retrieval_reason: string;
  channels: string[];
}

export interface SearchResult {
  results: RetrievedMemoryRow[];
  pinned: RetrievedMemoryRow[];
  plan_reason: string;
  cached: boolean;
}

export interface MemoryOverview {
  active_count: number;
  inferred_count: number;
  shadow_count: number;
  superseded_count: number;
  disputed_count: number;
  new_this_week: number;
  by_status: Record<string, number>;
  by_namespace: Record<string, number>;
  recent_changes: Array<{
    id: string;
    predicate: string | null;
    value: unknown;
    namespace: string;
    status: MemoryStatus;
    source_type: SourceType;
    updated_at: string | null;
  }>;
}

export class MemoryEngineError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'MemoryEngineError';
    this.status = status;
  }
}

async function memoryFetch<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(apiUrl(`/memories${endpoint}`), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new MemoryEngineError(res.status, body.detail || `Memory Engine error (${res.status})`);
  }
  return res.json();
}

/** Overview aggregates — backend does all counting, the screen just renders. */
export const getOverview = (): Promise<MemoryOverview> => memoryFetch('/overview');

/** Browse without a query — the engine's own stable order, never re-sorted here. */
export const listMemories = (
  status: MemoryStatus[] = [],
): Promise<{ memories: MemoryRecord[] }> => {
  const params = new URLSearchParams();
  for (const s of status) params.append('status', s);
  const qs = params.toString();
  return memoryFetch(qs ? `?${qs}` : '');
};

/** Hybrid search against the real engine; rows carry retrieval_reason. */
export const searchMemories = (
  text: string,
  limit = 30,
): Promise<SearchResult> =>
  memoryFetch('/search', { method: 'POST', body: JSON.stringify({ text, limit }) });
