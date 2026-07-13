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
import { Check, Copy, ExternalLink, Loader2, RefreshCw, Wrench, X } from "lucide-react";

import { AdminHeader } from "@/components/admin/admin-header";
import { getApiUrl } from "@/config/environment";
import { useAuth } from "@/hooks/use-auth";
import { useCachedFile } from "@/hooks/use-cached-file";
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

/** Which agent a report belongs to. The frozen snapshot's last_agent_type
 *  is the reliable signal (context.selected_agent is often null on mobile);
 *  fall back to it. Used for the agent filter + batch grouping. */
function reportAgent(r: BugReport): string | null {
  return r.chat_snapshot?.last_agent_type || r.context?.selected_agent || null;
}

/** Build the codified batch-fix instruction for the selected reports.
 *  Phase 0 bridge: this text is what you hand to a Claude Code session
 *  (or, once Phase 2 lands, the background fixer) — it points at the
 *  SKILLS/fix-bug-report.md playbook and lists the bugs grouped by agent
 *  so related ones are fixed as one cluster. */
function buildFixInstruction(items: BugReport[]): string {
  const byAgent = new Map<string, BugReport[]>();
  for (const r of items) {
    const a = reportAgent(r) || "unknown";
    if (!byAgent.has(a)) byAgent.set(a, []);
    byAgent.get(a)!.push(r);
  }
  const blocks: string[] = [];
  for (const [agent, rs] of byAgent) {
    const lines = rs
      .map((r) => `- ${r.id} — ${r.description.replace(/\s+/g, " ").slice(0, 120)}`)
      .join("\n");
    blocks.push(`Agent: ${agent}\n${lines}`);
  }
  return (
    "Fix these bug reports as a batch, following SKILLS/fix-bug-report.md. " +
    "Cluster by root cause, write a failing repro test first, then fix, " +
    "test, open a PR, and post a root-cause note on each report.\n\n" +
    blocks.join("\n\n")
  );
}

