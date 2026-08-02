// Admin API client for the corpus video review queue.
//
// The queue exists because seven videos in the knee library have no readable
// name — the footage shows a phase card and then only countdown timers, and the
// extractor is forbidden from guessing one from the posture. Finishing them
// needs a person, and this is what that person talks to.

import { getApiUrl } from "@/config/environment";
import { auth } from "@/config/firebase";

export type VideoState = "unlabelled" | "translation_review" | "labelled";

export interface CorpusVideoDoc {
  id: string;
  /** The Firestore storage key. Differs from `id` whenever the document has a
   *  content hash, and it is the one an edit must address -- patching by `id`
   *  404s against a key that does not exist. */
  doc_id?: string;
  kind?: string;
  title?: string;
  exercise?: string | null;
  topic?: string | null;
  phase?: string;
  language?: string;
  video_file?: string | null;
  duration_s?: number;
  source?: string;
  needs_review?: boolean;
  translated_from?: string;
  /** Which fields a person set, so the UI can show what is curated and what
   *  was merely extracted. A re-index never overwrites the former. */
  provenance?: Record<string, { source: string; by?: string; at?: string }>;
  /** Ingest evidence, carried onto the document so it can be READ. Not
   *  embedded: the transcript belongs to the whole video, and twelve videos
   *  hold several exercises. */
  source_transcript?: string;
  on_screen_text?: string[];
  has_speech?: boolean;
  evidence_from?: string;
  start_seconds?: number;
  end_seconds?: number;
  /** Derived server-side. Which pipeline stage this document has NOT cleared. */
  stage?: string;
  next_action?: string | null;
  /** How many documents come from this same source. 49 videos produced 74
   *  documents, so a row is an ENTITY, not a video — without saying so, three
   *  rows quoting one filename and one transcript read as duplicates. */
  items_in_source?: number;
  transcript_segments?: { text: string; start: number; duration?: number; speaker?: string }[];
  span_source?: string;
  span_confidence?: number;
  suggested?: Record<string, { value: unknown; by?: string; at?: string }>;
  rejected?: boolean;
}

export interface CorpusVideoView {
  corpus_id: string;
  /** Counts by state and source kind, plus `pending_publish` /
   *  `never_published` — how far the index has fallen behind the queue.
   *  Publishing is an explicit action, so without that number an admin has to
   *  REMEMBER to publish, and a corpus that silently stops matching its review
   *  queue is the defect that made this whole surface a no-op. */
  summary: Record<string, number>;
  funnel?: Funnel;
  /** Agents subscribed to this corpus. Empty means it reaches no answer, no
   *  matter how well it is indexed. */
  readers?: string[];
  documents: CorpusVideoDoc[];
  editable_fields: string[];
}

async function call(path: string, init?: RequestInit) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(getApiUrl(`/admin/corpus${path}`), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    // FastAPI wraps refusals as {"detail": "..."} (and the app's handler nests
    // it again under {"error": {"message": ...}}). Throwing the raw body put
    // `400 {"error":{"code":"HTTP_EXCEPTION","message":"..."}}` in front of the
    // user, so a careful, readable refusal arrived looking like a crash.
    const body = await res.text();
    let message = body;
    try {
      const parsed = JSON.parse(body);
      message =
        parsed?.error?.message ??
        (typeof parsed?.detail === "string" ? parsed.detail : null) ??
        parsed?.detail?.message ??
        body;
    } catch {
      /* not JSON — the raw body is the best we have */
    }
    throw new Error(message);
  }
  return res.json();
}

export async function fetchVideos(
  corpusId: string,
  state?: VideoState | "",
  kind?: string,
): Promise<CorpusVideoView> {
  const params = new URLSearchParams();
  if (state) params.set("state", state);
  if (kind) params.set("kind", kind);
  const q = params.toString();
  return call(`/${encodeURIComponent(corpusId)}/videos${q ? `?${q}` : ""}`);
}

/** Push ingest output straight into a corpus. The PDF and video tools emit the
 *  same document shape, so one import path serves both -- reading only a seed
 *  file baked into the image meant a corpus could hold exactly one kind of
 *  thing, decided at build time. */
export async function importDocuments(
  corpusId: string,
  documents: Record<string, unknown>[],
): Promise<{ added: number; merged_preserving_edits: number; summary: Record<string, number> }> {
  return call(`/${encodeURIComponent(corpusId)}/videos/import`, {
    method: "POST",
    body: JSON.stringify({ documents }),
  });
}

export async function patchVideo(
  corpusId: string,
  docId: string,
  field: string,
  value: unknown,
) {
  // encodeURIComponent is load-bearing: document ids contain spaces and
  // parentheses ("El_Paso_… (18)::unnamed") and an unencoded PATCH 404s.
  return call(
    `/${encodeURIComponent(corpusId)}/videos/${encodeURIComponent(docId)}`,
    { method: "PATCH", body: JSON.stringify({ field, value }) },
  );
}

