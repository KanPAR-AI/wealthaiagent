/**
 * Create wizard (docs/37 §5.1, design spec screen 4): Template → SOP →
 * Layers → Compile. Templates preconfigure layers and NOTHING else; the SOP
 * stays the source of truth; the compiled result renders as the Loop Stack
 * diagram with every element violet-dotted (all AI-draft) beside the review
 * checklist. Compile may not be skipped. Planned capabilities (webhook
 * trigger, retry, analyst) are visible for roadmap honesty but disabled.
 */

import {
  BadgeCheck, Check, ChevronLeft, FlaskConical, Loader2, MessageCircle, Play,
  RefreshCcw, Sparkles, Timer,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { buildDiagramModel, LoopSpecT } from "@/lib/loop-stack/model";
import { compileSop, createLoop, draftSop } from "@/services/loops-service";

import { CronBuilder } from "./cron-builder";
import { LoopStack, PlannedCapability } from "./loop-stack";

// ── templates: layer presets only, no hidden behavior ────────────────────

interface LayerState {
  verify: boolean;
  trigger: "manual" | "api" | "chat" | "schedule";
  cron: string;
  improve: boolean;
  trials: number;
}

const TEMPLATES: Array<{
  id: string; icon: typeof Timer; title: string; blurb: string;
  layers: Partial<LayerState>;
}> = [
  { id: "digest", icon: Timer, title: "Scheduled digest",
    blurb: "Runs on a schedule, verified before anything is sent.",
    layers: { verify: true, trigger: "schedule", cron: "0 9 * * *", improve: false } },
  { id: "verified", icon: BadgeCheck, title: "Verified procedure",
    blurb: "Run on demand; every completion is graded.",
    layers: { verify: true, trigger: "manual", improve: false } },
  { id: "chat", icon: MessageCircle, title: "Chat assistant loop",
    blurb: "Triggered from WhatsApp; replies flow back to the chat.",
    layers: { verify: true, trigger: "chat", improve: true } },
  { id: "improving", icon: FlaskConical, title: "Self-improving procedure",
    blurb: "Verified, with an eval suite that regression-gates every edit.",
    layers: { verify: true, trigger: "manual", improve: true } },
  { id: "blank", icon: Play, title: "Blank",
    blurb: "Start from scratch.", layers: {} },
];

const DEFAULT_LAYERS: LayerState = {
  verify: true, trigger: "manual", cron: "0 9 * * *", improve: true, trials: 3,
};

// ── wizard ───────────────────────────────────────────────────────────────

export function LoopCreateWizard({ onDone, onCancel }: {
  onDone: (loopId?: string) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [template, setTemplate] = useState<string | null>(null);
  const [sop, setSop] = useState("");
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);
  const [goal, setGoal] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [compiled, setCompiled] = useState<{ spec: LoopSpecT; eval_cases: any[]; problems: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickTemplate = (id: string) => {
    setTemplate(id);
    const t = TEMPLATES.find((x) => x.id === id);
    setLayers({ ...DEFAULT_LAYERS, ...(t?.layers || {}) });
  };

  const doDraft = async () => {
    if (!goal.trim()) return;
    setDrafting(true);
    setErr(null);
    try {
      const { sop: drafted } = await draftSop(goal.trim());
      // Never overwrite existing text silently (design spec, screen 4 step 2).
      if (sop.trim()) setAiDraft(drafted);
      else setSop(drafted);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setDrafting(false);
    }
  };

  const doCompile = async () => {
    setCompiling(true);
    setErr(null);
    try {
      const hints: Record<string, any> = {
        verify: layers.verify,
        trigger: layers.trigger === "schedule"
          ? { type: "schedule", cron: layers.cron }
          : { type: layers.trigger },
        improve: layers.improve ? { suite: true, trials: layers.trials } : false,
      };
      const result = await compileSop(sop, hints);
      setCompiled(result);
      setStep(3);
    } catch (e) {
      // Keep wizard state on failure (design spec §5.4) — SOP and layers stay.
      setErr(e instanceof Error ? e.message : "Compile failed — try again");
    } finally {
      setCompiling(false);
    }
  };

  const doSave = async () => {
    if (!compiled) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await createLoop(compiled.spec as unknown as Record<string, any>);
      onDone(res?.loop?.loop_id || compiled.spec.loop_id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
      setSaving(false);
    }
  };

  const model = useMemo(
    () => (compiled
      ? buildDiagramModel(compiled.spec,
        layers.improve ? { cases: compiled.eval_cases.length, trials: layers.trials } : null)
      : null),
    [compiled, layers],
  );

  const stepNames = ["Template", "SOP", "Layers", "Compile"];

  return (
    <div className="mb-4 rounded-lg border border-border p-4">
      <div className="mb-4 flex items-center gap-3">
        <h3 className="font-semibold">Create loop</h3>
        <ol className="flex items-center gap-2 text-xs" aria-label="Wizard progress">
          {stepNames.map((n, i) => (
            <li key={n} className={cn(
              "flex items-center gap-1",
              i === step ? "font-medium text-foreground" : "text-muted-foreground",
            )}>
              {i < step && <Check aria-hidden className="size-3 text-emerald-600" />}
              {i + 1} {n}
              {i < 3 && <span aria-hidden className="ml-1 text-muted-foreground/50">—</span>}
            </li>
          ))}
        </ol>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onCancel}>Cancel</Button>
      </div>

      {err && <p className="mb-3 text-sm text-destructive">{err}</p>}

      {/* STEP 1 — template */}
      {step === 0 && (
        <div>
          <p className="mb-1 text-sm">What kind of loop are you building?</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Templates preconfigure layers. They do not create hidden behavior.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.map((t) => {
              const Icon = t.icon;
              const on = template === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pickTemplate(t.id)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors hover:bg-accent/50",
                    on ? "border-primary ring-1 ring-primary/40" : "border-border/60",
                  )}
                >
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                    <Icon aria-hidden className="size-4" /> {t.title}
                  </span>
                  <span className="text-xs text-muted-foreground">{t.blurb}</span>
                  {t.id !== "blank" && (
                    <span className="mt-1 text-[11px] text-muted-foreground">
                      Work On · Verify {t.layers.verify ? "On" : "Off"} · Trigger{" "}
                      {t.layers.trigger === "schedule" ? "Scheduled"
                        : t.layers.trigger === "chat" ? "Chat" : "Manual"} · Improve{" "}
                      {t.layers.improve ? "On" : "Off"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" disabled={!template} onClick={() => setStep(1)}>Continue</Button>
          </div>
        </div>
      )}

      {/* STEP 2 — SOP prose */}
      {step === 1 && (
        <div>
          <p className="mb-1 text-sm">Describe the procedure</p>
          <p className="mb-2 text-xs text-muted-foreground">
            Write this as you would explain it to a capable teammate. The SOP
            remains the source of truth.
          </p>
          <Textarea
            value={sop}
            onChange={(e) => setSop(e.target.value)}
            rows={8}
            placeholder="Every day at 09:00 fetch all overdue invoices…"
            className="font-mono text-xs"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="…or give a one-line goal"
              className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs"
            />
            <Button size="sm" variant="outline" disabled={drafting || !goal.trim()} onClick={doDraft}>
              {drafting ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Sparkles size={14} className="mr-1" />}
              {drafting ? "Drafting from your instructions…" : "Draft with AI"}
            </Button>
          </div>
          {aiDraft && (
            <div className="mt-2 rounded-md border border-border bg-muted/30 p-2">
              <p className="mb-1 text-xs font-medium">AI draft ready</p>
              <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs">{aiDraft}</pre>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => { setSop(aiDraft); setAiDraft(null); }}>Use draft</Button>
                <Button size="sm" variant="outline" onClick={() => { setSop((s) => `${s}\n\n${aiDraft}`); setAiDraft(null); }}>
                  Insert below
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAiDraft(null)}>Cancel</Button>
              </div>
            </div>
          )}
          <ul className="mt-2 list-disc pl-5 text-[11px] text-muted-foreground">
            <li>Include the desired outcome.</li>
            <li>Name tools/data where important.</li>
            <li>State where human approval is required.</li>
          </ul>
          {sop.trim().length > 0 && sop.trim().length < 20 && (
            <p className="mt-1 text-xs text-muted-foreground">Add a procedure before continuing.</p>
          )}
          <div className="mt-3 flex justify-between">
            <Button size="sm" variant="ghost" onClick={() => setStep(0)}>
              <ChevronLeft size={14} className="mr-1" /> Back
            </Button>
            <Button size="sm" disabled={sop.trim().length < 20} onClick={() => setStep(2)}>Continue</Button>
          </div>
        </div>
      )}

      {/* STEP 3 — layers */}
      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm">Configure the stack</p>

          <LayerCard label="WORK" state="On">
            <p className="text-xs text-muted-foreground">
              Generated from your SOP during compilation.
            </p>
          </LayerCard>

          <LayerCard
            label="VERIFY"
            state={layers.verify ? "On" : "Off"}
            onToggle={() => setLayers((l) => ({ ...l, verify: !l.verify }))}
          >
            <p className="text-xs text-muted-foreground">
              Assertions, an LLM judge and human approvals grade every completion.
            </p>
            <div className="mt-1">
              <PlannedCapability label="Retry failed verdict" icon={RefreshCcw}
                detail="automatically retry work after a failed verification verdict." />
            </div>
          </LayerCard>

          <LayerCard label="TRIGGER" state="On">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Trigger type">
              {(["manual", "api", "chat", "schedule"] as const).map((t) => (
                <label key={t} className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
                  layers.trigger === t ? "border-primary ring-1 ring-primary/40" : "border-border/60",
                )}>
                  <input
                    type="radio"
                    name="trigger"
                    className="sr-only"
                    checked={layers.trigger === t}
                    onChange={() => setLayers((l) => ({ ...l, trigger: t }))}
                  />
                  {t === "schedule" ? "Scheduled" : t === "chat" ? "Chat / WhatsApp" : t === "api" ? "API" : "Manual"}
                </label>
              ))}
              <PlannedCapability label="Webhook" icon={Play}
                detail="start a run from an inbound signed webhook." />
            </div>
            {layers.trigger === "schedule" && (
              <div className="mt-2">
                <CronBuilder
                  value={layers.cron}
                  onChange={(cron) => setLayers((l) => ({ ...l, cron }))}
                />
              </div>
            )}
          </LayerCard>

          <LayerCard
            label="IMPROVE"
            state={layers.improve ? "On" : "Off"}
            onToggle={() => setLayers((l) => ({ ...l, improve: !l.improve }))}
          >
            <p className="text-xs text-muted-foreground">
              Eval suite generated at compile · auto-eval on save.
            </p>
            {layers.improve && (
              <label className="mt-1 flex items-center gap-2 text-xs">
                Trials per case
                <input
                  type="number" min={1} max={5}
                  value={layers.trials}
                  onChange={(e) => setLayers((l) => ({ ...l, trials: Math.max(1, Math.min(5, Number(e.target.value) || 3)) }))}
                  className="h-7 w-14 rounded-md border border-input bg-background px-1 text-center"
                />
                <span className="text-muted-foreground">
                  Runs each eval case multiple times to measure reliability.
                </span>
              </label>
            )}
            <div className="mt-1">
              <PlannedCapability label="AI analyst" icon={FlaskConical}
                detail="an AI analyst that reads run traces and proposes improvements." />
            </div>
          </LayerCard>

          <div className="flex justify-between">
            <Button size="sm" variant="ghost" onClick={() => setStep(1)}>
              <ChevronLeft size={14} className="mr-1" /> Back
            </Button>
            <Button size="sm" disabled={compiling} onClick={doCompile}>
              {compiling ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
              {compiling ? "Compiling SOP…" : "Compile SOP"}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4 — compile preview */}
      {step === 3 && compiled && model && (
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">Compilation complete</p>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <span aria-hidden className="size-2 rounded-full bg-violet-500/80" /> AI draft
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_260px]">
            <LoopStack mode="spec" model={model} />
            <aside className="rounded-lg border border-border p-3 text-sm">
              <p className="mb-2 font-medium">Review before activate</p>
              <ul className="space-y-1 text-xs">
                <li>✓ SOP compiled</li>
                <li>✓ Trigger configured</li>
                <li className="flex items-center gap-1">
                  <span aria-hidden className="size-2 rounded-full bg-violet-500/80" />
                  Review {compiled.spec.steps.length} steps
                </li>
                <li className="flex items-center gap-1">
                  <span aria-hidden className="size-2 rounded-full bg-violet-500/80" />
                  Review {compiled.spec.exit.checks.length} checks
                </li>
                <li className="flex items-center gap-1">
                  <span aria-hidden className="size-2 rounded-full bg-violet-500/80" />
                  Review {compiled.eval_cases.length} eval cases
                </li>
                {compiled.problems.length === 0
                  ? <li className="text-muted-foreground">No structural errors</li>
                  : compiled.problems.map((p, i) => (
                    <li key={i} className="text-destructive">× {p}</li>
                  ))}
              </ul>
              <Button size="sm" className="mt-3 w-full" disabled={saving} onClick={doSave}>
                {saving ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
                Save as draft
              </Button>
              <Button size="sm" variant="ghost" className="mt-1 w-full" onClick={() => setStep(2)}>
                Back to layers
              </Button>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}

function LayerCard({ label, state, onToggle, children }: {
  label: string; state: "On" | "Off"; onToggle?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={cn(
      "rounded-xl border p-3",
      state === "On" ? "border-border" : "border-border/40 opacity-80",
    )}>
      <header className="mb-1 flex items-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
        {onToggle ? (
          <button
            type="button"
            role="switch"
            aria-checked={state === "On"}
            aria-label={`${label} layer ${state}`}
            onClick={onToggle}
            className={cn(
              "ml-auto rounded-md border px-2 py-0.5 text-[11px] font-medium",
              state === "On" ? "border-primary/50 text-foreground" : "border-border/60 text-muted-foreground",
            )}
          >
            {state}
          </button>
        ) : (
          <span className="ml-auto text-[11px] font-medium text-muted-foreground">{state}</span>
        )}
      </header>
      {children}
    </section>
  );
}
