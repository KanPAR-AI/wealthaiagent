/**
 * The Loop Stack Diagram (docs/37 §2, design spec §2/§3/§11).
 *
 * One component, three modes — spec / run / thumbnail — over ONE model:
 * an admin never has to translate "the thing I built" into "the thing that
 * is running". Nested operational layers, not a canvas: no dragging, no
 * rewiring, no zoom. Structure comes from the SOP; this is a structured
 * execution view with attach-point actions.
 *
 * Hard rules carried from the spec:
 *  - honesty: planned capabilities render dashed/muted/aria-disabled, never
 *    as available options, never on thumbnails;
 *  - provenance (violet dot) is quiet and never shares a channel with
 *    runtime state;
 *  - every state = icon + label, never color alone;
 *  - motion is state communication only, `motion-reduce` kills the pulse.
 */

import {
  Activity, AlertTriangle, BadgeCheck, Bot, Check, ChevronRight, CircleSlash,
  Clock, FlaskConical, GitBranch, Hand, ListChecks, MessageCircle, Play,
  RefreshCcw, Scale, Settings2, Shield, ShieldAlert, Timer, Wrench, X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
  CheckRunState, DiagramCheck, DiagramModel, DiagramStep, RunOverlay,
  StepRunState,
} from "@/lib/loop-stack/model";

// ── shared state visuals: icon + label, never color alone ────────────────

const STEP_STATE: Record<StepRunState, { icon: typeof Check; label: string; cls: string }> = {
  done: { icon: Check, label: "Done", cls: "border-emerald-600/50 text-emerald-700 dark:text-emerald-400" },
  running: { icon: Activity, label: "Running", cls: "border-blue-500/60 text-blue-600 dark:text-blue-400" },
  pending: { icon: ChevronRight, label: "Pending", cls: "border-border/60 text-muted-foreground" },
  failed: { icon: X, label: "Failed", cls: "border-destructive/60 text-destructive" },
  awaiting_approval: { icon: Shield, label: "Approval required", cls: "border-amber-500/70 text-amber-600 dark:text-amber-400" },
  awaiting_event: { icon: Clock, label: "Waiting", cls: "border-violet-500/60 text-violet-600 dark:text-violet-400" },
  skipped: { icon: CircleSlash, label: "Skipped", cls: "border-border/40 text-muted-foreground/70" },
};

const KIND_ICON: Record<string, typeof Check> = {
  llm: Bot, tool: Wrench, branch: GitBranch, wait_approval: Hand,
  extract: ListChecks, wait_event: Clock, agent: Bot,
};

const CHECK_ICON: Record<string, typeof Check> = {
  assertion: Settings2, llm_judge: Scale, human_approval: Shield,
};

export function ProvenanceDot({ reviewed, origin }: { reviewed: boolean; origin: string }) {
  if (reviewed || origin === "human") return null;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            aria-label="AI-drafted, not yet reviewed"
            className="ml-1 inline-block size-2 shrink-0 rounded-full bg-violet-500/80"
          />
        </TooltipTrigger>
        <TooltipContent side="top">AI-drafted · not yet reviewed</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ProvenanceSummary({ total, reviewed, onClick }: {
  total: number; reviewed: number; onClick?: () => void;
}) {
  if (total === 0) return null;
  const all = reviewed >= total;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1 text-xs",
        "hover:bg-accent/60 transition-colors",
        all ? "text-muted-foreground" : "text-foreground/80",
      )}
    >
      {all
        ? <Check aria-hidden className="size-3 text-emerald-600" />
        : <span aria-hidden className="size-2 rounded-full bg-violet-500/80" />}
      {all
        ? `All ${total} AI-drafted parts reviewed`
        : `${reviewed} of ${total} AI-drafted parts reviewed`}
    </button>
  );
}

