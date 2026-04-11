// services/agent-builder-service.ts
// API client for dynamic agent CRUD and prompt versioning

import { getApiUrl } from "@/config/environment";
import { auth } from "@/config/firebase";

async function adminFetch(endpoint: string, options: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const url = getApiUrl(`/admin${endpoint}`);

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `Admin API error: ${res.status}`);
  }

  return res.json();
}

// --- Types ---

export type AgentStatus = "draft" | "active" | "archived";

export interface RoutingConfig {
  strong_indicators: string[];
  context_markers: string[];
  router_description: string;
}

export interface PromptsConfig {
  system_prompt: string;
  user_instruction: string;
  disclaimer: string;
  active_version?: number;
}

export interface MemoryConfig {
  enabled: boolean;
  categories: string[];
  decay_rates: Record<string, number>;
  extraction_prompt: string;
}

export interface OntologyEntity {
  display_name: string;
  category: string;
  aliases: string[];
}

export interface DynamicAgentConfig {
  agent_id: string;
  name: string;
  description: string;
  status: AgentStatus;
  created_at: string;
  created_by: string;
  updated_at: string;
  routing: RoutingConfig;
  prompts: PromptsConfig;
  memory_config: MemoryConfig;
  ontology: { entities: Record<string, OntologyEntity> };
  model_config: Record<string, { label: string; default: string; allowed: string[] }>;
  capabilities: string[];
}

export interface PromptVersion {
  version: number;
  system_prompt: string;
  user_instruction: string;
  created_at: string;
  created_by: string;
  change_note: string;
}

export interface CreateAgentRequest {
  agent_id: string;
  name: string;
  description: string;
  prompts?: Partial<PromptsConfig>;
  routing?: Partial<RoutingConfig>;
  memory_config?: Partial<MemoryConfig>;
  capabilities?: string[];
}

// --- Agent CRUD ---

export async function createDynamicAgent(
  req: CreateAgentRequest
): Promise<{ agent_id: string; status: AgentStatus; created_at: string }> {
  return adminFetch("/agents", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function fetchAgentConfig(
  agentId: string
): Promise<DynamicAgentConfig> {
  return adminFetch(`/agents/${agentId}/config`);
}

export async function updateAgentConfig(
  agentId: string,
  updates: Partial<DynamicAgentConfig>
): Promise<{ agent_id: string; updated_at: string }> {
  return adminFetch(`/agents/${agentId}/config`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

export async function updateAgentStatus(
  agentId: string,
  status: AgentStatus
): Promise<{ agent_id: string; status: AgentStatus; updated_at: string }> {
  return adminFetch(`/agents/${agentId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

// --- Prompt Versioning ---

export async function fetchPromptVersions(
  agentId: string
): Promise<{ versions: PromptVersion[] }> {
  return adminFetch(`/agents/${agentId}/prompts/versions`);
}

export async function updatePrompts(
  agentId: string,
  systemPrompt: string,
  userInstruction: string,
  changeNote: string
): Promise<{ agent_id: string; version: number }> {
  return adminFetch(`/agents/${agentId}/prompts`, {
    method: "PUT",
    body: JSON.stringify({
      system_prompt: systemPrompt,
      user_instruction: userInstruction,
      change_note: changeNote,
    }),
  });
}

export async function restorePromptVersion(
  agentId: string,
  version: number
): Promise<{ agent_id: string; restored_version: number; new_version: number }> {
  return adminFetch(`/agents/${agentId}/prompts/restore`, {
    method: "POST",
    body: JSON.stringify({ version }),
  });
}

// --- Hot Reload ---

export async function reloadAgent(
  agentId: string
): Promise<{ status: string }> {
  return adminFetch(`/agents/${agentId}/reload`, {
    method: "POST",
  });
}

// --- Agent Builder: Goal-First Draft (Phase 1A endpoint) ---

export interface AgentDraft {
  agent_id: string;
  name: string;
  description: string;
  routing: {
    strong_indicators: string[];
    context_markers: string[];
    router_description: string;
  };
  prompts: {
    system_prompt: string;
    user_instruction: string;
    disclaimer: string;
  };
  memory_config: {
    enabled: boolean;
    categories: string[];
    decay_rates: Record<string, number>;
    extraction_prompt: string;
  };
  ontology: Record<
    string,
    { display_name: string; category: string; aliases: string[] }
  >;
  example_queries: string[];
}

/**
 * Goal-first draft: takes a one-sentence description of what the agent
 * should do and returns a complete config draft from Claude Opus 4.6
 * (with fallback to Gemini / GPT-4 if Anthropic is down).
 *
 * The admin then edits what they want and calls createDynamicAgent.
 * This is the Phase 1 productionization entry point that replaces
 * the 4-step wizard.
 */
export async function draftFromGoal(
  goal: string
): Promise<{ draft: AgentDraft; status: string }> {
  return adminFetch("/agent-builder/draft", {
    method: "POST",
    body: JSON.stringify({ goal }),
  });
}
