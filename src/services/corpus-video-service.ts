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
  /** FOUR successful shapes plus `nothing_publishable`, because "published"
   *  was true of a corpus nothing could reach AND of one that answers none of
   *  the questions its owner said it must. Optional in the type only because
   *  older payloads omit it — a caller must never default the absence to
   *  success. */
  status?:
    | "published"
    | "published_unreachable"
    | "published_unverified"
    | "published_failed_evaluation"
    | "nothing_publishable";
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
/** Who currently reads this corpus.
 *
 *  Read from the corpus VIEW rather than from the full listing: the listing
 *  counts documents by streaming every document of every corpus, which is fine
 *  for a page you open once and wasteful for a read-modify-write of one
 *  corpus's readers.
 */
export async function fetchCorpusReaders(corpusId: string): Promise<string[]> {
  const view = await fetchVideos(corpusId);
  return view.readers ?? [];
}

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
  /** The asset on screen, when asked from an asset page. Without it the
   *  assistant answers about the corpus in general, which is a confidently
   *  wrong answer to "why is there no phase HERE?". */
  source = "",
): Promise<AssistantTurn> {
  return call(`/${encodeURIComponent(corpusId)}/assistant`, {
    method: "POST",
    body: JSON.stringify({ question, history, source }),
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
  /** What is actually true of this corpus — see services/corpus/health.py.
   *  "ready_unpublished" is the state that was invisible: complete, eligible,
   *  and never published, which looks identical to finished. */
  state?: string;
  state_note?: string;
  needs_attention?: boolean;
  archived?: boolean;
  indexed?: number;
}

export interface CorpusCensus {
  ready_unpublished: number;
  published_unreachable: number;
  index_behind: number;
  archived: number;
  empty: number;
  working: number;
  needs_attention: number;
}

export async function archiveCorpus(
  corpusId: string,
  archived: boolean,
): Promise<{ corpus_id: string; archived: boolean }> {
  return call(`/${encodeURIComponent(corpusId)}/archive`, {
    method: "POST",
    body: JSON.stringify({ archived }),
  });
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

// ── the studio surfaces (docs/25) ───────────────────────────────────────────

export interface CorpusCard {
  corpus_id: string;
  name: string;
  purpose: string;
  template: string;
  status:
    | "published"
    | "processing"
    /** Labelled, eligible, and never published — finished work waiting on one
     *  click. Used to be reported as "processing" with a time estimate. */
    | "ready"
    | "archived"
    | "needs_review"
    | "unreachable"
    | "draft";
  sources: number;
  items: number;
  indexed: number;
  completion: number;
  issues: number;
  pending_publish: number;
  readers: string[];
  language: string;
  headline: string;
  eta_seconds: number | null;
}

export interface DashboardView {
  corpora: CorpusCard[];
  totals: { corpora: number; processing: number; needs_review: number; unreachable: number };
}

export async function fetchDashboard(): Promise<DashboardView> {
  return call("/dashboard");
}

export interface ActivityEvent {
  kind: string;
  title: string;
  detail: string;
  corpus_id: string;
  at: string;
}

export async function fetchActivity(limit = 12): Promise<{ events: ActivityEvent[] }> {
  return call(`/activity?limit=${limit}`);
}

export interface QueueRow {
  job_id: string;
  corpus_id: string;
  source: string;
  stage: string;
  percent: number;
  state: string;
  at: string | null;
}

export async function fetchProcessingQueue(): Promise<{
  queue: QueueRow[];
  active: number;
  recently_finished: number;
}> {
  return call("/processing/queue");
}

// ── one asset's whole detail screen ─────────────────────────────────────────

export interface AssetSegment {
  id: string;
  title: string;
  type: string;
  start_seconds: number | null;
  end_seconds: number | null;
  duration_seconds: number | null;
  confidence: number | null;
  span_source?: string;
  phase?: string | null;
  text: string;
}

export interface AssetDetail {
  corpus_id: string;
  source: string;
  info: {
    duration_s: number | null;
    resolution: string | null;
    fps: number | null;
    size_bytes: number | null;
    language: string;
    has_speech: boolean;
    audio: string;
    items: number;
    /** Every recovery phase this source carries — the corpus's main filter
     *  dimension. A LIST because a compilation can legitimately span two, and
     *  collapsing it to the first would misfile half the video. */
    phases: string[];
    content_sha: string;
  };
  pipeline: { step: number; key: string; label: string; state: string; detail: string }[];
  insight: string;
  segments: AssetSegment[];
  segment_types: string[];
  segments_by_type: Record<string, number>;
  transcript: {
    start_seconds: number;
    text: string;
    type: string;
    segment_id: string | null;
    speaker?: string | null;
  }[];
  on_screen_text: string[];
}

export async function fetchAssetDetail(
  corpusId: string,
  source: string,
  opts: { q?: string; lineType?: string } = {},
): Promise<AssetDetail> {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.lineType) params.set("line_type", opts.lineType);
  const qs = params.toString();
  return call(
    `/${encodeURIComponent(corpusId)}/assets/${encodeURIComponent(source)}${qs ? `?${qs}` : ""}`,
  );
}

export async function setSegmentType(corpusId: string, docId: string, type: string) {
  return call(
    `/${encodeURIComponent(corpusId)}/videos/${encodeURIComponent(docId)}/type`,
    { method: "PATCH", body: JSON.stringify({ segment_type: type }) },
  );
}

export async function addSegment(
  corpusId: string,
  source: string,
  segment: { title: string; segment_type: string; start_seconds: number; end_seconds: number },
) {
  return call(
    `/${encodeURIComponent(corpusId)}/assets/${encodeURIComponent(source)}/segments`,
    { method: "POST", body: JSON.stringify(segment) },
  );
}

// ── the footage itself (docs/25 screen 4) ───────────────────────────────────

export interface Filmstrip {
  /** One sprite sheet holding every thumbnail. The whole point: scrubbing is a
   *  background-position shift after ONE request, not a fetch per frame. */
  url: string;
  count: number;
  interval_s: number;
  columns: number;
  rows: number;
  tile_width: number;
  tile_height: number;
  sheet_width: number;
  sheet_height: number;
}

export interface AssetMedia {
  corpus_id: string;
  source: string;
  duration_s: number | null;
  stored: boolean;
  /** Why there is nothing to play. Present only when `stored` is false, and
   *  worth showing verbatim — "we did not keep it" is the normal state for
   *  anything ingested before the media store existed, and a screen that
   *  reports it as an error teaches people the screen is broken. */
  reason?: string;
  content_sha?: string;
  size_bytes?: number;
  content_type?: string;
  /** Expiring, signed, and names one asset. Not a user credential. */
  ticket?: string;
  expires_in_s?: number;
  source_url?: string;
  poster_url?: string;
  filmstrip?: Filmstrip | null;
}

export async function fetchAssetMedia(
  corpusId: string,
  source: string,
): Promise<AssetMedia> {
  return call(
    `/${encodeURIComponent(corpusId)}/assets/${encodeURIComponent(source)}/media`,
  );
}

/** Media URLs come back relative, because baking an absolute host into a
 *  descriptor is how a URL ends up pointing at localhost in production. */
export function mediaUrl(path: string): string {
  return getApiUrl(`/admin/corpus${path.replace(/^\/admin\/corpus/, "")}`);
}

// ── the create wizard (docs/25 screens 2-3) ─────────────────────────────────

export interface WizardStep {
  key: string;
  label: string;
  blurb: string;
}

export async function fetchWizardSteps(): Promise<{ steps: WizardStep[] }> {
  return call("/wizard/steps");
}

export interface InterviewOpening {
  step: number;
  of: number;
  greeting: string;
  question: string;
}

export async function startInterview(name = ""): Promise<InterviewOpening> {
  return call("/interview/start", { method: "POST", body: JSON.stringify({ name }) });
}

export interface InterviewArea {
  title: string;
  subtitle: string;
}

export interface InterviewTurn {
  step: number;
  of: number;
  acknowledgement: string;
  /** All four, every turn — the mockup shows them as collapsible rows somebody
   *  answers in any order or skips. An interview that blocks on question two
   *  is a form with extra steps. */
  follow_ups: { key: string; question: string; why: string }[];
  preview: {
    template: string;
    /** AREAS, not fields. Nothing has been uploaded yet, so the backend
     *  refuses to promise a schema the material may not support — see
     *  services/corpus/interview.py. The UI must not relabel these as fields,
     *  and must show the caveat. */
    areas: InterviewArea[];
    caveat: string;
  };
}

export async function interviewTurn(
  answer: string,
  history: string[] = [],
): Promise<InterviewTurn> {
  return call("/interview/turn", {
    method: "POST",
    body: JSON.stringify({ answer, history }),
  });
}

export async function completeInterview(input: {
  name: string;
  purpose: string;
  audience?: string;
  questions?: string;
  avoid?: string;
  focus?: string;
  template?: string;
}): Promise<{ corpus: { corpus_id: string; name: string }; next: string }> {
  return call("/interview/complete", { method: "POST", body: JSON.stringify(input) });
}

export interface SchemaSuggestion {
  corpus_id: string;
  /** `why` is the engine's justification for proposing the field, not evidence
   *  that the media contains it — the two read alike and mean opposite things,
   *  so the UI labels it as reasoning. */
  fields: { name: string; instruction: string; why?: string }[];
  /** The output that justifies the whole component: what the MEDIA cannot
   *  support. An engine that only proposes fields will happily propose
   *  `contraindication` over footage that never mentions one, and the corpus
   *  then extracts a column of nulls that reads as a processing failure.
   *
   *  `wanted` is what the PURPOSE asked for; `why_not` is what the media
   *  actually contains instead. Live, this caught a corpus whose purpose said
   *  elbow rehab and whose footage was entirely knee — which no field list
   *  would ever have surfaced. */
  unsupported: { wanted: string; why_not: string }[];
  note?: string;
}

export async function suggestSchema(corpusId: string): Promise<SchemaSuggestion> {
  return call(`/${encodeURIComponent(corpusId)}/schema/suggest`, { method: "POST" });
}

/** The formats and cap the BACKEND enforces, restated for the dropzone.
 *
 *  Kept in sync with `_check_upload` in corpus_videos.py by hand, which is a
 *  real risk — but a dropzone that accepts a file the server then refuses is
 *  worse than one that repeats itself, and the refusal text quotes these same
 *  words so a mismatch is visible rather than silent. */
export const ACCEPTED_UPLOAD =
  ".mp4,.mov,.avi,.mkv,.webm,.mp3,.m4a,.wav,.aac,.flac,.pdf";
export const MAX_UPLOAD_BYTES = 10 * 1024 ** 3;

/** Ingest with REAL upload progress.
 *
 *  fetch() cannot report how much of a request body has been sent, so a
 *  progress bar built on it is a lie — it sits at 0 and jumps to 100. XHR
 *  reports it, which matters here because these files run to 400 MB and the
 *  difference between "stuck" and "62% of a big file" is the difference
 *  between waiting and reloading the page.
 *
 *  What it CANNOT report is the server's work afterwards. Ingest transcribes
 *  before it answers, so upload completing means processing STARTS, not that
 *  it finished — hence the separate `processing` phase rather than a bar that
 *  parks at 100% and pretends. */
export async function ingestAssetWithProgress(
  corpusId: string,
  file: File,
  opts: { instruction?: string; onProgress?: (fraction: number) => void } = {},
): Promise<{ file: string; reused_existing_transcript: boolean; segments: number; documents: number; note: string }> {
  const token = await auth.currentUser?.getIdToken();
  const params = new URLSearchParams({ instruction: opts.instruction ?? "" });
  const url = getApiUrl(
    `/admin/corpus/${encodeURIComponent(corpusId)}/ingest?${params}`,
  );

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error(xhr.responseText || `HTTP ${xhr.status}`));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(parsed as never);
        return;
      }
      const p = parsed as { error?: { message?: string }; detail?: string };
      reject(new Error(p?.error?.message ?? p?.detail ?? `HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("The upload failed to reach the server."));
    xhr.ontimeout = () => reject(new Error("The upload timed out."));
    // Ingest transcribes before answering; a 400 MB file legitimately takes
    // minutes. The browser default would abort a healthy request.
    xhr.timeout = 30 * 60 * 1000;
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

// ── AI Extract, per asset (docs/25 screen 4) ────────────────────────────────

/** Three states, and the difference between the last two is the point.
 *
 *  `suggested` — a model proposed it and nobody has looked. NOT the value.
 *  `missing`   — nothing proposed anything.
 *
 *  "The model found nothing" and "the model proposed something unchecked" are
 *  opposite problems; a UI rendering both as blank hides which one you have. */
export type ValueState = "human" | "suggested" | "missing";

export interface ExtractedValue {
  value: unknown;
  state: ValueState;
  by: string;
  at: string;
}

export interface HumanLabel {
  corpus_id: string;
  field: string;
  value: string;
  by: string;
  at: string;
}

export interface LabelReview {
  proposed: string | null;
  /** The name merely restates the phase — which already has its own field. */
  is_phase_card: boolean;
  human_labels: HumanLabel[];
  conflicts: HumanLabel[];
  /** A person should look before accepting. NOT a refusal — the human label
   *  can be the wrong one, and the point is to show both. */
  needs_review: boolean;
  notes: string[];
}

export interface ExtractItem {
  doc_id: string;
  title: string;
  start_seconds: number | null;
  values: Record<string, ExtractedValue>;
  label_review?: LabelReview;
  evidence: {
    transcript_chars: number;
    transcript_excerpt: string;
    on_screen_text: string[];
    has_evidence: boolean;
    /** Where a value could have come from — a field read from six words of
     *  on-screen text deserves different scepticism from one read from a
     *  12-minute narration, and nothing else on screen says which. */
    note: string;
  };
}

export interface AssetExtract {
  corpus_id: string;
  source: string;
  /** `in_schema: false` means the column came from a one-off run and will
   *  vanish from other corpora when the real schema is re-run. */
  fields: { name: string; instruction: string; in_schema: boolean }[];
  instruction: string;
  items: ExtractItem[];
  coverage: Record<string, Record<ValueState, number>>;
  pending_review: number;
  headline: string;
  /** What a person has already called this footage in another corpus. Footage
   *  is shared and names are per-corpus, so without this a naming pass cannot
   *  see a label somebody set elsewhere — which is how "PHASE 1 EXERCISES"
   *  came to overwrite nothing and coexist with "tailgate swings". */
  human_labels_elsewhere: HumanLabel[];
  runs: { run: string; at: string; instruction?: string; model?: string }[];
}

export async function fetchAssetExtract(
  corpusId: string,
  source: string,
): Promise<AssetExtract> {
  return call(
    `/${encodeURIComponent(corpusId)}/assets/${encodeURIComponent(source)}/extract`,
  );
}

export async function runAssetExtract(
  corpusId: string,
  source: string,
  body: {
    instruction?: string;
    fields?: { name: string; instruction: string }[];
    run?: string;
  } = {},
): Promise<{
  items_read: number;
  items_without_evidence: number;
  values_proposed: number;
  failed: number;
  run: string;
  note: string;
}> {
  return call(
    `/${encodeURIComponent(corpusId)}/assets/${encodeURIComponent(source)}/extract`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

/** Accept a proposal, or override it. Passing `value` overrides — and that must
 *  not be harder than agreeing, or reviewers stop disagreeing. */
export async function acceptExtractedValue(
  corpusId: string,
  source: string,
  body: { doc_id: string; field: string; value?: unknown },
): Promise<{ field: string; value: unknown; note: string }> {
  return call(
    `/${encodeURIComponent(corpusId)}/assets/${encodeURIComponent(source)}/extract/accept`,
    { method: "POST", body: JSON.stringify(body) },
  );
}
