// src/pages/AdminBugReports.tsx
//
// Admin bug-report triage page — /admin/bugs.
//
// Left: paginated list of reports, newest first, colored by status.
// Right: detail panel — description, screenshot, environment context,
//        FROZEN chat snapshot (last 30 messages at report time), and
//        controls to mark the report in_progress / resolved / wont_fix
//        with an admin note.
//
// The chat snapshot is the point of the feature. Even if the user has
// since deleted the chat or the agent's system prompt has moved on, the
// snapshot preserves exactly what they saw when they hit "Report an
// issue" — that's the only reliable way to reproduce.

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";

import { AdminHeader } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  BugReport,
  BugReportStatus,
  listBugReports,
  updateBugStatus,
} from "@/services/bug-report-service";

const STATUS_STYLES: Record<BugReportStatus, string> = {
  new: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  in_progress: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  resolved: "bg-green-500/10 text-green-500 border-green-500/30",
  wont_fix: "bg-zinc-500/10 text-zinc-500 border-zinc-500/30",
};

const STATUS_LABEL: Record<BugReportStatus, string> = {
  new: "New",
  in_progress: "In progress",
  resolved: "Resolved",
  wont_fix: "Won't fix",
};

function formatRelative(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function AdminBugReports() {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<BugReportStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const opts = statusFilter === "all" ? {} : { status: statusFilter };
      const { reports } = await listBugReports(opts);
      setReports(reports);
      // Preserve selection if the report is still in the filtered list
      if (selectedId && !reports.find((r) => r.id === selectedId)) {
        setSelectedId(reports[0]?.id || null);
      } else if (!selectedId) {
        setSelectedId(reports[0]?.id || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const selected = useMemo(
    () => reports.find((r) => r.id === selectedId) || null,
    [reports, selectedId],
  );

  const handlePatch = async (status: BugReportStatus, admin_notes?: string) => {
    if (!selected) return;
    try {
      const updated = await updateBugStatus(selected.id, {
        status,
        admin_notes,
      });
      setReports((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
      toast.success(`Marked ${STATUS_LABEL[status].toLowerCase()}`);
    } catch (err) {
      toast.error("Update failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Bug reports</h2>
            <p className="text-sm text-muted-foreground">
              What users are seeing when things go wrong. Description, screenshot, and a
              frozen chat snapshot per report.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as BugReportStatus | "all")}
              className="h-8 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="new">New only</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
              <option value="wont_fix">Won't fix</option>
            </select>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded border border-destructive/30 bg-destructive/10 text-destructive text-sm p-3">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
            {/* List */}
            <div className="border border-border rounded-md overflow-hidden">
              {reports.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4 text-center">
                  {loading ? "Loading…" : "No reports."}
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {reports.map((r) => {
                    const isSel = r.id === selectedId;
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(r.id)}
                          className={`w-full text-left px-3 py-2.5 space-y-1 transition-colors ${
                            isSel ? "bg-accent" : "hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`inline-block text-[10px] font-medium uppercase tracking-wider border rounded-full px-1.5 py-0.5 ${
                                STATUS_STYLES[r.status]
                              }`}
                            >
                              {STATUS_LABEL[r.status]}
                            </span>
                            <span className="text-[11px] text-muted-foreground shrink-0">
                              {formatRelative(r.created_at)}
                            </span>
                          </div>
                          <div className="text-sm line-clamp-2">{r.description}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {r.user_email || r.user_display_name || r.user_id.slice(0, 10) + "…"}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Detail */}
            <div className="border border-border rounded-md min-h-[60vh]">
              {selected ? (
                <DetailPanel report={selected} onPatch={handlePatch} />
              ) : (
                <div className="text-sm text-muted-foreground p-8 text-center">
                  Select a report on the left.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailPanel({
  report,
  onPatch,
}: {
  report: BugReport;
  onPatch: (status: BugReportStatus, admin_notes?: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState(report.admin_notes || "");

  // Reset notes when the selected report changes.
  useEffect(() => {
    setNotes(report.admin_notes || "");
  }, [report.id, report.admin_notes]);

  return (
    <div className="p-4 space-y-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-block text-[10px] font-medium uppercase tracking-wider border rounded-full px-1.5 py-0.5 ${
                STATUS_STYLES[report.status]
              }`}
            >
              {STATUS_LABEL[report.status]}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(report.created_at).toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs">
              {report.user_email || report.user_display_name || `uid ${report.user_id.slice(0, 10)}…`}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            ID: <code>{report.id}</code>
          </div>
        </div>
        {report.chat_id && (
          // Raw anchor (not react-router Link) + target="_blank" so:
          //   1. The href reads the CURRENT report.chat_id every render — no
          //      chance a memoized Link retains an older `to` prop across
          //      report switches.
          //   2. Opens in a new tab, so admins keep their triage queue on
          //      /admin/bugs instead of navigating away and losing the list.
          // The `/chataiagent` prefix must be included explicitly because
          // React Router's basename prepend only applies to <Link>, not raw
          // <a href>.
          <a
            key={report.id}
            href={`/chataiagent/chat/${report.chat_id}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            title={`Open chat ${report.chat_id.slice(0, 8)}… in a new tab`}
          >
            Open chat
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Description */}
      <div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
          Description
        </div>
        <div className="whitespace-pre-wrap text-sm">{report.description}</div>
      </div>

      {/* Screenshot */}
      {report.screenshot_url && (
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Screenshot
          </div>
          <a
            href={report.screenshot_url}
            target="_blank"
            rel="noreferrer"
            className="block border border-border rounded-md overflow-hidden bg-muted/40"
          >
            <img
              src={report.screenshot_url}
              alt="User screenshot"
              className="max-h-72 w-full object-contain"
            />
          </a>
        </div>
      )}

      {/* Environment */}
      {report.context && (
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Environment
          </div>
          <dl className="text-xs grid grid-cols-[100px_1fr] gap-y-1 gap-x-2">
            {report.context.user_agent && (
              <>
                <dt className="text-muted-foreground">UA</dt>
                <dd className="break-words">{report.context.user_agent}</dd>
              </>
            )}
            {report.context.url && (
              <>
                <dt className="text-muted-foreground">URL</dt>
                <dd className="break-all">{report.context.url}</dd>
              </>
            )}
            {report.context.viewport && (
              <>
                <dt className="text-muted-foreground">Viewport</dt>
                <dd>{report.context.viewport}</dd>
              </>
            )}
            {report.context.selected_agent && (
              <>
                <dt className="text-muted-foreground">Agent</dt>
                <dd>{report.context.selected_agent}</dd>
              </>
            )}
            {report.context.build_sha && (
              <>
                <dt className="text-muted-foreground">Build</dt>
                <dd>{report.context.build_sha}</dd>
              </>
            )}
          </dl>
        </div>
      )}

      {/* Chat snapshot */}
      {report.chat_snapshot && (
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Chat snapshot — frozen at report time
          </div>
          <div className="text-xs text-muted-foreground mb-2">
            {report.chat_snapshot.chat_title || "Untitled chat"} · agent:{" "}
            {report.chat_snapshot.last_agent_type || "?"} ·{" "}
            {report.chat_snapshot.messages.length} messages
          </div>
          <div className="border border-border rounded-md divide-y divide-border max-h-96 overflow-y-auto">
            {report.chat_snapshot.messages.map((m) => (
              <div key={m.id} className="p-2 text-sm">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                  {m.sender}
                </div>
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
                {m.attachments && m.attachments.length > 0 && (
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {m.attachments.length} attachment(s)
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin notes + status controls */}
      <div className="border-t border-border pt-4 space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Admin note (visible to admins only)
        </div>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What did you find? What was the fix?"
          rows={3}
          className="resize-none text-sm"
        />
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPatch("in_progress", notes || undefined)}
            disabled={report.status === "in_progress"}
          >
            Mark in progress
          </Button>
          <Button
            size="sm"
            onClick={() => onPatch("resolved", notes || undefined)}
            disabled={report.status === "resolved"}
          >
            Mark resolved
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onPatch("wont_fix", notes || undefined)}
            disabled={report.status === "wont_fix"}
          >
            Won't fix
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onPatch("new", notes || undefined)}
            disabled={report.status === "new"}
          >
            Reopen
          </Button>
        </div>
      </div>
    </div>
  );
}
