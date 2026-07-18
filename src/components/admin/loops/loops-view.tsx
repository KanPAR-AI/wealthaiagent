// Verified Procedures ("Loops") admin UI — docs/16 P6 (first cut).
//
// One surface for the whole lifecycle the user can test visually:
//   compile (prose SOP → spec) → review checks → activate → run (dry-run) →
//   approve gates as they park → see the VERDICT with per-check evidence →
//   eval suite scorecard (pass^k gate).

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2, ChevronLeft, History, Loader2, Pencil, Play, Plus, RefreshCw,
  RotateCcw, Save, ShieldCheck, ThumbsDown, ThumbsUp, Trash2, X, XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  EvalCase, LoopSummary, LoopVersion, RunSummary,
  addCase, approveRun, compileSop, createLoop, createSuite, deleteCase,
  deleteLoop, getLoop, getRun, getSuite, listEvalRuns, listLoops, listRuns,
  listSuites, listVersions, rejectRun, restoreVersion, runSuite, setLoopStatus,
  startRun, updateCase, updateLoopSpec, updateSuiteSettings,
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

      <ProcedureSection loop={loop} loopId={loopId} onChanged={refresh} />

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

// ── Procedure: view / edit prose SOP + recompile ───────────────────────

function ProcedureSection(
  { loop, loopId, onChanged }: { loop: any; loopId: string; onChanged: () => void },
) {
  const [editing, setEditing] = useState(false);
  const [sop, setSop] = useState(loop.source_sop || "");
  const [busy, setBusy] = useState<"recompile" | "prose" | null>(null);
  const [preview, setPreview] = useState<any>(null);   // recompiled spec awaiting save
  const [err, setErr] = useState<string | null>(null);

  const startEdit = () => { setSop(loop.source_sop || ""); setPreview(null); setErr(null); setEditing(true); };
  const cancel = () => { setEditing(false); setPreview(null); setErr(null); };

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