export default function AdminBugReports() {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<BugReportStatus | "all">("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showFixPanel, setShowFixPanel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      // Pull a wide window so the client-side agent filter isn't starved.
      const opts = statusFilter === "all" ? { limit: 300 } : { status: statusFilter, limit: 300 };
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

  const selectedReport = useMemo(
    () => reports.find((r) => r.id === selectedId) || null,
    [reports, selectedId],
  );

  // Distinct agents present in the loaded reports → filter dropdown options.
  const availableAgents = useMemo(() => {
    const s = new Set<string>();
    reports.forEach((r) => {
      const a = reportAgent(r);
      if (a) s.add(a);
    });
    return Array.from(s).sort();
  }, [reports]);

  // Client-side agent filter (Phase 0 — server-side query lands in Phase 2).
  const visibleReports = useMemo(
    () => (agentFilter === "all" ? reports : reports.filter((r) => reportAgent(r) === agentFilter)),
    [reports, agentFilter],
  );

  // Reports backing the current multi-selection (may include some now hidden
  // by a filter change — the fix panel shows exactly what's checked).
  const selectedReports = useMemo(
    () => reports.filter((r) => selected.has(r.id)),
    [reports, selected],
  );

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allVisibleSelected =
    visibleReports.length > 0 && visibleReports.every((r) => selected.has(r.id));

  const toggleSelectAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleReports.forEach((r) => next.delete(r.id));
      else visibleReports.forEach((r) => next.add(r.id));
      return next;
    });

  // Clearing filters shouldn't leave phantom selections; reset on change.
  useEffect(() => {
    setSelected(new Set());
  }, [statusFilter, agentFilter]);

  const handlePatch = async (status: BugReportStatus, admin_notes?: string) => {
    if (!selectedReport) return;
    try {
      const updated = await updateBugStatus(selectedReport.id, {
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
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="all">All agents</option>
              {availableAgents.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
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
              {/* Batch action bar */}
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/30">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-foreground"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                  />
                  {selected.size > 0 ? `${selected.size} selected` : "Select"}
                </label>
                <Button
                  size="sm"
                  className="h-7"
                  disabled={selected.size === 0}
                  onClick={() => setShowFixPanel(true)}
                >
                  <Wrench className="h-3.5 w-3.5 mr-1" />
                  Fix selected{selected.size > 0 ? ` (${selected.size})` : ""}
                </Button>
              </div>

              {visibleReports.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4 text-center">
                  {loading ? "Loading…" : "No reports."}
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {visibleReports.map((r) => {
                    const isSel = r.id === selectedId;
                    const isChecked = selected.has(r.id);
                    const agent = reportAgent(r);
                    return (
                      <li key={r.id} className="flex items-stretch">
                        <label className="flex items-center pl-3 cursor-pointer">
                          <input
                            type="checkbox"
                            className="size-3.5 accent-foreground"
                            checked={isChecked}
                            onChange={() => toggleSelect(r.id)}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setSelectedId(r.id)}
                          className={`flex-1 min-w-0 text-left px-3 py-2.5 space-y-1 transition-colors ${
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
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-muted-foreground truncate">
                              {r.user_email || r.user_display_name || r.user_id.slice(0, 10) + "…"}
                            </span>
                            {agent && (
                              <span className="text-[10px] text-muted-foreground shrink-0 border border-border rounded px-1 py-0.5">
                                {agent}
                              </span>
                            )}
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
              {selectedReport ? (
                <DetailPanel report={selectedReport} onPatch={handlePatch} />
              ) : (
                <div className="text-sm text-muted-foreground p-8 text-center">
                  Select a report on the left.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showFixPanel && (
        <FixPanel reports={selectedReports} onClose={() => setShowFixPanel(false)} />
      )}
    </div>
  );
}

/** Batch-fix hand-off panel (Phase 0).
 *
 * With no background runner yet, the honest bridge is to emit the codified
 * instruction — grouped by agent so related bugs form one cluster — that a
 * human pastes into a Claude Code session running SKILLS/fix-bug-report.md.
 * Phase 2 replaces the copy button with a "Launch fixer" call that streams
 * an attachable session; the instruction it sends stays identical. */
function FixPanel({ reports, onClose }: { reports: BugReport[]; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const instruction = useMemo(() => buildFixInstruction(reports), [reports]);
  const agents = useMemo(
    () => Array.from(new Set(reports.map((r) => reportAgent(r) || "unknown"))),
    [reports],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(instruction);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed — select the text manually.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-lg border border-border bg-background p-5 shadow-xl">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold">Fix {reports.length} bug{reports.length === 1 ? "" : "s"} as a batch</h3>
            <p className="text-sm text-muted-foreground">
              {agents.length === 1
                ? `Agent: ${agents[0]} — related bugs fixed as one cluster.`
                : `Spans ${agents.length} agents — grouped into clusters below.`}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs p-2 mb-3">
          Phase 0: copy this into a Claude Code session. It follows
          <code className="mx-1">SKILLS/fix-bug-report.md</code>
          (repro-test-first → fix → test → PR → note). The background runner
          you can attach to arrives in Phase 2.
        </div>

        <pre className="whitespace-pre-wrap break-words text-xs bg-muted/50 rounded-md p-3 border border-border max-h-72 overflow-y-auto">
          {instruction}
        </pre>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button size="sm" onClick={copy}>
            {copied ? (
              <><Check className="h-3.5 w-3.5 mr-1" /> Copied</>
            ) : (
              <><Copy className="h-3.5 w-3.5 mr-1" /> Copy instruction</>
            )}
          </Button>
        </div>
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
      {report.screenshot_url && <BugScreenshot url={report.screenshot_url} />}

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

/** Screenshot preview with authentication.
 *
 * `screenshot_url` is a RELATIVE backend path (/api/v1/files/…/download):
 * a bare <img src> resolved it against the FRONTEND origin (Vite dev server
 * or the /chataiagent/ base in prod) and carried no Bearer token — broken
 * in both environments. Route through getApiUrl + useCachedFile (token
 * fetch → blob URL), the same seam every chat attachment uses.
 */
function BugScreenshot({ url }: { url: string }) {
  const { idToken } = useAuth();
  const absolute = url.startsWith("http")
    ? url
    : getApiUrl(url.replace(/^\/api\/v1/, ""));
  // Memoize on the URL string. useCachedFile keys its fetch effect on the
  // file object's identity, so a fresh literal every render re-fetches and
  // re-mints the blob URL each pass — that was the screenshot flicker.
  const file = useMemo(
    () => ({ name: "bug-screenshot", type: "image/jpeg", url: absolute, size: 0 }),
    [absolute],
  );
  const { blobUrl, error } = useCachedFile(file, idToken);
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
        Screenshot
      </div>
      {error ? (
        <div className="text-sm text-destructive">Screenshot failed to load.</div>
      ) : !blobUrl ? (
        <div className="h-24 flex items-center justify-center border border-border rounded-md bg-muted/40">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <a
          href={blobUrl}
          target="_blank"
          rel="noreferrer"
          className="block border border-border rounded-md overflow-hidden bg-muted/40"
        >
          <img src={blobUrl} alt="User screenshot" className="max-h-72 w-full object-contain" />
        </a>
      )}
    </div>
  );
}
