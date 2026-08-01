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
}

export interface CorpusVideoView {
  corpus_id: string;
  summary: Record<string, number>;
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
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

export async function fetchVideos(
  corpusId: string,
  state?: VideoState,
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
