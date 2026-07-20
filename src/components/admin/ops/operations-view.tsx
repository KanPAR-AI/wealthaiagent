// Operations — the platform's control room (docs/17; prompt registry design).
//
// Tabs:
//   Prompts      — every platform prompt (compiler, judge, extract, reviewer,
//                  fixer…) visible, editable with contract validation, fully
//                  versioned + restorable, hot-reloadable (60s TTL everywhere,
//                  Reload for this instance now).
//   Integrations — tool → webhook mappings (shared component with the loops page).
//   Jobs         — the durable loop_jobs queue: pending/claimed/done/failed.

import { useCallback, useEffect, useState } from "react";
import { History, Loader2, Pencil, RefreshCw, RotateCcw, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IntegrationsPanel } from "@/components/admin/loops/loops-view";
import { JarvisChip } from "@/components/admin/jarvis/jarvis-panel";
import { WhatsAppSetup } from "@/components/admin/whatsapp/whatsapp-setup";
import {
  LoopJob, PromptSummary,
  getPrompt, listJobs, listPrompts, listPromptVersions, reloadPrompts,
  restorePromptVersion, savePrompt,
} from "@/services/ops-service";

const JOB_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600",
  claimed: "bg-blue-500/15 text-blue-600",
  done: "bg-emerald-500/15 text-emerald-600",
  failed: "bg-red-500/15 text-red-600",
};

type OpsTab = "prompts" | "integrations" | "whatsapp" | "jobs";
const OPS_TABS: OpsTab[] = ["prompts", "integrations", "whatsapp", "jobs"];

export function OperationsView({ initialTab }: { initialTab?: string }) {
  const [tab, setTab] = useState<OpsTab>("prompts");
  // Deep-link support: /admin?section=ops&tab=integrations (Jarvis answers
  // navigate here).
  useEffect(() => {
    if (initialTab && (OPS_TABS as string[]).includes(initialTab)) {
      setTab(initialTab as OpsTab);
    }
  }, [initialTab]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Operations</h2>
          <p className="text-sm text-muted-foreground">
            The platform&apos;s own machinery — prompts, integrations, and the job queue.
          </p>
        </div>
        <div className="flex gap-1 border border-border rounded-lg p-1">
          {OPS_TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md text-sm capitalize ${
                tab === t ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"}`}>
              {t === "whatsapp" ? "WhatsApp" : t}
            </button>
          ))}
        </div>
      </div>

      {tab === "prompts" && <PromptsTab />}
      {tab === "integrations" && <IntegrationsPanel />}
      {tab === "whatsapp" && <WhatsAppSetup />}
      {tab === "jobs" && <JobsTab />}
    </div>
  );
}

// ── Prompts ─────────────────────────────────────────────────────────────

