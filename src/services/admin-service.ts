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
  is_dynamic?: boolean;
  status?: "draft" | "active" | "archived";
  created_at?: string | null;
  updated_at?: string | null;
}

export async function fetchAgents(): Promise<{ agents: AgentInfo[] }> {
  return adminFetch("/agents");
}

export async function deleteAgent(
  agentId: string
): Promise<{ agent_id: string; deleted: boolean }> {
  return adminFetch(`/agents/${agentId}`, { method: "DELETE" });
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

// Individual chunk as returned when include_chunks=true — used by
// the inline chunk editor in the corpus panel.
export interface CorpusChunk {
  chunk_id: number;
  source_id: string;
  source_type: string;
  title: string;
  text: string;
  language: string;
  timestamp_seconds?: number;
  speaker?: string;
  asr_confidence?: number;
  url?: string | null;
}

export interface CorpusListResponse {
  items: CorpusItem[];
  total_chunks: number;
  chunks?: CorpusChunk[];
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
  status:
    | "pending"
    | "running"
    | "awaiting_review"
    | "finalizing"
    | "complete"
    | "failed"
    | "cancelled";
  chunks_created: number;
  error: string | null;
  progress_pct?: number;
  progress_stage?: string;
  created_at: string;
  updated_at?: string;
  started_at?: string | null;
  finished_at?: string | null;
  source_url?: string | null;
  needs_review?: boolean;
}

export async function fetchCorpus(
  agentId: string,
  opts?: { sourceId?: string; includeChunks?: boolean }
): Promise<CorpusListResponse> {
  const params = new URLSearchParams();
  if (opts?.sourceId) params.set("source_id", opts.sourceId);
  if (opts?.includeChunks) params.set("include_chunks", "true");
  const qs = params.toString();
  return adminFetch(`/agents/${agentId}/corpus${qs ? "?" + qs : ""}`);
}

export async function fetchCorpusStats(agentId: string): Promise<CorpusStats> {
  return adminFetch(`/agents/${agentId}/corpus/stats`);
}

export async function addCorpusYouTube(
  agentId: string,
  youtubeUrl: string,
  transcript?: string
): Promise<{ job_id: string; status: string; poll_url: string }> {
  const payload: Record<string, string> = { youtube_url: youtubeUrl };
  if (transcript) payload.transcript = transcript;
  return adminFetch(`/agents/${agentId}/corpus/youtube`, {
    method: "POST",
    body: JSON.stringify(payload),
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

// --- Corpus Upload Helpers ---

async function adminUpload(endpoint: string, formData: FormData) {
  const token = await auth.currentUser?.getIdToken();
  const url = getApiUrl(`/admin${endpoint}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `Upload error: ${res.status}`);
  }
  return res.json();
}

export async function addCorpusPdf(
  agentId: string,
  file: File
): Promise<{ job_id: string; poll_url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  return adminUpload(`/agents/${agentId}/corpus/pdf`, fd);
}

export async function addCorpusAudio(
  agentId: string,
  file: File,
  opts?: { language?: string; transcript?: string }
): Promise<{ job_id: string; poll_url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  if (opts?.language) fd.append("language", opts.language);
  if (opts?.transcript) fd.append("transcript", opts.transcript);
  return adminUpload(`/agents/${agentId}/corpus/audio`, fd);
}

export async function addCorpusVideoFile(
  agentId: string,
  file: File,
  storeSource: boolean = true,
  opts?: { language?: string; transcript?: string }
): Promise<{ job_id: string; poll_url: string; store_source: boolean; requires_review: boolean }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("store_source", storeSource ? "true" : "false");
  if (opts?.language) fd.append("language", opts.language);
  if (opts?.transcript) fd.append("transcript", opts.transcript);
  return adminUpload(`/agents/${agentId}/corpus/video`, fd);
}

// --- Curated ingestion: staged transcript review ---

export interface StagedSegment {
  text: string;
  start_seconds: number;
  end_seconds: number;
  speaker: string;
  confidence: number;
  is_speech: boolean;
  language: string;
}

export interface StagedSpeaker {
  id: string;
  speech_seconds: number;
  speech_ratio: number;
  description?: string;
}

export interface StagedTranscript {
  segments: StagedSegment[];
  speakers: StagedSpeaker[];
  total_duration_seconds: number;
  non_speech_ratio: number;
  detected_languages: string[];
  engine: string;
  engine_notes: string;
}

// LLM-sanitized passage — the cleaned/restructured output used
// as the default view in the review panel.
export interface SanitizedPassage {
  topic: string;
  content: string;
  source_start_seconds: number;
  source_end_seconds: number;
  source_segment_indices: number[];
  quality: number;
}

export interface SanitizedPayload {
  passages: SanitizedPassage[];
  dropped_count: number;
  dropped_reasons: string[];
  overall_quality_note: string;
  model: string;
}

export interface StagedJobPayload {
  job_id: string;
  agent_id: string;
  source_type: string;
  source_ref: string;
  source_url: string | null;
  staged: {
    source_id: string;
    source_type: string;
    filename: string;
    org_id: string;
    agent_id: string;
    source_url: string | null;
    transcript: StagedTranscript;
    sanitized: SanitizedPayload | null;
  };
}

export async function fetchStagedTranscript(
  agentId: string,
  jobId: string
): Promise<StagedJobPayload> {
  return adminFetch(`/agents/${agentId}/corpus/jobs/${jobId}/transcript`);
}

export interface FinalizeCurationRequest {
  // Mode selector — null/undefined = auto (sanitized if available)
  use_sanitized?: boolean;
  // Sanitized mode (default): curate LLM-cleaned passages
  keep_passage_indices?: number[];
  passage_edits?: Record<number, string>;
  // Raw mode (fallback): curate original ASR segments
  keep_segment_indices?: number[];
  segment_edits?: Record<number, string>;
  segment_speaker_overrides?: Record<number, string>;
  primary_speakers?: string[];
  drop_non_speech?: boolean;
  min_confidence?: number;
}

export async function finalizeStagedJob(
  agentId: string,
  jobId: string,
  curation: FinalizeCurationRequest
): Promise<{ job_id: string; status: string; poll_url: string }> {
  return adminFetch(`/agents/${agentId}/corpus/jobs/${jobId}/finalize`, {
    method: "POST",
    body: JSON.stringify(curation),
  });
}

export async function cancelStagedJob(
  agentId: string,
  jobId: string
): Promise<{ job_id: string; status: string }> {
  return adminFetch(`/agents/${agentId}/corpus/jobs/${jobId}/cancel`, {
    method: "POST",
  });
}

// --- Per-chunk editing ---

export async function updateCorpusChunk(
  agentId: string,
  chunkId: number,
  newText: string
): Promise<{ chunk_id: number; text: string; total_chunks: number }> {
  return adminFetch(`/agents/${agentId}/corpus/chunks/${chunkId}`, {
    method: "PATCH",
    body: JSON.stringify({ text: newText }),
  });
}

export async function deleteCorpusChunkById(
  agentId: string,
  chunkId: number
): Promise<{ chunk_id: number; removed_text_preview: string; total_chunks: number }> {
  return adminFetch(`/agents/${agentId}/corpus/chunks/${chunkId}`, {
    method: "DELETE",
  });
}

export async function addCorpusDocument(
  agentId: string,
  file: File
): Promise<{ job_id: string; poll_url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  return adminUpload(`/agents/${agentId}/corpus/document`, fd);
}

export async function addCorpusText(
  agentId: string,
  text: string,
  title: string
): Promise<{ job_id: string; poll_url: string }> {
  return adminFetch(`/agents/${agentId}/corpus/text`, {
    method: "POST",
    body: JSON.stringify({ text, title }),
  });
}

export async function addCorpusBatch(
  agentId: string,
  files: File[]
): Promise<{ jobs: Array<{ job_id: string; filename: string }> }> {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  return adminUpload(`/agents/${agentId}/corpus/batch`, fd);
}

export interface RetrievalTestResult {
  recall_at_5: number;
  mrr_at_5: number;
  per_query_results: Array<{
    query: string;
    text?: string;
    title?: string;
    source_id?: string;
    score?: number;
    expected?: string[];
    retrieved?: string[];
    recall: number;
    mrr: number;
  }>;
}

export async function runCorpusTest(
  agentId: string,
  query?: string
): Promise<RetrievalTestResult> {
  return adminFetch(`/agents/${agentId}/corpus/test`, {
    method: "POST",
    body: JSON.stringify({ query: query || "" }),
  });
}

// --- Tool Library ---

export interface ToolInfo {
  name: string;
  display_name: string;
  description: string;
  category: string;
  type: "composio" | "custom";
}

export async function fetchToolLibrary(): Promise<{ tools: ToolInfo[] }> {
  return adminFetch("/tools/library");
}

export async function updateAgentTools(
  agentId: string,
  enabledTools: string[]
): Promise<{ agent_id: string; enabled_tools: string[]; status: string }> {
  return adminFetch(`/agents/${agentId}/tools`, {
    method: "PUT",
    body: JSON.stringify({ enabled_tools: enabledTools }),
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
