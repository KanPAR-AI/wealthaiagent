// Time formatting, once, for every Corpus Studio screen.
//
// Mirrors services/corpus/assets.py:format_time deliberately. Two
// implementations would drift, and two screens rounding differently is the
// difference nobody reports and everybody notices.

/** A position in a video: "00:21", "03:45". */
export function formatTime(seconds?: number | null): string {
  if (seconds === undefined || seconds === null || seconds < 0) return "—";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** A duration somebody is waiting through: "18m", "1h 42m".
 *  Not MM:SS — "102:00" answers the wrong question for a wait. */
export function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds < 0) return "—";
  const total = Math.round(seconds);
  if (total < 60) return `${total}s`;
  if (total < 3600) return `${Math.round(total / 60)}m`;
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** "2m ago", "1h ago" — the Recent Activity column. */
export function relativeTime(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, (Date.now() - then) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes) return "—";
  const mb = bytes / 1024 ** 2;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}
