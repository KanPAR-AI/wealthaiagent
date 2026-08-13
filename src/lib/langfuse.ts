// Deep-links from the product into the trajectory store (docs/40 VIEW-3).
//
// Debugging a chat should start from the chat, not from a search box: an
// admin looking at a conversation that went wrong is one click from the
// session that recorded it — every turn, every prompt, every tool result.
//
// The base URL is configurable and defaults to the tunnel convention
// (port 3001) because the Langfuse instance is deliberately not publicly
// reachable (VIEW-2, SEC-1). The project segment is configurable for the
// same honesty: a self-hosted Langfuse mints its own project id, so
// "chatservice" is a default, not a fact.
import { env } from "@/config/environment";

export const LANGFUSE_FALLBACK_BASE_URL = "http://localhost:3001";
export const LANGFUSE_FALLBACK_PROJECT = "chatservice";

export interface LangfuseLinkOptions {
  baseUrl?: string;
  project?: string;
}

function trimTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}

/** The Langfuse session URL for one chat, or null when there is no chat.
 *
 * Returns null rather than a half-built URL: a link to
 * `/sessions/undefined` looks like a working feature and lands on an empty
 * page, which is exactly the class of failure this whole initiative exists
 * to catch.
 */
export function langfuseSessionUrl(
  chatId: string | null | undefined,
  opts: LangfuseLinkOptions = {},
): string | null {
  const id = (chatId ?? "").trim();
  if (!id) return null;
  const base = trimTrailingSlashes(
    (opts.baseUrl ?? env.langfuseBaseUrl ?? "").trim() || LANGFUSE_FALLBACK_BASE_URL,
  );
  const project =
    (opts.project ?? env.langfuseProject ?? "").trim() || LANGFUSE_FALLBACK_PROJECT;
  return `${base}/project/${encodeURIComponent(project)}/sessions/${encodeURIComponent(id)}`;
}

/** The Langfuse trace URL for one turn (`request_id`), or null.
 *
 * A turn is a trace and a chat is a session (docs/40 §1), so both links are
 * worth having: the session answers "what did this conversation do", the
 * trace answers "what did THIS turn do".
 */
export function langfuseTraceUrl(
  requestId: string | null | undefined,
  opts: LangfuseLinkOptions = {},
): string | null {
  const id = (requestId ?? "").trim();
  if (!id) return null;
  const base = trimTrailingSlashes(
    (opts.baseUrl ?? env.langfuseBaseUrl ?? "").trim() || LANGFUSE_FALLBACK_BASE_URL,
  );
  const project =
    (opts.project ?? env.langfuseProject ?? "").trim() || LANGFUSE_FALLBACK_PROJECT;
  return `${base}/project/${encodeURIComponent(project)}/traces/${encodeURIComponent(id)}`;
}