export async function importVideos(corpusId: string) {
  return call(`/${encodeURIComponent(corpusId)}/videos/import`, { method: "POST" });
}

// ── publish, readers, assistant ─────────────────────────────────────────────
//
// Until publishing existed, everything above wrote to a collection no answer
// path read: the review queue lived in Firestore and retrieval read vectors
// baked into the container image. A label reached nobody.

export interface PublishResult {
  corpus_id: string;
  index: string;
  chunks: number;
  documents_published: number;
  held_back: Record<string, number>;
  readers?: string[];
  note?: string;
}

export async function publishCorpus(corpusId: string): Promise<PublishResult> {
  return call(`/${encodeURIComponent(corpusId)}/publish`, { method: "POST" });
}

/** Which agents may retrieve from this corpus. A corpus is its own thing, not
 *  a possession of one agent, so several can read it without a second copy. */
export async function setCorpusReaders(
  corpusId: string,
  readers: string[],
): Promise<{ readers: string[] }> {
  return call(`/${encodeURIComponent(corpusId)}/readers`, {
    method: "PUT",
    body: JSON.stringify({ readers }),
  });
}

export interface AssistantTurn {
  answer: string;
  /** What actually ran. Shown, not hidden: an assistant that changes a corpus
   *  and reports only prose is asking to be trusted; one that shows the call
   *  and the count it got back can be checked. */
  tool_calls: { name: string; arguments: Record<string, unknown>; result: Record<string, unknown> }[];
}

export async function askCorpusAssistant(
  corpusId: string,
  question: string,
  history: { role: string; content: string }[] = [],
): Promise<AssistantTurn> {
  return call(`/${encodeURIComponent(corpusId)}/assistant`, {
    method: "POST",
    body: JSON.stringify({ question, history }),
  });
}

// ── the pipeline ────────────────────────────────────────────────────────────
//
// A corpus page that lists documents cannot say what state the WORK is in. Every
// knee document looked equally finished; none had been segmented and none had
// been indexed. Stages are derived server-side from the document, never stored,
// so they cannot drift from what is actually true of it.

export type Stage = "ingested" | "read" | "segmented" | "named" | "published" | "rejected";

export interface Funnel {
  total: number;
  /** Cumulative — "44 of 74 read" is how far the corpus has got. */
  cleared: Record<string, number>;
  /** Occupancy — where each document is stuck. */
  stuck_at: Record<string, number>;
  stages: { key: string; label: string; blurb: string; next?: string }[];
}

export interface ExtractionSpec {
  instruction?: string;
  fields?: { name: string; instruction?: string }[];
}

/** Say when an item starts and ends in its source. A person can; the model
 *  cannot — the stored transcript has no segments and the source videos are
 *  unreachable, so a proposed timestamp would be a guess wearing a number. */
export async function setSegment(
  corpusId: string,
  docId: string,
  startSeconds: number,
  endSeconds: number,
) {
  return call(
    `/${encodeURIComponent(corpusId)}/videos/${encodeURIComponent(docId)}/segment`,
    { method: "PATCH", body: JSON.stringify({ start_seconds: startSeconds, end_seconds: endSeconds }) },
  );
}

export async function fetchExtractionSpec(
  corpusId: string,
): Promise<{ spec: ExtractionSpec }> {
  return call(`/${encodeURIComponent(corpusId)}/spec`);
}

/** Run one spec across a batch, so every document in it comes back keyed the
 *  same way. Re-typing guidelines per batch is how one video ends up keyed
 *  `equipment`, the next `apparatus` and a third `gear`. */
export async function extractCorpus(
  corpusId: string,
  spec: ExtractionSpec & { doc_ids?: string[]; dry_run?: boolean; limit?: number },
) {
  return call(`/${encodeURIComponent(corpusId)}/extract`, {
    method: "POST",
    body: JSON.stringify(spec),
  });
}

/** Carry the ingest evidence onto documents so it can be read. */
export async function backfillEvidence(corpusId: string) {
  return call(`/${encodeURIComponent(corpusId)}/evidence/backfill`, { method: "POST" });
}

// ── sources ─────────────────────────────────────────────────────────────────
//
// The list showed 74 rows for 49 videos, and the pipeline's two halves act on
// different things: you RE-TRANSCRIBE a video but you NAME an exercise. With
// only entities listed, every source-level action had no row to be a button on.

export interface CorpusSource {
  source: string;
  items: number;
  titles: string[];
  doc_ids: string[];
  duration_s?: number | null;
  has_speech: boolean;
  has_transcript: boolean;
  /** Whether the transcript kept its timings. A flat one looks identical on
   *  screen, and only a timed one lets spans be proposed rather than typed. */
  has_timings: boolean;
  stage: string;
  stages: string[];
  languages: string[];
  awaiting_translation_review: number;
}

