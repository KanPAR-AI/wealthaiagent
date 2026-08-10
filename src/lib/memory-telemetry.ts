// lib/memory-telemetry.ts — Memory OS UI telemetry (§59).
//
// Thin wrapper over the existing GA4 `track()` (lib/analytics.ts) so every
// Memory OS UI event name is a typed constant instead of a free string
// scattered across components. HARD RULE (§59, security-boundaries skill):
// never log sensitive values — memory text/value/evidence excerpts must
// never appear in `props`. Only ids, enums (status/source/type), counts,
// and booleans are safe.
import { track } from "@/lib/analytics";

export const MEMORY_TELEMETRY_EVENTS = {
  VIEW_OPENED: "memory_view_opened",
  INSPECTED: "memory_inspected",
  EVIDENCE_OPENED: "memory_evidence_opened",
  HISTORY_OPENED: "memory_history_opened",
  USAGE_OPENED: "memory_usage_opened",
  CORRECT_STARTED: "memory_correct_started",
  CORRECT_COMPLETED: "memory_correct_completed",
  FORGET_STARTED: "memory_forget_started",
  FORGET_COMPLETED: "memory_forget_completed",
  ADDED: "memory_added",
  INBOX_APPROVED: "memory_inbox_approved",
  INBOX_REJECTED: "memory_inbox_rejected",
  GRAPH_OPENED: "memory_graph_opened",
  DEBUG_QUERY_RUN: "memory_debug_query_run",
  RUN_MEMORY_INSPECTED: "run_memory_inspected",
} as const;

export type MemoryTelemetryEvent =
  (typeof MEMORY_TELEMETRY_EVENTS)[keyof typeof MEMORY_TELEMETRY_EVENTS];

/** Safe, non-sensitive event properties only — ids/enums/counts/booleans. */
export type MemoryTelemetryProps = Record<string, string | number | boolean | null | undefined>;

export function trackMemoryEvent(event: MemoryTelemetryEvent, props?: MemoryTelemetryProps): void {
  track(event, props);
}
