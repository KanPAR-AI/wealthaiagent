// Verified Procedures ("Loops") admin UI — docs/16 P6 (first cut).
//
// One surface for the whole lifecycle the user can test visually:
//   compile (prose SOP → spec) → review checks → activate → run (dry-run) →
//   approve gates as they park → see the VERDICT with per-check evidence →
//   eval suite scorecard (pass^k gate).

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2, ChevronLeft, Circle, History, Loader2, Pencil, Play, Plus, RefreshCw,
  RotateCcw, Save, ShieldCheck, ThumbsDown, ThumbsUp, Trash2, X, XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  EditReview, EvalCase, LoopSummary, LoopVersion, LoopsOverview, RegressionReport,
  RunSummary,
  addCase, addRunToSuite, approveRun, compareEvalRuns, compileSop, createLoop,
  createSuite, deleteCase, deleteIntegration, deleteLoop, getEvalRun, getLoop,
  getOverview, getRun, getSuite, listEvalRuns, listIntegrations, listLoops,
  listRuns, listSuites, listVersions, rejectRun, restoreVersion, resumeEvalRun,
  reviewEdit, runCandidateSuite, runSuite, setIntegration, setLoopStatus,
  startRun, streamRun, updateCase, updateLoopSpec, updateSuiteSettings,
} from "@/services/loops-service";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-amber-500/15 text-amber-600",
  active: "bg-emerald-500/15 text-emerald-600",
  archived: "bg-zinc-500/15 text-zinc-500",
  running: "bg-blue-500/15 text-blue-600",
  verifying: "bg-purple-500/15 text-purple-600",
  awaiting_approval: "bg-amber-500/15 text-amber-600",
  completed: "bg-emerald-500/15 text-emerald-600",
  failed: "bg-red-500/15 text-red-600",
  cancelled: "bg-zinc-500/15 text-zinc-500",
};

function Badge({ text }: { text: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${STATUS_COLORS[text] || "bg-zinc-500/15"}`}>
      {text}
    </span>
  );
}

function VerdictBadge({ verdict }: { verdict?: string | null }) {
  if (!verdict) return null;
  const style =
    verdict === "passed" ? "bg-emerald-500/15 text-emerald-600"
    : verdict === "failed" ? "bg-red-500/15 text-red-600"
    : "bg-amber-500/15 text-amber-600";
  return (
    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${style}`}>
      {verdict === "passed" ? "✓ verdict: passed" : verdict === "failed" ? "✗ verdict: failed" : `verdict: ${verdict}`}
    </span>
  );
}