export function PlannedCapability({ label, detail, icon: Icon = RefreshCcw }: {
  label: string; detail: string; icon?: typeof RefreshCcw;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            aria-disabled="true"
            aria-label={`${label}. Planned capability. Not currently available.`}
            className="inline-flex cursor-default items-center gap-1 rounded-md border border-dashed border-border/50 px-2 py-0.5 text-[11px] text-muted-foreground/70"
          >
            <Icon aria-hidden className="size-3" />
            {label}
            <span className="rounded bg-muted px-1 text-[10px] uppercase tracking-wide">planned</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-56">
          Planned capability — {detail} Not available yet.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── layers ───────────────────────────────────────────────────────────────

function StackLayer({ label, summary, children, extras, tone = "outer" }: {
  label: string; summary?: string; children: React.ReactNode;
  extras?: React.ReactNode; tone?: "outer" | "inner" | "work";
}) {
  return (
    <section
      aria-label={label}
      className={cn(
        "rounded-2xl border p-3",
        tone === "outer" && "border-border/40 bg-muted/20",
        tone === "inner" && "border-border/50 bg-muted/30",
        tone === "work" && "border-border bg-background shadow-sm",
      )}
    >
      <header className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        {summary && <span className="text-xs text-muted-foreground">{summary}</span>}
        <span className="ml-auto flex items-center gap-2">{extras}</span>
      </header>
      {children}
    </section>
  );
}

// ── trigger ──────────────────────────────────────────────────────────────

const TRIGGER_ICON: Record<string, typeof Play> = {
  manual: Play, api: Play, chat: MessageCircle, schedule: Timer, webhook: Play,
};

function TriggerNode({ model, fired, onOpen }: {
  model: DiagramModel["trigger"]; fired?: boolean; onOpen?: () => void;
}) {
  const Icon = TRIGGER_ICON[model.type] ?? Play;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Trigger: ${model.label}${fired ? ". Fired this run." : ""}`}
      className={cn(
        "flex min-w-36 shrink-0 flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left",
        "transition-colors hover:bg-accent/60",
        fired ? "border-emerald-600/50" : "border-primary/40",
      )}
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
        {fired && <Check aria-hidden className="size-3 text-emerald-600" />}
        <Icon aria-hidden className="size-3.5" />
        {model.type === "schedule" ? "Scheduled" : model.type === "chat" ? "Chat" : model.type === "api" ? "API" : "Manual"}
      </span>
      <span className="text-[11px] text-muted-foreground">{model.label}</span>
      {model.nextFire && !fired && (
        <span className="text-[10px] text-muted-foreground/70">
          next {new Date(model.nextFire).toUTCString().slice(0, 22)} UTC
        </span>
      )}
    </button>
  );
}

// ── steps ────────────────────────────────────────────────────────────────

function GatePopover({ onAdd, onClose }: { onAdd: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [onClose]);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Add approval gate"
      className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-border bg-popover p-3 text-left shadow-md"
    >
      <p className="text-xs font-medium">Add approval gate</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Require a person to review evidence before this step runs.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 w-full rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
      >
        Add human approval
      </button>
    </div>
  );
}

function StepNode({ step, state, mode, parked, selected, onOpen, onAddGate }: {
  step: DiagramStep;
  state: StepRunState | null;
  mode: "spec" | "run";
  parked?: boolean;
  selected?: boolean;
  onOpen?: (step: DiagramStep) => void;
  onAddGate?: (stepId: string) => void;
}) {
  const [gateOpen, setGateOpen] = useState(false);
  const KindIcon = KIND_ICON[step.kind] ?? Bot;
  const st = state ? STEP_STATE[state] : null;
  const StateIcon = st?.icon;
  const canGate = mode === "spec" && !step.gate && onAddGate
    && step.kind !== "wait_approval" && step.kind !== "branch";

  const aria = [
    `Step ${step.index}. ${step.title}. ${step.kind} step.`,
    st ? `${st.label}.` : "",
    step.gate ? "Has a human approval gate." : "",
    !step.provenance.reviewed && step.provenance.origin !== "human"
      ? "AI-drafted and not reviewed." : "",
  ].join(" ");

  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        aria-label={aria}
        onClick={() => onOpen?.(step)}
        className={cn(
          "flex w-48 min-w-44 max-w-56 flex-col items-start gap-1 rounded-xl border bg-card px-3 py-2 text-left",
          "cursor-pointer transition-colors hover:bg-accent/50",
          st ? st.cls : "border-border/70",
          parked && "ring-2 ring-amber-500/50",
          selected && "ring-2 ring-ring/60",
        )}
      >
        <span className="flex w-full items-center gap-1.5">
          <span className="text-[10px] tabular-nums text-muted-foreground">{step.index}</span>
          {step.gate && (
            <Shield aria-label="Human approval gate" className="size-3 text-amber-600 dark:text-amber-400" />
          )}
          <span className="truncate text-sm font-medium">{step.title}</span>
          <ProvenanceDot reviewed={step.provenance.reviewed} origin={step.provenance.origin} />
        </span>
        <span className="flex w-full items-center gap-1.5 text-[11px] text-muted-foreground">
          <KindIcon aria-hidden className="size-3 shrink-0" />
          <span className="truncate">{step.summary}</span>
        </span>
        {st && StateIcon && (
          <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", st.cls, "border-0")}>
            <StateIcon
              aria-hidden
              className={cn("size-3", state === "running" && "animate-pulse motion-reduce:animate-none")}
            />
            {st.label}
          </span>
        )}
      </button>
      {canGate && (
        <button
          type="button"
          aria-label={`Add approval gate before ${step.title}`}
          onClick={() => setGateOpen(true)}
          className={cn(
            "absolute -right-1 -top-1 z-10 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px]",
            "opacity-0 shadow-sm transition-opacity focus-visible:opacity-100 group-hover:opacity-100",
          )}
        >
          + gate
        </button>
      )}
      {gateOpen && onAddGate && (
        <GatePopover
          onAdd={() => { setGateOpen(false); onAddGate(step.id); }}
          onClose={() => setGateOpen(false)}
        />
      )}
    </div>
  );
}

function Connector() {
  return (
    <span aria-hidden className="mx-1 shrink-0 select-none text-muted-foreground/50">→</span>
  );
}

// ── checks ───────────────────────────────────────────────────────────────

const CHECK_STATE: Record<CheckRunState, { label: string; cls: string; icon?: typeof Check }> = {
  pending: { label: "Pending", cls: "text-muted-foreground" },
  passed: { label: "Passed", cls: "text-emerald-700 dark:text-emerald-400", icon: Check },
  failed: { label: "Failed", cls: "text-destructive", icon: X },
  unknown: { label: "Needs review", cls: "text-amber-600 dark:text-amber-400", icon: AlertTriangle },
  waiting: { label: "Approval required", cls: "text-amber-600 dark:text-amber-400", icon: ShieldAlert },
};

function CheckChip({ check, state, waiting, onOpen }: {
  check: DiagramCheck; state: CheckRunState | null; waiting?: boolean;
  onOpen?: (check: DiagramCheck) => void;
}) {
  const Icon = CHECK_ICON[check.kind] ?? Settings2;
  const st = state ? CHECK_STATE[state] : null;
  const StIcon = st?.icon;
  return (
    <button
      type="button"
      onClick={() => onOpen?.(check)}
      aria-label={`${check.kind === "assertion" ? "Assertion" : check.kind === "llm_judge" ? "Judge" : "Human approval"} check: ${check.label}.${st ? ` ${st.label}.` : ""}${!check.provenance.reviewed && check.provenance.origin !== "human" ? " AI-drafted and not reviewed." : ""}`}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
        "transition-colors hover:bg-accent/60",
        waiting ? "border-amber-500/70 ring-1 ring-amber-500/40" : "border-border/60",
      )}
    >
      <Icon aria-hidden className="size-3 shrink-0" />
      <span className="truncate">{check.label}</span>
      <ProvenanceDot reviewed={check.provenance.reviewed} origin={check.provenance.origin} />
      {st && (
        <span className={cn("inline-flex shrink-0 items-center gap-0.5 font-medium", st.cls)}>
          {StIcon && <StIcon aria-hidden className="size-3" />}
          {st.label}
        </span>
      )}
    </button>
  );
}

// ── budget meter ─────────────────────────────────────────────────────────

export function BudgetMeter({ costUsd, maxCostUsd, iterations, maxIterations }: {
  costUsd: number; maxCostUsd: number; iterations: number; maxIterations: number;
}) {
  const row = (label: string, used: number, cap: number, fmt: (n: number) => string) => {
    const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="w-16 text-muted-foreground">{label}</span>
        <span className="w-24 tabular-nums">{fmt(used)} / {fmt(cap)}</span>
        <span className="h-1.5 w-28 overflow-hidden rounded-full bg-muted" role="presentation">
          <span
            className={cn("block h-full rounded-full", pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary/70")}
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className="tabular-nums text-muted-foreground">{pct}%</span>
        {pct >= 100
          ? <span className="text-destructive">{label} cap reached</span>
          : pct >= 80 && <span className="text-amber-600 dark:text-amber-400">Approaching {label.toLowerCase()} cap</span>}
      </div>
    );
  };
  return (
    <div aria-label="Run budget" className="flex flex-col gap-1.5">
      {row("Cost", costUsd, maxCostUsd, (n) => `$${n.toFixed(2)}`)}
      {row("Iterations", iterations, maxIterations, (n) => String(Math.round(n)))}
    </div>
  );
}

// ── thumbnail (fleet badges) — planned things NEVER appear here ──────────

export function StackThumbnail({ model }: { model: DiagramModel }) {
  const badge = (icon: typeof Check, label: string, on: boolean) => {
    const Icon = icon;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
          on ? "border-border/70 text-foreground/85" : "border-border/40 text-muted-foreground/60",
        )}
      >
        {on ? <Icon aria-hidden className="size-3" /> : null}
        {label}
      </span>
    );
  };
  const t = model.badges.trigger;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Loop layers">
      {badge(GitBranch, "Work", model.badges.work)}
      {badge(BadgeCheck, model.badges.verified ? "Verified" : "Verify incomplete", model.badges.verified)}
      {t === "schedule" && badge(Timer, "Scheduled", true)}
      {t === "chat" && badge(MessageCircle, "Chat", true)}
      {t === "api" && badge(Play, "API", true)}
      {badge(FlaskConical, model.badges.improving ? "Improving" : "Improve off", model.badges.improving)}
    </div>
  );
}

// ── verdict strip (fleet) ────────────────────────────────────────────────

export function RunVerdictStrip({ runs }: {
  runs: Array<{ run_id: string; verdict?: string | null; status: string }>;
}) {
  if (!runs.length) return null;
  const glyph = (v: string | null | undefined, status: string) => {
    if (v === "passed") return { ch: "●", cls: "text-emerald-600", label: "passed" };
    if (v === "failed") return { ch: "×", cls: "text-destructive", label: "failed" };
    if (v === "needs_review") return { ch: "◆", cls: "text-amber-500", label: "needs review" };
    if (status === "awaiting_approval") return { ch: "◆", cls: "text-amber-500", label: "awaiting approval" };
    return { ch: "○", cls: "text-muted-foreground/60", label: status };
  };
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Recent runs: ${runs.map((r) => glyph(r.verdict, r.status).label).join(", ")}`}>
      {runs.slice(0, 12).map((r) => {
        const g = glyph(r.verdict, r.status);
        return <span key={r.run_id} aria-hidden className={cn("text-xs", g.cls)}>{g.ch}</span>;
      })}
    </span>
  );
}

