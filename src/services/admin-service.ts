// services/admin-service.ts
// API service for admin portal endpoints

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

// --- Agents ---

export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
}

export async function fetchAgents(): Promise<{ agents: AgentInfo[] }> {
  return adminFetch("/agents");
}

// --- Videos ---

export interface VideoInfo {
  video_id: string;
  title: string;
  url: string;
  chunks_count: number;
  exercise_chunks: number;
  knowledge_chunks: number;
  exercises_found: string[];
}

export interface VideoListResponse {
  videos: VideoInfo[];
  total_chunks: number;
  total_videos: number;
}

export async function fetchVideos(agentId: string): Promise<VideoListResponse> {
  return adminFetch(`/agents/${agentId}/videos`);
}

export interface AddVideoRequest {
  youtube_url: string;
  extract_exercises: boolean;
  rebuild_catalog: boolean;
  reload_redis: boolean;
}

export interface AddVideoResponse {
  job_id: string;
  video_id: string;
  status: string;
  poll_url: string;
}

export async function addVideo(
  agentId: string,
  req: AddVideoRequest
): Promise<AddVideoResponse> {
  return adminFetch(`/agents/${agentId}/videos`, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export interface VideoJob {
  job_id: string;
  video_id: string;
  status: "pending" | "running" | "completed" | "failed";
  current_step: string;
  step_number: number;
  total_steps: number;
  message: string;
  result: Record<string, unknown> | null;
  error: string | null;
}

export async function pollVideoJob(
  agentId: string,
  jobId: string
): Promise<VideoJob> {
  return adminFetch(`/agents/${agentId}/videos/jobs/${jobId}`);
}

export async function deleteVideo(
  agentId: string,
  videoId: string
): Promise<{ video_id: string; chunks_removed: number; total_chunks: number }> {
  return adminFetch(`/agents/${agentId}/videos/${videoId}`, {
    method: "DELETE",
  });
}

// --- Model Config ---

export interface ModelSlot {
  label: string;
  description: string;
  current_model: string;
  default_model: string;
  allowed_models: string[];
}

export interface ModelConfigResponse {
  agent_id: string;
  model_slots: Record<string, ModelSlot>;
}

export async function fetchModelConfig(
  agentId: string
): Promise<ModelConfigResponse> {
  return adminFetch(`/agents/${agentId}/models`);
}

export async function updateModelConfig(
  agentId: string,
  modelSlots: Record<string, string>
): Promise<{ agent_id: string; model_slots: Record<string, string>; status: string }> {
  return adminFetch(`/agents/${agentId}/models`, {
    method: "PUT",
    body: JSON.stringify({ model_slots: modelSlots }),
  });
}

// --- Costs ---

export interface CostSummary {
  total_requests: number;
  total_tokens: number;
  total_cost_usd: number;
  by_model: Record<
    string,
    { requests: number; tokens: number; cost_usd: number }
  >;
}

export interface DailyBreakdown {
  date: string;
  requests: number;
  tokens: number;
  cost_usd: number;
}

export interface CostResponse {
  agent_id: string;
  period: string;
  summary: CostSummary;
  daily_breakdown: DailyBreakdown[];
}

export async function fetchCosts(
  agentId: string,
  period: "1d" | "7d" | "30d" = "7d"
): Promise<CostResponse> {
  return adminFetch(`/agents/${agentId}/costs?period=${period}`);
}

// --- Dish Library ---

export interface PendingDish {
  id: string;
  food_id: string;
  name: string;
  calories_per_100g: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  serving_g: number;
  serving_desc: string;
  category: string;
  source: string;
  warnings: string[];
}

export async function generateDishBatch(
  agentId: string,
  cuisine: string,
  count: number = 25
) {
  return adminFetch(`/agents/${agentId}/dishes/generate`, {
    method: "POST",
    body: JSON.stringify({ cuisine, count }),
  });
}

export async function fetchPendingDishes(
  agentId: string,
  cuisine?: string
): Promise<{ dishes: PendingDish[]; count: number }> {
  const params = cuisine ? `?cuisine=${encodeURIComponent(cuisine)}` : "";
  return adminFetch(`/agents/${agentId}/dishes/pending${params}`);
}

export async function approveDishes(
  agentId: string,
  dishIds: string[],
  edits?: Record<string, Record<string, number>>
) {
  return adminFetch(`/agents/${agentId}/dishes/approve`, {
    method: "POST",
    body: JSON.stringify({ dish_ids: dishIds, edits }),
  });
}

export async function rejectDishes(agentId: string, dishIds: string[]) {
  return adminFetch(`/agents/${agentId}/dishes/reject`, {
    method: "POST",
    body: JSON.stringify({ dish_ids: dishIds }),
  });
}

// --- RAG Corpus ---

export interface CorpusItem {
  source_id: string;
  title: string;
  source_type: string;
  language: string;
  original_language: string;
  chunk_count: number;
}

export interface CorpusListResponse {
  items: CorpusItem[];
  total_chunks: number;
}

export interface CorpusStats {
  total_chunks: number;
  by_source_type: Record<string, number>;
  by_language: Record<string, number>;
  unique_sources: number;
}

export interface CorpusJob {
  job_id: string;
  agent_id?: string;
  source_type: string;
  source_ref: string;
  status: "pending" | "running" | "complete" | "failed";
  chunks_created: number;
  error: string | null;
  created_at: string;
  updated_at?: string;
}

export async function fetchCorpus(agentId: string): Promise<CorpusListResponse> {
  return adminFetch(`/agents/${agentId}/corpus`);
}

export async function fetchCorpusStats(agentId: string): Promise<CorpusStats> {
  return adminFetch(`/agents/${agentId}/corpus/stats`);
}

export async function addCorpusYouTube(
  agentId: string,
  youtubeUrl: string
): Promise<{ job_id: string; status: string; poll_url: string }> {
  return adminFetch(`/agents/${agentId}/corpus/youtube`, {
    method: "POST",
    body: JSON.stringify({ youtube_url: youtubeUrl }),
  });
}

export async function pollCorpusJob(
  agentId: string,
  jobId: string
): Promise<CorpusJob> {
  return adminFetch(`/agents/${agentId}/corpus/jobs/${jobId}`);
}

export async function listCorpusJobs(
  agentId: string
): Promise<{ jobs: CorpusJob[] }> {
  return adminFetch(`/agents/${agentId}/corpus/jobs`);
}

export async function deleteCorpusItem(
  agentId: string,
  sourceId: string
): Promise<{ source_id: string; chunks_removed: number; remaining_chunks: number }> {
  return adminFetch(`/agents/${agentId}/corpus/${sourceId}`, {
    method: "DELETE",
  });
}

export async function reloadCorpusVectors(
  agentId: string
): Promise<{ status: string; chunks_loaded: number }> {
  return adminFetch(`/agents/${agentId}/corpus/vectors/reload`, {
    method: "POST",
  });
}

// --- User Memory ---

export interface UserMemoryFact {
  key: string;
  value: string;
  category: string;
  confidence: number;
  weight: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface UserMemoryResponse {
  user_id: string;
  facts: UserMemoryFact[];
  total_facts: number;
}

export async function fetchUserMemory(
  agentId: string,
  userId: string
): Promise<UserMemoryResponse> {
  return adminFetch(`/agents/${agentId}/users/${userId}/memory`);
}

export async function clearUserMemory(
  agentId: string,
  userId: string
): Promise<{ user_id: string; facts_cleared: number }> {
  return adminFetch(`/agents/${agentId}/users/${userId}/memory`, {
    method: "DELETE",
  });
}
