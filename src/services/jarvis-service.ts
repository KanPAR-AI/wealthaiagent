// services/jarvis-service.ts — "Ask Jarvis" admin assistant API client
// (chatservice api/v1/endpoints/assistant.py)

import { getApiUrl } from "@/config/environment";
import { auth } from "@/config/firebase";

/**
 * Turn an error body into something a person can read (bug e4fb9b32: the
 * panel showed "(Jarvis API error: 422)" and nothing else). FastAPI's
 * validation errors arrive as `detail: [{loc, msg, type}, …]`; application
 * errors as `detail: "text"`. Never a bare status code when the server said
 * more.
 */
export function formatJarvisError(body: unknown, status: number, statusText = ""): string {
  const b = (body ?? null) as { detail?: unknown; error?: { message?: unknown; details?: unknown } } | null;
  // chatservice app.py wraps validation failures as
  // {error: {code, message, details: [{loc, msg, type}]}} - no `detail` at all,
  // which is exactly the body behind the report's bare "422".
  const detail: unknown =
    b?.detail !== undefined ? b.detail
    : Array.isArray(b?.error?.details) && (b!.error!.details as unknown[]).length ? b!.error!.details
    : typeof b?.error?.message === "string" ? b!.error!.message
    : undefined;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length) {
    const parts = detail
      .map((d) => {
        if (!d || typeof d !== "object") return String(d);
        const { loc, msg } = d as { loc?: unknown[]; msg?: string };
        const where = Array.isArray(loc) ? loc.filter((p) => p !== "body").join(".") : "";
        return where ? `${where}: ${msg ?? "invalid"}` : msg ?? "invalid";
      })
      .filter(Boolean);
    if (parts.length) return `Jarvis rejected the request (${status}): ${parts.join("; ")}`;
  }
  if (detail && typeof detail === "object") {
    try { return `Jarvis API error ${status}: ${JSON.stringify(detail)}`; } catch { /* fall through */ }
  }
  return `Jarvis API error: ${status}${statusText ? ` ${statusText}` : ""}`;
}

async function jarvisFetch(endpoint: string, options: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(getApiUrl(`/admin${endpoint}`), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(formatJarvisError(body, res.status, res.statusText));
  }
  return res.json();
}

export interface JarvisContext {
  page?: string;
  section?: string;
  tab?: string;
  loop_id?: string | null;
  agent_id?: string | null;
  visible_problems?: string[];
}

export interface JarvisMessage {
  role: "user" | "assistant";
  content: string;
}

export interface JarvisAction {
  type: "clear_conversation" | "report_bug";
  draft?: string;
}

/**
 * The wire shape of a prior turn is role + content, nothing else. The panel
 * keeps richer objects (the actions a reply offered) and hands its list
 * straight back; sending those extra keys is what 422'd every follow-up turn
 * (bug e4fb9b32). The server now ignores extras too — belt and braces.
 */
export function toWireHistory(history: ReadonlyArray<JarvisMessage>): JarvisMessage[] {
  return history
    .filter((m) => m && typeof m.content === "string" && m.content.length > 0)
    .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
}

export const askJarvis = (
  question: string,
  context: JarvisContext = {},
  history: ReadonlyArray<JarvisMessage> = [],
): Promise<{ answer: string; actions?: JarvisAction[]; screen?: { section: string; tab: string; walkthrough: boolean } }> =>
  jarvisFetch(`/assistant`, {
    method: "POST",
    body: JSON.stringify({ question, context, history: toWireHistory(history) }),
  });

export const listKbAreas = (): Promise<{
  areas: { area: string; source: string; version?: number }[];
  cache_ttl_seconds: number;
}> => jarvisFetch(`/assistant/kb`);

export const refreshKb = (): Promise<{ cleared: number; note: string }> =>
  jarvisFetch(`/assistant/kb/refresh`, { method: "POST" });
