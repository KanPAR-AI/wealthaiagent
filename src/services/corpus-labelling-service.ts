// Delegated labelling: hand a batch of corpus documents to a person, with a
// written spec of what a correct label is.
//
// Document ids contain spaces and parentheses ("El_Paso_Manual_Physical_Therapy
// (23)::unnamed"), so every id goes through encodeURIComponent. Skipping that
// once already produced a "404" that was really a malformed path.

import { getApiUrl } from "@/config/environment";
import { auth } from "@/config/firebase";

async function apiRequest(path: string, init?: RequestInit) {
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

const BASE = "";

export interface SpecField {
  name: string;
  instruction: string;
  options: string[];
  required: boolean;
}

export interface Assignment {
  assignment_id: string;
  corpus_id: string;
  title: string;
  assignee: string;
  doc_ids: string[];
  spec: SpecField[];
  note: string;
  created_by: string;
  created_at: string;
  progress?: Progress;
}

export interface Progress {
  total: number;
  found: number;
  done: number;
  remaining: number;
  state: "open" | "done";
}

export interface FieldView {
  value: string | null;
  source: string | null;
  suggestion: string | null;
  instruction: string;
  options: string[];
  required: boolean;
}

export interface WorksheetDoc {
  id: string;
  title: string | null;
  video_file: string | null;
  fields: Record<string, FieldView>;
}

export interface Worksheet {
  assignment: Assignment;
  progress: Progress;
  documents: WorksheetDoc[];
}

export interface PrefillResult {
  suggested: number;
  declined: number;
  failed: number;
  considered: number;
  note: string;
}

const enc = encodeURIComponent;

export async function listAssignments(corpusId: string): Promise<{ assignments: Assignment[] }> {
  return apiRequest(`${BASE}/${enc(corpusId)}/assignments`);
}

export async function createAssignment(
  corpusId: string,
  body: { title: string; assignee: string; doc_ids: string[]; spec: Omit<SpecField, "options" | "required">[] & SpecField[]; note: string },
): Promise<{ assignment: Assignment }> {
  return apiRequest(`${BASE}/${enc(corpusId)}/assignments`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getWorksheet(corpusId: string, assignmentId: string): Promise<Worksheet> {
  return apiRequest(`${BASE}/${enc(corpusId)}/assignments/${enc(assignmentId)}`);
}

export async function labelDocument(
  corpusId: string,
  assignmentId: string,
  docId: string,
  field: string,
  value: string,
): Promise<unknown> {
  return apiRequest(
    `${BASE}/${enc(corpusId)}/assignments/${enc(assignmentId)}/documents/${enc(docId)}`,
    { method: "PATCH", body: JSON.stringify({ field, value }) },
  );
}

export async function prefill(
  corpusId: string,
  assignmentId: string,
  model = "",
): Promise<PrefillResult> {
  const q = model ? `?model=${enc(model)}` : "";
  return apiRequest(
    `${BASE}/${enc(corpusId)}/assignments/${enc(assignmentId)}/prefill${q}`,
    { method: "POST" },
  );
}