// ── the stack itself ─────────────────────────────────────────────────────

export interface LoopStackProps {
  mode: "spec" | "run";
  model: DiagramModel;
  overlay?: RunOverlay | null;
  selectedId?: string | null;
  onStepOpen?: (step: DiagramStep) => void;
  onCheckOpen?: (check: DiagramCheck) => void;
  onTriggerOpen?: () => void;
  onEvalOpen?: () => void;
  onAddGate?: (stepId: string) => void;
}

export function LoopStack({
  mode, model, overlay, selectedId, onStepOpen, onCheckOpen, onTriggerOpen,
  onEvalOpen, onAddGate,
}: LoopStackProps) {
  const laneRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState({ before: 0, after: 0 });

  // Scroll affordance: "n earlier / n later" (design spec, mobile + 7-15 steps)
  useEffect(() => {
    const el = laneRef.current;
    if (!el) return;
    const update = () => {
      const kids = Array.from(el.querySelectorAll<HTMLElement>("[data-step]"));
      const { left, right } = el.getBoundingClientRect();
      let before = 0;
      let after = 0;
      for (const k of kids) {
        const r = k.getBoundingClientRect();
        if (r.right < left + 8) before += 1;
        else if (r.left > right - 8) after += 1;
      }
      setVisible({ before, after });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [model.steps.length]);

  const suite = model.improve.suite;
  const checksLine = (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      {model.verify.checks.map((c) => (
        <CheckChip
          key={c.index}
          check={c}
          state={overlay ? overlay.checkStates[c.index] : null}
          waiting={overlay?.parkedCheckIndex === c.index}
          onOpen={onCheckOpen}
        />
      ))}
      {model.verify.retryPlanned && (
        <PlannedCapability
          label="Retry"
          detail="automatically retry work after a failed verification verdict."
          icon={RefreshCcw}
        />
      )}
    </div>
  );

  return (
    <StackLayer
      label="Improve"
      summary={suite ? `${suite.cases} eval cases · ${suite.trials} trials per case · auto-eval on save` : "No eval suite yet"}
      tone="outer"
      extras={
        <>
          {suite && (
            <button
              type="button"
              onClick={onEvalOpen}
              className="rounded-md border border-border/60 px-2 py-0.5 text-[11px] hover:bg-accent/60"
            >
              Open evals
            </button>
          )}
          {model.improve.analystPlanned && (
            <PlannedCapability
              label="Analyst"
              detail="an AI analyst that reads run traces and proposes improvements."
              icon={FlaskConical}
            />
          )}
        </>
      }
    >
      <StackLayer
        label="Verify"
        summary={`${model.verify.checks.length} check${model.verify.checks.length === 1 ? "" : "s"}`}
        tone="inner"
      >
        {checksLine}
        <StackLayer label="Work" tone="work">
          <div
            ref={laneRef}
            className="flex items-center gap-1 overflow-x-auto pb-1"
            role="list"
            aria-label={`Work lane: ${model.steps.length} steps`}
          >
            <TriggerNode
              model={model.trigger}
              fired={mode === "run" && overlay?.firedTrigger != null}
              onOpen={onTriggerOpen}
            />
            <Connector />
            {model.steps.map((s) => (
              <span key={s.id} data-step role="listitem" className="flex items-center">
                <StepNode
                  step={s}
                  state={overlay ? overlay.stepStates[s.id] ?? "pending" : null}
                  mode={mode}
                  parked={overlay?.parkedStepId === s.id}
                  selected={selectedId === s.id}
                  onOpen={onStepOpen}
                  onAddGate={mode === "spec" ? onAddGate : undefined}
                />
                <Connector />
              </span>
            ))}
            <span
              className={cn(
                "shrink-0 rounded-xl border border-border/60 px-3 py-2 text-xs",
                overlay?.verdict === "passed" && "border-emerald-600/50 text-emerald-700 dark:text-emerald-400",
                overlay?.verdict === "failed" && "border-destructive/60 text-destructive",
                overlay?.verdict === "needs_review" && "border-amber-500/70 text-amber-600 dark:text-amber-400",
              )}
              aria-label={`Exit: ${model.exitProse || "done"}${overlay?.verdict ? `. Verdict ${overlay.verdict}.` : ""}`}
            >
              Exit{overlay?.verdict ? ` · ${overlay.verdict === "needs_review" ? "needs review" : overlay.verdict}` : ""}
              {model.exitProse && (
                <span className="block max-w-40 truncate text-[10px] text-muted-foreground">
                  {model.exitProse}
                </span>
              )}
            </span>
          </div>
          {(visible.before > 0 || visible.after > 0) && (
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>{visible.before > 0 ? `← ${visible.before} earlier` : ""}</span>
              <span>{visible.after > 0 ? `${visible.after} later →` : ""}</span>
            </div>
          )}
        </StackLayer>
      </StackLayer>
      {mode === "run" && overlay && (
        <div className="mt-3">
          <BudgetMeter {...overlay.budget} />
        </div>
      )}
    </StackLayer>
  );
}