function PromptsTab() {
  const [prompts, setPrompts] = useState<PromptSummary[]>([]);
  const [ttl, setTtl] = useState(60);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reloadNote, setReloadNote] = useState<string | null>(null);

  const load = useCallback(() => {
    listPrompts().then((d) => { setPrompts(d.prompts); setTtl(d.cache_ttl_seconds); })
      .catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <p className="text-xs text-muted-foreground">
          Edits go live everywhere within {ttl}s (cache TTL). Contract-checked: a save
          that drops or invents a {"{variable}"} is refused.
        </p>
        <JarvisChip
          question="How does editing a platform prompt work — versions, contract checks, and when do edits go live?"
          context={{ page: "prompts", section: "ops", tab: "prompts" }}
        />
        <Button size="sm" variant="outline" className="ml-auto"
                onClick={async () => {
                  const r = await reloadPrompts().catch((e) => ({ cleared: 0, note: e.message }));
                  setReloadNote(`Cache cleared (${r.cleared}) — ${r.note}`);
                  setTimeout(() => setReloadNote(null), 5000);
                }}>
          <RefreshCw size={14} className="mr-1" /> Reload now
        </Button>
      </div>
      {reloadNote && <p className="text-xs text-emerald-600 mb-2">{reloadNote}</p>}
      {err && <p className="text-sm text-destructive mb-2">{err}</p>}

      <div className="border border-border rounded-lg divide-y divide-border">
        {prompts.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground text-center">Loading prompts…</p>
        )}
        {prompts.map((p) => (
          <div key={p.prompt_id}>
            <button
              onClick={() => setOpen(open === p.prompt_id ? null : p.prompt_id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 text-left">
              <span className="font-mono text-sm shrink-0">{p.prompt_id}</span>
              <span className="flex-1 min-w-0 truncate text-xs text-muted-foreground">
                {p.description}
              </span>
              <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                v{p.version} · {p.updated_by === "__code_default__" ? "code default" : p.updated_by}
              </span>
            </button>
            {open === p.prompt_id && (
              <PromptEditor promptId={p.prompt_id} onSaved={load} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PromptEditor({ promptId, onSaved }: { promptId: string; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [orig, setOrig] = useState("");
  const [vars, setVars] = useState<string[]>([]);
  const [versions, setVersions] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(() => {
    getPrompt(promptId).then((d) => {
      setText(d.prompt.text); setOrig(d.prompt.text);
      setVars(d.prompt.required_variables || []);
    }).catch((e) => setErr(e.message));
  }, [promptId]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await savePrompt(promptId, text, "Edited in Operations");
      setSaved(`Saved as v${r.version} — live everywhere within the cache TTL.`);
      setTimeout(() => setSaved(null), 6000);
      setOrig(text); onSaved();
    } catch (e: any) { setErr(e.message); }   // contract violations land here
    finally { setBusy(false); }
  };

  return (
    <div className="px-4 py-3 bg-muted/20 border-t border-border space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground mr-1 mt-0.5">
          Required variables:
        </span>
        {vars.length === 0 && <span className="text-[11px] text-muted-foreground">(none)</span>}
        {vars.map((v) => (
          <span key={v} className="px-1.5 py-0.5 rounded bg-background border border-border font-mono text-[11px]">
            {"{"}{v}{"}"}
          </span>
        ))}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={16}
                spellCheck={false}
                className="w-full rounded-md border border-border bg-background p-2.5 text-xs font-mono" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy || text === orig} onClick={save}>
          {busy ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Save size={14} className="mr-1" />}
          Save as new version
        </Button>
        <Button size="sm" variant="ghost" disabled={busy || text === orig}
                onClick={() => setText(orig)}>
          <Pencil size={14} className="mr-1" /> Revert edits
        </Button>
        <Button size="sm" variant="outline" disabled={busy}
                onClick={async () => {
                  if (versions) { setVersions(null); return; }
                  const v = await listPromptVersions(promptId).catch(() => ({ versions: [] }));
                  setVersions(v.versions);
                }}>
          <History size={14} className="mr-1" /> {versions ? "Hide history" : "History"}
        </Button>
      </div>
      {saved && <p className="text-xs text-emerald-600">{saved}</p>}
      {err && <p className="text-sm text-destructive whitespace-pre-wrap">{err}</p>}

      {versions && (
        <div className="border border-border rounded-md divide-y divide-border bg-background">
          {versions.map((v: any) => (
            <div key={v.version} className="flex items-center gap-3 px-3 py-2 text-xs">
              <span className="font-mono">v{v.version}</span>
              <span className="flex-1 min-w-0 truncate text-muted-foreground">{v.change_note}</span>
              <span className="text-muted-foreground shrink-0">{v.updated_by}</span>
              <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" disabled={busy}
                      onClick={async () => {
                        if (!confirm(`Restore v${v.version}? Creates a new version from that snapshot.`)) return;
                        setBusy(true);
                        try { await restorePromptVersion(promptId, v.version); setVersions(null); load(); onSaved(); }
                        catch (e: any) { setErr(e.message); }
                        finally { setBusy(false); }
                      }}>
                <RotateCcw size={11} className="mr-1" /> Restore
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Jobs ────────────────────────────────────────────────────────────────

function JobsTab() {
  const [jobs, setJobs] = useState<LoopJob[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    listJobs().then((d) => setJobs(d.jobs)).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">
        The durable queue behind evals and resumes. Accepted work survives restarts; the
        sweeper reclaims jobs a dead worker left claimed (up to 3 attempts, then failed loudly).
      </p>
      {err && <p className="text-sm text-destructive mb-2">{err}</p>}
      <div className="border border-border rounded-lg divide-y divide-border">
        {jobs.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground text-center">No jobs yet.</p>
        )}
        {jobs.map((j) => (
          <div key={j.job_id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className={`px-2 py-0.5 rounded text-[11px] font-medium shrink-0 ${
              JOB_COLORS[j.status] || "bg-zinc-500/15"}`}>{j.status}</span>
            <span className="font-mono text-xs shrink-0">{j.type}</span>
            <span className="font-mono text-[11px] text-muted-foreground shrink-0">
              {j.job_id.slice(0, 8)} · try {j.attempts}
            </span>
            <span className="flex-1 min-w-0 truncate text-xs text-muted-foreground">
              {j.error || ""}
            </span>
            <span className="text-[11px] text-muted-foreground shrink-0">
              {(j.created_at || "").slice(0, 19).replace("T", " ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