export function LoopsView() {
  const [loops, setLoops] = useState<LoopSummary[]>([]);
  const [overview, setOverview] = useState<LoopsOverview | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCompile, setShowCompile] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);

  const refresh = useCallback(() => {
    listLoops().then((d) => setLoops(d.loops)).catch((e) => setError(e.message));
    getOverview().then(setOverview).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  if (selected) {
    return <LoopDetailView loopId={selected} onBack={() => { setSelected(null); refresh(); }} />;
  }

  const ovByLoop = Object.fromEntries((overview?.loops || []).map((l) => [l.loop_id, l]));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Verified Procedures</h2>
          <p className="text-sm text-muted-foreground">
            Describe a procedure in plain English; it compiles into a checked, budgeted loop.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowIntegrations((s) => !s)}>
            Integrations
          </Button>
          <Button variant="outline" size="sm" onClick={refresh}><RefreshCw size={14} /></Button>
          <Button size="sm" onClick={() => setShowCompile(true)}>
            <Plus size={14} className="mr-1" /> New from SOP
          </Button>
        </div>
      </div>

      {/* Operational overview: activity, the approval inbox, metered spend. */}
      {overview && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="border border-border rounded-lg p-3">
            <p className="text-2xl font-bold">{overview.totals.active_runs}</p>
            <p className="text-xs text-muted-foreground">runs in flight</p>
          </div>
          <div className={`border rounded-lg p-3 ${overview.totals.awaiting_approval > 0
            ? "border-amber-500/50 bg-amber-500/10" : "border-border"}`}>
            <p className="text-2xl font-bold">{overview.totals.awaiting_approval}</p>
            <p className="text-xs text-muted-foreground">waiting on YOUR approval</p>
          </div>
          <div className="border border-border rounded-lg p-3">
            <p className="text-2xl font-bold">${overview.totals.recent_cost_usd.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">recent spend (last 50 runs/loop)</p>
          </div>
        </div>
      )}

      {showIntegrations && <IntegrationsPanel onClose={() => setShowIntegrations(false)} />}

      {error && <p className="text-sm text-destructive mb-3">{error}</p>}

      {showCompile && (
        <CompilePanel
          onDone={(loopId) => { setShowCompile(false); refresh(); if (loopId) setSelected(loopId); }}
        />
      )}

      <div className="border border-border rounded-lg divide-y divide-border">
        {loops.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground text-center">
            No loops yet — click “New from SOP” and describe a procedure.
          </p>
        )}
        {loops.map((l) => {
          const ov = ovByLoop[l.loop_id];
          return (
            <button
              key={l.loop_id}
              onClick={() => setSelected(l.loop_id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 text-left"
            >
              <ShieldCheck size={16} className="text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{l.name}</div>
                <div className="text-xs text-muted-foreground">
                  {l.loop_id} · v{l.version} · trigger: {l.trigger}
                  {ov ? <> · ${ov.recent_cost_usd.toFixed(3)}</> : null}
                </div>
              </div>
              {ov && ov.awaiting_approval.length > 0 && (
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/15 text-amber-600">
                  🔔 {ov.awaiting_approval.length} to approve
                </span>
              )}
              {ov && ov.active_runs > 0 && (
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/15 text-blue-600">
                  {ov.active_runs} running
                </span>
              )}
              <Badge text={l.status} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Compile from prose ─────────────────────────────────────────────────

function CompilePanel({ onDone }: { onDone: (loopId?: string) => void }) {
  const [sop, setSop] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Compile AND persist as a draft in one step. Previously "Compile" only
  // produced an in-memory preview and a reload before the separate "Save"
  // click lost the whole spec. Persisting immediately means a compiled
  // procedure always survives reload (it's a draft — reviewable + deletable).
  const compileAndSave = async () => {
    setBusy(true); setErr(null);
    try {
      const result = await compileSop(sop);
      const loopId = result.spec.loop_id;
      try {
        await createLoop(result.spec);
      } catch (e: any) {
        // Recompiling the same SOP yields the same loop_id → 409; just open it.
        if (!String(e?.message || "").toLowerCase().includes("already exists")) throw e;
      }
      // Seed the eval suite from the compiler's spec-derived cases.
      if (result.eval_cases?.length) {
        await createSuite(loopId, result.eval_cases, 2, 0.8).catch(() => {});
      }
      onDone(loopId);   // navigates to the (persisted) detail view
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  return (
    <div className="border border-border rounded-lg p-4 mb-4 bg-muted/30">
      <p className="text-sm font-medium mb-2">Describe the procedure — include what “done” means:</p>
      <textarea
        value={sop}
        onChange={(e) => setSop(e.target.value)}
        rows={4}
        placeholder='e.g. "Every Friday, list clients with unpaid invoices over 30 days. Draft polite reminders. Show me for approval, then email them. Done when every such client has been emailed. Slack me a summary."'
        className="w-full rounded-md border border-border bg-background p-3 text-sm"
      />
      <div className="flex gap-2 mt-2">
        <Button size="sm" onClick={compileAndSave} disabled={sop.trim().length < 20 || busy}>
          {busy ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
          {busy ? "Compiling & saving (≈1 min)…" : "Compile & save draft"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDone()} disabled={busy}>Cancel</Button>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">
        Saved as a draft the moment it compiles — it won’t vanish on reload. Review, edit, then Activate (or delete) from the detail view.
      </p>
      {err && <p className="text-sm text-destructive mt-2">{err}</p>}
    </div>
  );
}

// ── Integrations: tool → webhook mapping ───────────────────────────────
//
// "A clear way to write integrations" without waiting for first-class
// connectors: map a tool id to a Zapier Catch Hook / Make webhook / your own
// HTTP endpoint. On a LIVE run, the step's params are POSTed as JSON and the
// hook's JSON response becomes the step's result. Dry-run still sends nothing.

function IntegrationsPanel({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<Record<string, { url: string; has_secret: boolean }>>({});
  const [tool, setTool] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    listIntegrations().then((d) => setRows(d.integrations)).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await setIntegration(tool.trim(), url.trim(), secret.trim());
      setTool(""); setUrl(""); setSecret(""); load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const remove = async (t: string) => {
    if (!confirm(`Remove the integration for '${t}'? Live runs using it will fail loudly.`)) return;
    setBusy(true);
    try { await deleteIntegration(t); load(); } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="border border-border rounded-lg p-4 mb-4 bg-muted/30">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-semibold">Tool integrations</h3>
        <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs" onClick={onClose}>Close</Button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Map a tool id (e.g. <span className="font-mono">whatsapp_send_message</span>) to a webhook —
        a Zapier Catch Hook, a Make webhook, or your own endpoint. Live runs POST the step&apos;s
        params as JSON; the hook&apos;s JSON response becomes the step&apos;s output. Dry runs never send.
      </p>

      {Object.keys(rows).length > 0 && (
        <div className="space-y-1.5 mb-3">
          {Object.entries(rows).map(([t, v]) => (
            <div key={t} className="flex items-center gap-2 text-sm border border-border rounded-md px-2.5 py-1.5 bg-background">
              <span className="font-mono text-xs shrink-0">{t}</span>
              <span className="flex-1 min-w-0 truncate text-xs text-muted-foreground">{v.url}</span>
              {v.has_secret && <span className="text-[10px] text-muted-foreground shrink-0">🔒 secret</span>}
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive shrink-0"
                      disabled={busy} onClick={() => remove(t)}>
                <Trash2 size={12} />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input value={tool} onChange={(e) => setTool(e.target.value)} placeholder="tool id (whatsapp_send_message)"
               className="rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono w-64" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.zapier.com/…"
               className="flex-1 min-w-48 rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
        <input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="secret (optional)"
               className="rounded-md border border-border bg-background px-2 py-1.5 text-sm w-40" />
        <Button size="sm" disabled={busy || tool.trim().length < 2 || !url.startsWith("http")} onClick={save}>
          <Save size={14} className="mr-1" /> Save
        </Button>
      </div>
      {err && <p className="text-sm text-destructive mt-2">{err}</p>}
    </div>
  );
}

function SpecSummary({ spec }: { spec: any }) {
  return (
    <div className="text-xs space-y-2">
      <div>
        <span className="uppercase tracking-wide text-muted-foreground">Steps</span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {spec.steps.map((s: any) => (
            <span key={s.id} className="px-2 py-1 rounded bg-background border border-border font-mono">
              {s.id} <span className="text-muted-foreground">({s.kind}{s.guard ? " 🔒" : ""})</span>
            </span>
          ))}
        </div>
      </div>
      <div>
        <span className="uppercase tracking-wide text-muted-foreground">Done means</span>
        <ul className="mt-1 space-y-1">
          {spec.exit.checks.map((c: any, i: number) => (
            <li key={i} className="flex gap-2 items-baseline">
              <span className="px-1.5 rounded bg-background border border-border text-[10px]">{c.kind}</span>
              <span>{c.label || c.rubric || c.prompt || `${c.field} ${c.op} ${c.value}`}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="text-muted-foreground">
        Budgets: ≤{spec.budgets.max_iterations} steps · ≤${spec.budgets.max_cost_usd}
      </div>
    </div>
  );
}

// ── Detail: spec + runs + evals ────────────────────────────────────────

function LoopDetailView({ loopId, onBack }: { loopId: string; onBack: () => void }) {
  const [detail, setDetail] = useState<any>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [watching, setWatching] = useState(false);

  const refresh = useCallback(() => {
    getLoop(loopId).then(setDetail).catch((e) => setErr(e.message));
    listRuns(loopId).then((d) => setRuns(d.runs)).catch(() => {});
  }, [loopId]);
  useEffect(() => { refresh(); }, [refresh]);

  // Live-ish updates while anything is in flight.
  useEffect(() => {
    const t = setInterval(() => {
      if (runs.some((r) => ["running", "verifying", "awaiting_approval"].includes(r.status))) refresh();
    }, 4000);
    return () => clearInterval(t);
  }, [runs, refresh]);

  if (!detail) return <p className="text-sm text-muted-foreground">{err || "Loading…"}</p>;
  const loop = detail.loop;

  const act = async (fn: () => Promise<any>) => {
    setBusy(true); setErr(null);
    try { await fn(); refresh(); } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground" onClick={onBack}>
        <ChevronLeft size={14} className="mr-1" /> All procedures
      </Button>

      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-xl font-bold">{loop.name}</h2>
        <Badge text={loop.status} />
        <span className="text-xs text-muted-foreground">v{loop.version}</span>
        <div className="ml-auto flex gap-2">
          {loop.status === "draft" && (
            <Button size="sm" disabled={busy || detail.problems.length > 0}
                    onClick={() => act(() => setLoopStatus(loopId, "active"))}>
              <CheckCircle2 size={14} className="mr-1" /> Activate
            </Button>
          )}
          {loop.status === "active" && (
            <Button size="sm" variant="outline" disabled={busy}
                    onClick={() => act(() => setLoopStatus(loopId, "draft"))}>
              Deactivate
            </Button>
          )}
          <Button size="sm" disabled={busy || watching}
                  onClick={() => setWatching(true)}>
            <Play size={14} className="mr-1" /> Run &amp; watch
          </Button>
          <Button size="sm" variant="outline" disabled={busy}
                  onClick={() => act(() => startRun(loopId, true))}>
            Dry run (background)
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" disabled={busy}
                  onClick={() => { if (confirm("Delete this procedure?")) act(async () => { await deleteLoop(loopId); onBack(); }); }}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {detail.problems.length > 0 && (
        <p className="text-sm text-destructive mt-2">Blocking activation: {detail.problems.join("; ")}</p>
      )}
      {err && <p className="text-sm text-destructive mt-2">{err}</p>}

      {watching && (
        <RunWatch loopId={loopId} onClose={() => { setWatching(false); refresh(); }} />
      )}

      <ProcedureSection loop={loop} loopId={loopId} onChanged={refresh} />

      <PromptLab loop={loop} loopId={loopId} onChanged={refresh} />

      <SpecOps loop={loop} loopId={loopId} onChanged={refresh} />

      <VersionHistory loopId={loopId} currentVersion={loop.version} onChanged={refresh} />

      <EvalSection loopId={loopId} />

      <div className="mt-6">
        <h3 className="font-semibold mb-2">Runs</h3>
        <div className="border border-border rounded-lg divide-y divide-border">
          {runs.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No runs yet — click “Dry run”.</p>
          )}
          {runs.map((r) => (
            <div key={r.run_id}>
              <button
                onClick={() => setOpenRun(openRun === r.run_id ? null : r.run_id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 text-left"
              >
                <Badge text={r.status} />
                <span className="text-xs font-mono text-muted-foreground">{r.run_id.slice(0, 8)}</span>
                <span className="text-xs text-muted-foreground">
                  {r.iteration} steps · ${Number(r.cost_usd || 0).toFixed(4)}
                  {r.dry_run ? " · dry-run" : " · LIVE"}
                </span>
              </button>
              {openRun === r.run_id && (
                <RunDetail loopId={loopId} runId={r.run_id} onChanged={refresh} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Run detail: gates + check evidence ─────────────────────────────────

function RunDetail({ loopId, runId, onChanged }: { loopId: string; runId: string; onChanged: () => void }) {
  const [run, setRun] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getRun(loopId, runId).then((d) => setRun(d.run)).catch(() => {});
  }, [loopId, runId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => {
      if (run && ["running", "verifying"].includes(run.status)) load();
    }, 3000);
    return () => clearInterval(t);
  }, [run, load]);

  if (!run) return <p className="px-4 py-3 text-sm text-muted-foreground">Loading…</p>;

  const gate = async (approve: boolean) => {
    setBusy(true);
    try { await (approve ? approveRun(loopId, runId) : rejectRun(loopId, runId)); load(); onChanged(); }
    finally { setBusy(false); }
  };

  // Flywheel: turn THIS run into a regression case. Especially valuable for
  // failed/rejected runs — every future edit must then keep this scenario ok.
  const toSuite = async () => {
    const expected = prompt(
      "What SHOULD have happened on this input? (plain English — used by the judge; optional)",
    );
    if (expected === null) return;   // cancelled
    setBusy(true);
    try {
      const r = await addRunToSuite(loopId, runId, { expected: expected || "" });
      alert(`Added as eval case #${r.cases} (${r.focus}).`);
    } catch (e: any) { alert(`Could not add: ${e.message}`); }
    finally { setBusy(false); }
  };

  const tokens = (run.tokens_in || 0) + (run.tokens_out || 0);
  const wallClock = run.created_at && run.finished_at
    ? Math.max(0, (Date.parse(run.finished_at) - Date.parse(run.created_at)) / 1000)
    : null;

  return (
    <div className="px-4 py-3 bg-muted/20 border-t border-border text-sm space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge text={run.status} />
        <VerdictBadge verdict={run.verdict} />
        {run.exit_reason && <span className="text-xs text-muted-foreground">{run.exit_reason}</span>}
        <span className="text-xs text-muted-foreground ml-auto">
          ${Number(run.cost_usd || 0).toFixed(4)}
          {tokens > 0 && <> · {tokens.toLocaleString()} tokens</>}
          {wallClock !== null && <> · {wallClock.toFixed(0)}s</>}
        </span>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={busy}
                onClick={toSuite}>
          <Plus size={12} className="mr-1" /> Add to eval suite
        </Button>
      </div>

      {run.pending_approval && (
        <div className="border border-amber-500/40 bg-amber-500/10 rounded-md p-3">
          <p className="text-sm mb-2">🔔 {run.pending_approval.prompt}</p>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => gate(true)}>
              <ThumbsUp size={14} className="mr-1" /> Approve
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => gate(false)}>
              <ThumbsDown size={14} className="mr-1" /> Reject
            </Button>
          </div>
        </div>
      )}

      {(run.check_results || []).length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Check evidence</p>
          <ul className="space-y-1">
            {run.check_results.map((c: any, i: number) => (
              <li key={i} className="flex items-start gap-2">
                {c.verdict === "pass"
                  ? <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                  : c.verdict === "fail"
                    ? <XCircle size={14} className="text-red-600 mt-0.5 shrink-0" />
                    : <span className="text-amber-600 text-xs mt-0.5">◐</span>}
                <span>
                  <span className="font-medium">{c.label}</span>{" "}
                  <span className="text-muted-foreground">— {c.reason}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Steps</p>
        <div className="flex flex-wrap gap-1">
          {(() => {
            // Duration per step = finished.at − started.at (history stamps `at`).
            const started: Record<string, number> = {};
            return (run.history || []).map((h: any, i: number) => {
              let dur = "";
              const t = h.at ? Date.parse(h.at) : NaN;
              if (h.phase === "started" && !isNaN(t)) started[h.step_id] = t;
              if ((h.phase === "finished" || h.phase === "failed") && !isNaN(t)
                  && started[h.step_id]) {
                dur = ` ${((t - started[h.step_id]) / 1000).toFixed(1)}s`;
              }
              return (
                <span key={i}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                    h.phase === "failed" ? "border-red-400 text-red-600" : "border-border text-muted-foreground"}`}>
                  {h.step_id}:{h.phase}{dur}
                </span>
              );
            });
          })()}
        </div>
      </div>

      {/* Why a run failed — the exception note from the failing step. */}
      {(run.history || []).filter((h: any) => h.phase === "failed" && h.note).map((h: any, i: number) => (
        <div key={i} className="border border-red-400/40 bg-red-500/10 rounded-md p-2.5">
          <p className="text-xs font-medium text-red-600">✗ {h.step_id} failed</p>
          <pre className="mt-1 text-[11px] text-red-600/90 whitespace-pre-wrap break-words font-mono">{h.note}</pre>
        </div>
      ))}
    </div>
  );
}

// ── Run & watch: live per-step progress ────────────────────────────────

type StepPhase = "pending" | "active" | "done" | "failed";

function RunWatch({ loopId, onClose }: { loopId: string; onClose: () => void }) {
  const [steps, setSteps] = useState<any[]>([]);
  const [phase, setPhase] = useState<Record<string, StepPhase>>({});
  const [status, setStatus] = useState<string>("starting");
  const [cost, setCost] = useState(0);
  const [tokens, setTokens] = useState(0);
  const [checks, setChecks] = useState<any[]>([]);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [approval, setApproval] = useState<{ prompt: string; runId: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const apply = useCallback((ev: any) => {
    switch (ev.type) {
      case "run_started":
        setSteps(ev.steps || []);
        setPhase(Object.fromEntries((ev.steps || []).map((s: any) => [s.id, "pending"])));
        break;
      case "step":
        setPhase((p) => ({
          ...p,
          [ev.step_id]:
            ev.phase === "finished" ? "done"
            : ev.phase === "failed" ? "failed"
            : ev.phase === "started" ? "active"
            : p[ev.step_id] || "pending",
        }));
        if (typeof ev.cost_usd === "number") setCost(ev.cost_usd);
        if (typeof ev.tokens === "number") setTokens(ev.tokens);
        break;
      case "status": setStatus(ev.status); break;
      case "check": setChecks((c) => [...c, ev]); break;
      case "awaiting_approval":
        setStatus("awaiting_approval");
        setApproval({ prompt: ev.prompt, runId: ev.run_id });
        break;
      case "done":
        setStatus(ev.status); setVerdict(ev.verdict ?? null);
        if (typeof ev.cost_usd === "number") setCost(ev.cost_usd);
        setFinished(true);
        break;
      case "error": setErr(ev.message); setFinished(true); break;
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    abortRef.current = ac;
    streamRun(loopId, true, apply, ac.signal).catch((e) => {
      if (!ac.signal.aborted) { setErr(e.message); setFinished(true); }
    });
    return () => ac.abort();
  }, [loopId, apply]);

  const gate = async (approve: boolean) => {
    if (!approval) return;
    setBusy(true);
    try {
      await (approve ? approveRun(loopId, approval.runId) : rejectRun(loopId, approval.runId));
      setApproval(null);
      if (!approve) { setStatus("cancelled"); setFinished(true); return; }
      // Approved: the run resumes in the background — poll it to completion.
      setStatus("running");
      for (let i = 0; i < 150; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const { run } = await getRun(loopId, approval.runId);
        setCost(Number(run.cost_usd || 0));
        setPhase((p) => {
          const next = { ...p };
          for (const h of run.history || []) {
            next[h.step_id] = h.phase === "failed" ? "failed" : h.phase === "finished" ? "done" : h.phase === "started" ? "active" : next[h.step_id];
          }
          return next;
        });
        setChecks(run.check_results || []);
        setStatus(run.status);
        if (["completed", "failed", "cancelled"].includes(run.status)) {
          setVerdict(run.verdict ?? null); setFinished(true); break;
        }
      }
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const icon = (ph: StepPhase) =>
    ph === "done" ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
    : ph === "failed" ? <XCircle size={16} className="text-red-600 shrink-0" />
    : ph === "active" ? <Loader2 size={16} className="text-blue-600 animate-spin shrink-0" />
    : <Circle size={16} className="text-muted-foreground/40 shrink-0" />;

  const doneCount = Object.values(phase).filter((p) => p === "done").length;

  return (
    <div className="mt-4 border border-border rounded-lg p-4 bg-muted/20">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-semibold">Live run</h3>
        <Badge text={status} />
        {steps.length > 0 && (
          <span className="text-xs text-muted-foreground">{doneCount}/{steps.length} steps</span>
        )}
        <span className="text-xs text-muted-foreground">
          · ${cost.toFixed(4)}{tokens > 0 ? ` · ${tokens.toLocaleString()} tok` : ""}
        </span>
        {!finished && !approval && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
        <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs" onClick={() => { abortRef.current?.abort(); onClose(); }}>
          {finished ? "Close" : "Stop watching"}
        </Button>
      </div>

      {steps.length === 0 && !err && (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> compiling run…
        </p>
      )}

      <ol className="space-y-1.5">
        {steps.map((s) => {
          const ph = phase[s.id] || "pending";
          return (
            <li key={s.id} className="flex items-center gap-2 text-sm">
              {icon(ph)}
              <span className={ph === "pending" ? "text-muted-foreground" : ""}>{s.name}</span>
              <span className="text-[10px] text-muted-foreground">({s.kind}{s.guard ? " 🔒" : ""})</span>
              {ph === "active" && <span className="text-xs text-blue-600">working…</span>}
            </li>
          );
        })}
      </ol>

      {approval && (
        <div className="mt-3 border border-amber-500/40 bg-amber-500/10 rounded-md p-3">
          <p className="text-sm mb-2">🔔 {approval.prompt}</p>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => gate(true)}>
              <ThumbsUp size={14} className="mr-1" /> Approve
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => gate(false)}>
              <ThumbsDown size={14} className="mr-1" /> Reject
            </Button>
          </div>
        </div>
      )}

      {checks.length > 0 && (
        <div className="mt-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Verdict evidence</p>
          <ul className="space-y-1">
            {checks.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {c.verdict === "pass" ? <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                  : c.verdict === "fail" ? <XCircle size={14} className="text-red-600 mt-0.5 shrink-0" />
                  : <span className="text-amber-600 text-xs mt-0.5">◐</span>}
                <span><span className="font-medium">{c.label}</span> <span className="text-muted-foreground">— {c.reason}</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {verdict && (
        <div className="mt-3"><VerdictBadge verdict={verdict} /></div>
      )}
      {err && <p className="text-sm text-destructive mt-2">{err}</p>}
    </div>
  );
}

// ── Procedure: view / edit prose SOP + recompile ───────────────────────

function ProcedureSection(
  { loop, loopId, onChanged }: { loop: any; loopId: string; onChanged: () => void },
) {
  const [editing, setEditing] = useState(false);
  const [sop, setSop] = useState(loop.source_sop || "");
  const [busy, setBusy] = useState<"recompile" | "prose" | "review" | null>(null);
  const [preview, setPreview] = useState<any>(null);   // recompiled spec awaiting save
  const [sopReview, setSopReview] = useState<EditReview | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const startEdit = () => { setSop(loop.source_sop || ""); setPreview(null); setSopReview(null); setErr(null); setEditing(true); };
  const cancel = () => { setEditing(false); setPreview(null); setSopReview(null); setErr(null); };

  const askSopReview = async () => {
    setBusy("review"); setErr(null);
    try { setSopReview(await reviewEdit(loopId, { kind: "sop", text: sop })); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  };

  // Recompile: prose → fresh spec, shown for review before saving a new version.
  const recompile = async () => {
    setBusy("recompile"); setErr(null);
    try { setPreview(await compileSop(sop)); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  };

  // Save the recompiled spec as a new version (loop_id is pinned server-side).
  const saveRecompiled = async () => {
    setBusy("recompile"); setErr(null);
    try {
      await updateLoopSpec(loopId, preview.spec, "Edited prose → recompiled");
      cancel(); onChanged();
    } catch (e: any) { setErr(e.message); setBusy(null); }
  };

  // Prose-only edit: keep the existing compiled spec, just update the SOP text.
  const saveProseOnly = async () => {
    setBusy("prose"); setErr(null);
    try {
      // Send the current compiled spec unchanged except the prose; the server
      // pins loop_id and re-stamps status/version/timestamps.
      await updateLoopSpec(loopId, { ...loop, source_sop: sop }, "Prose edit (no recompile)");
      cancel(); onChanged();
    } catch (e: any) { setErr(e.message); setBusy(null); }
  };

  return (
    <div className="mt-4 border border-border rounded-lg p-4 bg-muted/20">
      <div className="flex items-center gap-2 mb-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">The procedure (source of truth)</p>
        {!editing && (
          <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs" onClick={startEdit}>
            <Pencil size={12} className="mr-1" /> Edit
          </Button>
        )}
      </div>

      {!editing ? (
        <>
          <p className="text-sm whitespace-pre-wrap">{loop.source_sop}</p>
          <div className="mt-3"><SpecSummary spec={loop} /></div>
        </>
      ) : (
        <div className="space-y-2">
          <textarea
            value={sop}
            onChange={(e) => setSop(e.target.value)}
            rows={6}
            className="w-full rounded-md border border-border bg-background p-3 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={askSopReview} disabled={sop.trim().length < 20 || busy !== null}>
              {busy === "review" ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Pencil size={14} className="mr-1" />}
              AI review
            </Button>
            <Button size="sm" onClick={recompile} disabled={sop.trim().length < 20 || busy !== null}>
              {busy === "recompile" && !preview ? <Loader2 size={14} className="mr-1 animate-spin" /> : <RefreshCw size={14} className="mr-1" />}
              Recompile (≈1 min)
            </Button>
            <Button size="sm" variant="outline" onClick={saveProseOnly} disabled={busy !== null}>
              {busy === "prose" ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Save size={14} className="mr-1" />}
              Save prose only
            </Button>
            <Button size="sm" variant="ghost" onClick={cancel} disabled={busy !== null}>Cancel</Button>
          </div>

          {sopReview && (
            <div className="border border-border rounded-md p-3 bg-background space-y-2 text-sm">
              <p><span className="font-medium">AI assessment:</span> {sopReview.assessment}</p>
              {sopReview.issues.length > 0 && (
                <ul className="list-disc pl-5 space-y-0.5 text-amber-600">
                  {sopReview.issues.map((i, k) => <li key={k}>{i}</li>)}
                </ul>
              )}
              {sopReview.improved_text && sopReview.improved_text !== sop && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Suggested rewrite</p>
                  <p className="text-xs whitespace-pre-wrap bg-muted/30 border border-border rounded p-2">{sopReview.improved_text}</p>
                  <Button size="sm" variant="outline" className="mt-2"
                          onClick={() => setSop(sopReview.improved_text)}>
                    Use this version
                  </Button>
                </div>
              )}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            “Recompile” rebuilds the steps &amp; checks from your prose; “Save prose only” keeps the current compiled spec. Either way a new version is recorded.
          </p>
          {err && <p className="text-sm text-destructive">{err}</p>}

          {preview && (
            <div className="mt-2 border border-border rounded-md p-3 bg-background space-y-2">
              <div className="text-sm font-medium">
                Recompiled preview — {preview.spec.steps.length} steps, {preview.spec.exit.checks.length} checks
                {preview.problems.length === 0
                  ? <span className="text-emerald-600"> · no problems</span>
                  : <span className="text-destructive"> · {preview.problems.join("; ")}</span>}
              </div>
              <SpecSummary spec={preview.spec} />
              <Button size="sm" onClick={saveRecompiled} disabled={busy !== null}>
                {busy === "recompile" ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Save size={14} className="mr-1" />}
                Save recompiled as new version
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Prompt lab: edit a step prompt → AI review → prove vs evals → save ──
//
// The regression-gated edit flow. Saving is always possible, but:
//   - evals verdict "regression" → explicit override confirm
//   - no eval proof at all       → explicit "unproven" confirm
// Candidate eval runs are flagged server-side so they never pollute the
// suite's headline scorecard.

function PromptLab(
  { loop, loopId, onChanged }: { loop: any; loopId: string; onChanged: () => void },
) {
  const llmSteps = (loop.steps || []).filter((s: any) => s.kind === "llm");
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [review, setReview] = useState<EditReview | null>(null);
  const [proof, setProof] = useState<
    | { state: "running"; note: string }
    | { state: "done"; report: RegressionReport }
    | null
  >(null);
  const [busy, setBusy] = useState<"review" | "prove" | "save" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (llmSteps.length === 0) return null;

  const startEdit = (s: any) => {
    setEditing(s.id); setText(s.config?.prompt || "");
    setReview(null); setProof(null); setErr(null);
  };
  const cancel = () => { setEditing(null); setReview(null); setProof(null); setErr(null); };

  // The candidate = current spec with ONLY this prompt replaced.
  const candidateSpec = () => {
    const spec = JSON.parse(JSON.stringify(loop));
    const st = spec.steps.find((x: any) => x.id === editing);
    if (st) st.config = { ...st.config, prompt: text };
    return spec;
  };

  const askReview = async () => {
    setBusy("review"); setErr(null);
    try {
      setReview(await reviewEdit(loopId, { kind: "prompt", step_id: editing!, text }));
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  };

  // Poll one eval-run doc to completion; it checkpoints per case, so we can
  // narrate real progress ("case 3/10") instead of a dumb spinner. If the
  // backend marks it "stalled" (background task died), auto-resume ONCE from
  // the checkpoint — completed cases are never re-run.
  const pollRun = async (suiteId: string, id: string, cases: number, phase: string) => {
    let resumed = false;
    for (let i = 0; i < 360; i++) {                      // ≤ ~12 min
      await new Promise((r) => setTimeout(r, 2000));
      const { eval_run } = await getEvalRun(loopId, suiteId, id);
      if (eval_run?.status === "completed") return eval_run;
      if (eval_run?.status === "stalled" && !resumed) {
        resumed = true;
        setProof({ state: "running", note: `${phase} — stalled, resuming from checkpoint…` });
        await resumeEvalRun(loopId, suiteId, id).catch(() => {});
        continue;
      }
      const done = (eval_run?.per_case || []).length;
      setProof({ state: "running", note: `${phase} — case ${Math.min(done + 1, cases)}/${cases}` });
    }
    return null;
  };

  const prove = async () => {
    setBusy("prove"); setErr(null);
    setProof({ state: "running", note: "preparing…" });
    try {
      const s = await listSuites(loopId);
      const suite = s.suites[0];
      if (!suite) throw new Error("No eval suite exists for this loop — create one first.");
      const nCases = suite.cases || 0;

      // Baseline = latest completed NON-candidate run; if none, honestly run
      // the suite on the CURRENT spec first.
      const runs = await listEvalRuns(loopId, suite.suite_id);
      let baselineId: string | null =
        (runs.eval_runs || []).find((r: any) => !r.candidate && r.status === "completed")
          ?.eval_run_id || null;
      if (!baselineId) {
        setProof({ state: "running", note: "no baseline yet — evaluating the CURRENT version first" });
        const started = await runSuite(loopId, suite.suite_id);
        const base = await pollRun(suite.suite_id, started.eval_run_id, nCases, "baseline");
        if (!base) throw new Error("Baseline eval did not complete in time");
        baselineId = base.eval_run_id as string;
      }
      if (!baselineId) throw new Error("No baseline eval run available");

      setProof({ state: "running", note: "evaluating your edited version…" });
      const cand = await runCandidateSuite(
        loopId, suite.suite_id, candidateSpec(), `prompt edit: ${editing}`,
      );
      const done = await pollRun(suite.suite_id, cand.eval_run_id, nCases, "your edit");
      if (!done) throw new Error("Candidate eval did not complete in time");

      const report = await compareEvalRuns(loopId, suite.suite_id, baselineId, cand.eval_run_id);
      setProof({ state: "done", report });
    } catch (e: any) { setProof(null); setErr(e.message); }
    finally { setBusy(null); }
  };

  const save = async () => {
    const report = proof?.state === "done" ? proof.report : null;
    if (report?.verdict === "regression") {
      if (!confirm(
        `This edit BROKE ${report.broke.length} eval case(s):\n` +
        report.broke.map((b) => `  • ${b.focus || `case ${b.case_index + 1}`}`).join("\n") +
        `\n\nOverride and save anyway?`,
      )) return;
    } else if (!report) {
      if (!confirm("This edit has NOT been proven against the evals. Save anyway?")) return;
    }
    setBusy("save"); setErr(null);
    try {
      const note = `Prompt edit on '${editing}'` +
        (report ? ` (evals: ${report.verdict})` : " (unproven)");
      await updateLoopSpec(loopId, candidateSpec(), note);
      cancel(); onChanged();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  };

  const dirty = editing !== null &&
    text !== (llmSteps.find((s: any) => s.id === editing)?.config?.prompt || "");

  return (
    <div className="mt-4 border border-border rounded-lg p-4">
      <h3 className="font-semibold mb-1">Step prompts</h3>
      <p className="text-xs text-muted-foreground mb-3">
        Edit what a step asks the AI to do — get an AI review, prove the change against the
        eval suite, then save (regressions need an explicit override).
      </p>

      <div className="space-y-2">
        {llmSteps.map((s: any) => (
          editing === s.id ? (
            <div key={s.id} className="border border-primary/40 rounded-md p-3 space-y-2">
              <p className="text-xs font-mono text-muted-foreground">{s.id}</p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                className="w-full rounded-md border border-border bg-background p-2.5 text-sm font-mono"
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={askReview}>
                  {busy === "review" ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Pencil size={14} className="mr-1" />}
                  AI review
                </Button>
                <Button size="sm" variant="outline" disabled={busy !== null || !dirty} onClick={prove}>
                  {busy === "prove" ? <Loader2 size={14} className="mr-1 animate-spin" /> : <ShieldCheck size={14} className="mr-1" />}
                  Prove against evals
                </Button>
                <Button size="sm" disabled={busy !== null || !dirty} onClick={save}>
                  {busy === "save" ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Save size={14} className="mr-1" />}
                  Save
                </Button>
                <Button size="sm" variant="ghost" disabled={busy !== null} onClick={cancel}>Cancel</Button>
              </div>

              {err && <p className="text-sm text-destructive">{err}</p>}

              {review && (
                <div className="border border-border rounded-md p-3 bg-muted/20 space-y-2 text-sm">
                  <p><span className="font-medium">AI assessment:</span> {review.assessment}</p>
                  {review.issues.length > 0 && (
                    <ul className="list-disc pl-5 space-y-0.5 text-amber-600">
                      {review.issues.map((i, k) => <li key={k}>{i}</li>)}
                    </ul>
                  )}
                  {review.improved_text && review.improved_text !== text && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Suggested rewrite</p>
                      <pre className="text-xs font-mono whitespace-pre-wrap bg-background border border-border rounded p-2">{review.improved_text}</pre>
                      <Button size="sm" variant="outline" className="mt-2"
                              onClick={() => setText(review.improved_text)}>
                        Use this version
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {proof?.state === "running" && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> {proof.note}
                </p>
              )}
              {proof?.state === "done" && (
                <RegressionReportView report={proof.report} />
              )}
            </div>
          ) : (
            <div key={s.id} className="flex items-start gap-2 border border-border rounded-md p-2.5 text-sm bg-background">
              <span className="text-xs font-mono text-muted-foreground mt-0.5 shrink-0">{s.id}</span>
              <p className="flex-1 min-w-0 text-xs text-muted-foreground line-clamp-2 font-mono">
                {s.config?.prompt || "(no prompt)"}
              </p>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" disabled={editing !== null}
                      onClick={() => startEdit(s)}>
                <Pencil size={13} />
              </Button>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

function RegressionReportView({ report }: { report: RegressionReport }) {
  const style =
    report.verdict === "regression" ? "bg-red-500/15 text-red-600"
    : report.verdict === "improved" ? "bg-emerald-500/15 text-emerald-600"
    : "bg-zinc-500/15 text-zinc-500";
  const gate = (s: any) => s?.gate ?? "—";
  return (
    <div className="border border-border rounded-md p-3 bg-muted/20 text-sm space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${style}`}>
          {report.verdict === "no_change" ? "no change" : report.verdict}
        </span>
        <span className="text-xs text-muted-foreground">
          gate {gate(report.baseline_summary)} → {gate(report.candidate_summary)} ·
          {" "}{report.still_passing} still passing · {report.still_failing} still failing
        </span>
      </div>
      {report.broke.length > 0 && (
        <div>
          <p className="text-xs font-medium text-red-600 mb-1">✗ Broke ({report.broke.length})</p>
          <ul className="text-xs space-y-0.5">
            {report.broke.map((b) => (
              <li key={b.case_index}>• {b.focus || `case ${b.case_index + 1}`}</li>
            ))}
          </ul>
        </div>
      )}
      {report.fixed.length > 0 && (
        <div>
          <p className="text-xs font-medium text-emerald-600 mb-1">✓ Fixed ({report.fixed.length})</p>
          <ul className="text-xs space-y-0.5">
            {report.fixed.map((f) => (
              <li key={f.case_index}>• {f.focus || `case ${f.case_index + 1}`}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Ops & advanced spec editing (everything is editable) ───────────────
//
// Quick-edit the operational knobs (budgets, trigger/schedule) inline, and an
// advanced JSON editor for the FULL spec (steps, tools+params, checks,
// state_schema, on_exit — everything). Both save through PUT /spec, so every
// change is versioned, re-validated, and auto-proven against the eval suite
// (the flywheel's post-save run).

function SpecOps(
  { loop, loopId, onChanged }: { loop: any; loopId: string; onChanged: () => void },
) {
  const [maxIter, setMaxIter] = useState<number>(loop.budgets?.max_iterations ?? 10);
  const [maxCost, setMaxCost] = useState<number>(loop.budgets?.max_cost_usd ?? 2);
  const [trigType, setTrigType] = useState<string>(loop.trigger?.type ?? "manual");
  const [cron, setCron] = useState<string>(loop.trigger?.cron ?? "");
  const [showJson, setShowJson] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const opsDirty =
    maxIter !== (loop.budgets?.max_iterations ?? 10) ||
    maxCost !== (loop.budgets?.max_cost_usd ?? 2) ||
    trigType !== (loop.trigger?.type ?? "manual") ||
    (cron || "") !== (loop.trigger?.cron || "");

  const saveOps = async () => {
    setBusy(true); setErr(null);
    try {
      const spec = JSON.parse(JSON.stringify(loop));
      spec.budgets = { ...spec.budgets, max_iterations: maxIter, max_cost_usd: maxCost };
      spec.trigger = { ...spec.trigger, type: trigType, cron: trigType === "schedule" ? cron : null };
      await updateLoopSpec(loopId, spec, "Budgets/trigger edit");
      onChanged();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const openJson = () => {
    // Strip server-managed fields; PUT /spec re-stamps them anyway.
    const spec = { ...loop };
    for (const k of ["created_at", "updated_at", "created_by", "org_id", "status", "version"]) {
      delete spec[k];
    }
    setJsonText(JSON.stringify(spec, null, 2));
    setShowJson(true); setErr(null);
  };

  const saveJson = async () => {
    let parsed: any;
    try { parsed = JSON.parse(jsonText); }
    catch { setErr("Not valid JSON"); return; }
    setBusy(true); setErr(null);
    try {
      await updateLoopSpec(loopId, parsed, "Advanced spec edit (JSON)");
      setShowJson(false); onChanged();
    } catch (e: any) { setErr(e.message); }   // server 422s on invalid specs
    finally { setBusy(false); }
  };

  return (
    <div className="mt-4 border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="font-semibold">Operations</h3>
        <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs" onClick={showJson ? () => setShowJson(false) : openJson}>
          {showJson ? "Close advanced editor" : "Advanced: edit full spec (JSON)"}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">Max steps / run</span>
          <input type="number" min={1} max={1000} value={maxIter}
                 onChange={(e) => setMaxIter(Number(e.target.value))}
                 className="w-24 rounded-md border border-border bg-background px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">Max cost / run ($)</span>
          <input type="number" min={0.01} step={0.5} value={maxCost}
                 onChange={(e) => setMaxCost(Number(e.target.value))}
                 className="w-24 rounded-md border border-border bg-background px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">Trigger</span>
          <select value={trigType} onChange={(e) => setTrigType(e.target.value)}
                  className="rounded-md border border-border bg-background px-2 py-1">
            <option value="manual">manual</option>
            <option value="api">api</option>
            <option value="schedule">schedule</option>
            <option value="chat">chat</option>
          </select>
        </label>
        {trigType === "schedule" && (
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Cron</span>
            <input value={cron} onChange={(e) => setCron(e.target.value)}
                   placeholder="0 9 * * *"
                   className="w-32 rounded-md border border-border bg-background px-2 py-1 font-mono" />
          </label>
        )}
        <Button size="sm" variant="outline" disabled={busy || !opsDirty} onClick={saveOps}>
          {busy ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Save size={14} className="mr-1" />}
          Save
        </Button>
      </div>

      {showJson && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            The FULL spec — steps, tools &amp; params, checks, state schema, on_exit. Saving
            validates server-side, records a new version, and re-runs the eval suite.
          </p>
          <textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} rows={18}
                    spellCheck={false}
                    className="w-full rounded-md border border-border bg-background p-2.5 text-xs font-mono" />
          <Button size="sm" disabled={busy} onClick={saveJson}>
            {busy ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Save size={14} className="mr-1" />}
            Validate &amp; save as new version
          </Button>
        </div>
      )}
      {err && <p className="text-sm text-destructive mt-2">{err}</p>}
    </div>
  );
}

// ── Version history + restore ──────────────────────────────────────────

function VersionHistory(
  { loopId, currentVersion, onChanged }:
  { loopId: string; currentVersion: number; onChanged: () => void },
) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<LoopVersion[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    listVersions(loopId).then((d) => setVersions(d.versions)).catch((e) => setErr(e.message));
  }, [loopId]);
  useEffect(() => { if (open) load(); }, [open, load, currentVersion]);

  const restore = async (v: number) => {
    if (!confirm(`Restore version ${v}? This creates a new version from that snapshot.`)) return;
    setBusy(v); setErr(null);
    try { await restoreVersion(loopId, v); onChanged(); load(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  };

  return (
    <div className="mt-4">
      <Button variant="ghost" size="sm" className="text-muted-foreground -ml-2"
              onClick={() => setOpen((o) => !o)}>
        <History size={14} className="mr-1" /> Version history (currently v{currentVersion})
      </Button>
      {open && (
        <div className="mt-2 border border-border rounded-lg divide-y divide-border">
          {err && <p className="p-3 text-sm text-destructive">{err}</p>}
          {versions.length === 0 && !err && (
            <p className="p-3 text-sm text-muted-foreground">Loading…</p>
          )}
          {versions.map((v) => (
            <div key={v.version} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className={`font-mono ${v.version === currentVersion ? "font-semibold" : "text-muted-foreground"}`}>
                v{v.version}{v.version === currentVersion ? " (current)" : ""}
              </span>
              <span className="flex-1 min-w-0 truncate text-muted-foreground">{v.change_note}</span>
              {v.version !== currentVersion && (
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={busy !== null}
                        onClick={() => restore(v.version)}>
                  {busy === v.version ? <Loader2 size={12} className="mr-1 animate-spin" /> : <RotateCcw size={12} className="mr-1" />}
                  Restore
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Evals: suite scorecard ─────────────────────────────────────────────

function EvalSection({ loopId }: { loopId: string }) {
  const [suites, setSuites] = useState<any[]>([]);
  const [latest, setLatest] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await listSuites(loopId);
      setSuites(s.suites);
      if (s.suites[0]) {
        const r = await listEvalRuns(loopId, s.suites[0].suite_id);
        // Candidate runs are edit-flow experiments on UNSAVED specs — the
        // headline scorecard must reflect the saved spec only.
        setLatest((r.eval_runs || []).filter((x: any) => !x.candidate)[0] || null);
      }
    } catch { /* none yet */ }
  }, [loopId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => { if (latest?.status === "running") load(); }, 5000);
    return () => clearInterval(t);
  }, [latest, load]);

  if (suites.length === 0) return null;
  const suite = suites[0];
  const s = latest?.summary;

  return (
    <div className="mt-6 border border-border rounded-lg p-4">
      <div className="flex items-center gap-3">
        <h3 className="font-semibold">Prove it — eval suite</h3>
        <span className="text-xs text-muted-foreground">
          {suite.cases} cases × {suite.trials_per_case} trials
        </span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing((e) => !e)}>
            <Pencil size={14} className="mr-1" /> {editing ? "Done editing" : "Edit cases"}
          </Button>
          <Button size="sm" variant="outline" disabled={busy}
                  onClick={async () => { setBusy(true); try { await runSuite(loopId, suite.suite_id); await load(); } finally { setBusy(false); } }}>
            <Play size={14} className="mr-1" /> Run suite
          </Button>
        </div>
      </div>

      {editing && (
        <CaseEditor loopId={loopId} suiteId={suite.suite_id} onChanged={load} />
      )}
      {latest && (
        <div className="mt-3 text-sm">
          {latest.status === "running" ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> running trials…
            </span>
          ) : latest.status === "stalled" ? (
            <span className="flex items-center gap-2 text-amber-600">
              ⚠ eval stalled (worker died)
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                      onClick={async () => { await resumeEvalRun(loopId, suite.suite_id, latest.eval_run_id).catch(() => {}); await load(); }}>
                Resume from checkpoint
              </Button>
            </span>
          ) : s ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`px-2 py-1 rounded font-semibold text-xs uppercase ${
                s.gate === "passed" ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-600"}`}>
                gate: {s.gate}
              </span>
              <span className="text-xs text-muted-foreground">
                pass^k {s.passk_cases}/{s.cases} · trial pass rate {(s.trial_pass_rate * 100).toFixed(0)}%
                {s.needs_review_trials ? ` · ${s.needs_review_trials} need review` : ""} ·
                ${Number(s.total_cost_usd || 0).toFixed(4)}
              </span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Eval case editor: add / edit / delete cases + suite settings ────────

const BLANK_CASE: EvalCase = { input: {}, expected: "", focus: "" };

function CaseEditor(
  { loopId, suiteId, onChanged }:
  { loopId: string; suiteId: string; onChanged: () => void },
) {
  const [cases, setCases] = useState<EvalCase[]>([]);
  const [trials, setTrials] = useState(2);
  const [threshold, setThreshold] = useState(0.8);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ index: number | null; draft: EvalCase } | null>(null);

  const load = useCallback(() => {
    getSuite(loopId, suiteId).then((d) => {
      setCases(d.suite.cases || []);
      setTrials(d.suite.trials_per_case ?? 2);
      setThreshold(d.suite.pass_threshold ?? 0.8);
    }).catch((e) => setErr(e.message));
  }, [loopId, suiteId]);
  useEffect(() => { load(); }, [load]);

  const refreshAll = () => { load(); onChanged(); };

  const saveCase = async (draft: EvalCase, index: number | null, inputJson: string) => {
    let input: Record<string, any>;
    try { input = inputJson.trim() ? JSON.parse(inputJson) : {}; }
    catch { setErr("Initial state must be valid JSON"); return; }
    setBusy(true); setErr(null);
    const payload = { ...draft, input };
    try {
      if (index === null) await addCase(loopId, suiteId, payload);
      else await updateCase(loopId, suiteId, index, payload);
      setEdit(null); refreshAll();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const remove = async (index: number) => {
    if (!confirm("Delete this eval case?")) return;
    setBusy(true); setErr(null);
    try { await deleteCase(loopId, suiteId, index); refreshAll(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const saveSettings = async () => {
    setBusy(true); setErr(null);
    try {
      await updateSuiteSettings(loopId, suiteId, {
        trials_per_case: trials, pass_threshold: threshold,
      });
      refreshAll();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="mt-3 border-t border-border pt-3 space-y-3">
      {err && <p className="text-sm text-destructive">{err}</p>}

      {/* Suite settings */}
      <div className="flex flex-wrap items-end gap-3 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">Trials / case (pass^k)</span>
          <input type="number" min={1} max={10} value={trials}
                 onChange={(e) => setTrials(Number(e.target.value))}
                 className="w-20 rounded-md border border-border bg-background px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">Pass threshold (0–1)</span>
          <input type="number" min={0} max={1} step={0.05} value={threshold}
                 onChange={(e) => setThreshold(Number(e.target.value))}
                 className="w-24 rounded-md border border-border bg-background px-2 py-1" />
        </label>
        <Button size="sm" variant="outline" disabled={busy} onClick={saveSettings}>
          <Save size={14} className="mr-1" /> Save settings
        </Button>
      </div>

      {/* Cases */}
      <div className="space-y-2">
        {cases.map((c, i) => (
          edit?.index === i ? (
            <CaseForm key={i} draft={edit.draft} busy={busy}
                      onCancel={() => setEdit(null)}
                      onSave={(d, json) => saveCase(d, i, json)} />
          ) : (
            <div key={i} className="flex items-start gap-2 border border-border rounded-md p-2.5 text-sm bg-background">
              <span className="text-xs font-mono text-muted-foreground mt-0.5">#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{c.focus || <span className="text-muted-foreground">(no focus label)</span>}</div>
                {c.expected && <div className="text-xs text-muted-foreground truncate">expects: {c.expected}</div>}
                {Object.keys(c.input || {}).length > 0 && (
                  <div className="text-[11px] font-mono text-muted-foreground truncate">{JSON.stringify(c.input)}</div>
                )}
              </div>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={busy}
                      onClick={() => setEdit({ index: i, draft: c })}>
                <Pencil size={13} />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" disabled={busy}
                      onClick={() => remove(i)}>
                <Trash2 size={13} />
              </Button>
            </div>
          )
        ))}
      </div>

      {edit?.index === null ? (
        <CaseForm draft={edit.draft} busy={busy}
                  onCancel={() => setEdit(null)}
                  onSave={(d, json) => saveCase(d, null, json)} />
      ) : (
        <Button size="sm" variant="outline"
                onClick={() => setEdit({ index: null, draft: { ...BLANK_CASE } })}>
          <Plus size={14} className="mr-1" /> Add case
        </Button>
      )}
    </div>
  );
}

function CaseForm(
  { draft, busy, onSave, onCancel }:
  { draft: EvalCase; busy: boolean;
    onSave: (draft: EvalCase, inputJson: string) => void; onCancel: () => void },
) {
  const [focus, setFocus] = useState(draft.focus || "");
  const [expected, setExpected] = useState(draft.expected || "");
  const [inputJson, setInputJson] = useState(
    Object.keys(draft.input || {}).length ? JSON.stringify(draft.input, null, 2) : "",
  );

  return (
    <div className="border border-primary/40 rounded-md p-3 bg-background space-y-2">
      <input value={focus} onChange={(e) => setFocus(e.target.value)}
             placeholder="Focus — what this case probes (e.g. 'no unpaid invoices → no-op')"
             className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
      <input value={expected} onChange={(e) => setExpected(e.target.value)}
             placeholder="Expected outcome (optional, plain English)"
             className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
      <textarea value={inputJson} onChange={(e) => setInputJson(e.target.value)}
                rows={3} placeholder={'Initial state as JSON (optional), e.g.\n{ "clients": [] }'}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono" />
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => onSave({ focus, expected, input: {} }, inputJson)}>
          {busy ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Save size={14} className="mr-1" />} Save case
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
          <X size={14} className="mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
}