export interface SourceSummary {
  sources: number;
  items: number;
  with_transcript: number;
  with_timings: number;
  needs_retranscribe: number;
  no_speech: number;
  languages: string[];
  awaiting_translation_review: number;
  /** Documents not cut from any source — derived summaries. Counted so the
   *  difference between 74 documents and 70 items is not a mystery. */
  not_from_a_source: number;
}

export async function fetchSources(
  corpusId: string,
): Promise<{ summary: SourceSummary; sources: CorpusSource[] }> {
  return call(`/${encodeURIComponent(corpusId)}/sources`);
}

/** Re-transcribe one source KEEPING the timings, then locate each item's span.
 *  Takes the file because the sources are not reachable from the server — a
 *  button that silently could not find the media would not be honest. */
export async function retranscribeSource(
  corpusId: string,
  source: string,
  file: File,
  instruction: string,
  proposeSpans = true,
) {
  const token = await auth.currentUser?.getIdToken();
  const form = new FormData();
  form.append("file", file);
  const params = new URLSearchParams({
    source,
    instruction,
    propose_spans: String(proposeSpans),
  });
  const res = await fetch(
    getApiUrl(`/admin/corpus/${encodeURIComponent(corpusId)}/sources/transcribe?${params}`),
    { method: "POST", body: form, headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) {
    const body = await res.text();
    try {
      const p = JSON.parse(body);
      throw new Error(p?.error?.message ?? p?.detail ?? body);
    } catch (e) {
      throw e instanceof Error && e.message !== body ? e : new Error(body);
    }
  }
  return res.json();
}

// ── which corpora exist ─────────────────────────────────────────────────────
//
// The panel offered a text box. A corpus whose id you have not memorised is a
// corpus you cannot open — which is how a freshly built one stays invisible to
// the person who built it.

export interface CorpusListing {
  corpus_id: string;
  name?: string;
  purpose?: string;
  template?: string;
  /** Predates the Corpus entity, so it has no name. Saying so beats showing a
   *  blank, which reads as a bug. */
  unnamed?: boolean;
  documents: number;
  readers: string[];
}

export async function fetchCorpora(): Promise<{ corpora: CorpusListing[] }> {
  return call("");
}

/** What a re-extraction would cost, before anyone starts. Pre-processing is
 *  content-addressed and shared, so a video processed under one corpus does
 *  not need transcribing again under another. */
export interface ReprocessPlan {
  sources: number;
  llm_only: number;
  needs_vision: number;
  needs_media: number;
  note: string;
}

export async function fetchReprocessPlan(corpusId: string): Promise<ReprocessPlan> {
  return call(`/${encodeURIComponent(corpusId)}/reprocess/plan`);
}

export async function syncArtifacts(corpusId: string, run: string) {
  return call(
    `/${encodeURIComponent(corpusId)}/artifacts/sync?run=${encodeURIComponent(run)}`,
    { method: "POST" },
  );
}

// ── creating a corpus (CUJ 1) ───────────────────────────────────────────────
//
// A corpus used to be created by typing an id into an import call: no name, no
// owner, and nowhere to record what it was FOR. Everything downstream — schema
// suggestion, retrieval contract, evaluation questions — needs that field.

export interface NewCorpusInput {
  name: string;
  purpose: string;
  corpus_id?: string;
  description?: string;
  audience?: string;
  typical_questions?: string[];
  template?: string;
}

export async function createCorpus(input: NewCorpusInput): Promise<{
  corpus: CorpusListing & { name: string; purpose: string; template: string };
  suggested_fields: { name: string; instruction: string }[];
}> {
  return call("", { method: "POST", body: JSON.stringify(input) });
}

export async function fetchTemplates(): Promise<{
  templates: { key: string; fields: string[] }[];
}> {
  return call("/templates");
}

/** Upload an asset and actually process it (CUJ 2).
 *
 *  Upload used to store nothing and start nothing — ingest was a command
 *  somebody ran. Footage already processed is REUSED rather than transcribed
 *  again, because a transcript is a property of the file, not of the corpus. */
export async function ingestAsset(
  corpusId: string,
  file: File,
  instruction = "",
): Promise<{
  file: string;
  reused_existing_transcript: boolean;
  segments: number;
  documents: number;
  duration_s?: number;
  note: string;
}> {
  const token = await auth.currentUser?.getIdToken();
  const form = new FormData();
  form.append("file", file);
  const params = new URLSearchParams({ instruction });
  const res = await fetch(
    getApiUrl(`/admin/corpus/${encodeURIComponent(corpusId)}/ingest?${params}`),
    { method: "POST", body: form, headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) {
    const body = await res.text();
    try {
      const p = JSON.parse(body);
      throw new Error(p?.error?.message ?? p?.detail ?? body);
    } catch (e) {
      throw e instanceof Error && e.message !== body ? e : new Error(body);
    }
  }
  return res.json();
}
