// Verified Procedures ("Loops") admin UI — docs/16 P6 (first cut).
//
// One surface for the whole lifecycle the user can test visually:
//   compile (prose SOP → spec) → review checks → activate → run (dry-run) →
//   approve gates as they park → see the VERDICT with per-check evidence →
//   eval suite scorecard (pass^k gate).

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2, ChevronLeft, Loader2, Play, Plus, RefreshCw,
  ShieldCheck, ThumbsDown, ThumbsUp, Trash2, XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  LoopSummary, RunSummary,
  approveRun, compileSop, createLoop, createSuite, deleteLoop, getLoop,
  getRun, listEvalRuns, listLoops, listRuns, listSuites, rejectRun,
  runSuite, setLoopStatus, startRun,
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
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCompile, setShowCompile] = useState(false);

  const refresh = useCallback(() => {
    listLoops().then((d) => setLoops(d.loops)).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  if (selected) {
    return <LoopDetailView loopId={selected} onBack={() => { setSelected(null); refresh(); }} />;
  }

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
          <Button variant="outline" size="sm" onClick={refresh}><RefreshCw size={14} /></Button>
          <Button size="sm" onClick={() => setShowCompile(true)}>
            <Plus size={14} className="mr-1" /> New from SOP
          </Button>
        </div>
      </div>

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
        {loops.map((l) => (
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
              </div>
            </div>
            <Badge text={l.status} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Compile from prose ─────────────────────────────────────────────────

function CompilePanel({ onDone }: { onDone: (loopId?: string) => void }) {
  const [sop, setSop] = useState("");
  const [busy, setBusy] = useState<"compile" | "save" | null>(null);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const compile = async () => {
    setBusy("compile"); setErr(null);
    try { setResult(await compileSop(sop)); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  };

  const save = async () => {
    setBusy("save"); setErr(null);
    try {
      await createLoop(result.spec);
      // Seed the eval suite from the compiler's spec-derived cases.
      if (result.eval_cases?.length) {
        await createSuite(result.spec.loop_id, result.eval_cases, 2, 0.8).catch(() => {});
      }
      onDone(result.spec.loop_id);
    } catch (e: any) { setErr(e.message); setBusy(null); }
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
        <Button size="sm" onClick={compile} disabled={sop.trim().length < 20 || busy !== null}>
          {busy === "compile" ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
          {busy === "compile" ? "Compiling (≈1 min)…" : "Compile"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDone()}>Cancel</Button>
      </div>
      {err && <p className="text-sm text-destructive mt-2">{err}</p>}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="text-sm font-medium">
            Compiled: <span className="font-mono">{result.spec.loop_id}</span> —{" "}
            {result.spec.steps.length} steps, {result.spec.exit.checks.length} checks,{" "}
            {result.eval_cases.length} eval cases
            {result.problems.length === 0
              ? <span className="text-emerald-600"> · no problems</span>
              : <span className="text-destructive"> · {result.problems.join("; ")}</span>}
          </div>
          <SpecSummary spec={result.spec} />
          <Button size="sm" onClick={save} disabled={busy !== null}>
            {busy === "save" ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
            Save as draft (+ eval suite)
          </Button>
        </div>
      )}
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
          <Button size="sm" variant="outline" disabled={busy}
                  onClick={() => act(() => startRun(loopId, true))}>
            <Play size={14} className="mr-1" /> Dry run
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

      <div className="mt-4 border border-border rounded-lg p-4 bg-muted/20">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">The procedure (source of truth)</p>
        <p className="text-sm whitespace-pre-wrap">{loop.source_sop}</p>
        <div className="mt-3"><SpecSummary spec={loop} /></div>
      </div>

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

  return (
    <div className="px-4 py-3 bg-muted/20 border-t border-border text-sm space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge text={run.status} />
        <VerdictBadge verdict={run.verdict} />
        {run.exit_reason && <span className="text-xs text-muted-foreground">{run.exit_reason}</span>}
        <span className="text-xs text-muted-foreground ml-auto">
          ${Number(run.cost_usd || 0).toFixed(4)} metered
        </span>
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
          {(run.history || []).map((h: any, i: number) => (
            <span key={i}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                h.phase === "failed" ? "border-red-400 text-red-600" : "border-border text-muted-foreground"}`}>
              {h.step_id}:{h.phase}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Evals: suite scorecard ─────────────────────────────────────────────

function EvalSection({ loopId }: { loopId: string }) {
  const [suites, setSuites] = useState<any[]>([]);
  const [latest, setLatest] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await listSuites(loopId);
      setSuites(s.suites);
      if (s.suites[0]) {
        const r = await listEvalRuns(loopId, s.suites[0].suite_id);
        setLatest(r.eval_runs[0] || null);
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
        <Button size="sm" variant="outline" className="ml-auto" disabled={busy}
                onClick={async () => { setBusy(true); try { await runSuite(loopId, suite.suite_id); await load(); } finally { setBusy(false); } }}>
          <Play size={14} className="mr-1" /> Run suite
        </Button>
      </div>
      {latest && (
        <div className="mt-3 text-sm">
          {latest.status === "running" ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> running trials…
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
