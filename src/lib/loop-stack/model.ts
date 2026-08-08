/**
 * Loop Stack diagram model (docs/37 §3) — two PURE functions and their types.
 *
 * buildDiagramModel(spec)  → what the loop IS (structure, provenance, layers)
 * buildRunOverlay(run)     → what a run is DOING (per-element runtime state)
 *
 * Both derive entirely from payloads the API already returns. No new state
 * store; the diagram component renders model + overlay and nothing else.
 * Platform maturity is declared in CAPABILITIES — the honesty rule (docs/37
 * §1) says the UI must never advertise what the engine cannot do, so
 * designed-but-unbuilt features render from here as `planned`.
 */

import { Cron, describeCron } from "./cron";

// ── Platform capabilities (flip when the docs/36 fix ships) ──────────────
export const CAPABILITIES = {
  retryOnFail: false, // docs/36 #3
  inboundWebhook: false, // docs/36 #2
  analyst: false, // docs/36 #4
  emailSlackApproval: false, // docs/36 #8
};

// ── Spec-side types (mirror chatservice/services/loops/models.py) ────────

export interface ProvenanceT {
  origin: "compiler" | "human" | "fixer" | "analyst";
  at?: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
}

export type StepKind =
  | "llm" | "tool" | "branch" | "wait_approval" | "extract" | "wait_event"
  | "agent";

export interface SpecStep {
  id: string;
  kind: StepKind;
  name?: string;
  config?: Record<string, any>;
  guard?: string | null;
  provenance?: ProvenanceT | null;
}

export type CheckKind = "assertion" | "llm_judge" | "human_approval";

export interface SpecCheck {
  kind: CheckKind;
  label?: string;
  field?: string;
  op?: string;
  value?: any;
  rubric?: string;
  prompt?: string;
  provenance?: ProvenanceT | null;
  [k: string]: any;
}

export interface LoopSpecT {
  loop_id: string;
  name: string;
  status: "draft" | "active" | "archived";
  version: number;
  source_sop?: string;
  trigger: { type: "manual" | "api" | "schedule" | "chat"; cron?: string | null; description?: string };
  state_schema?: Record<string, any>;
  steps: SpecStep[];
  exit: { success_prose?: string; checks: SpecCheck[] };
  budgets?: { max_iterations?: number; max_cost_usd?: number };
  [k: string]: any;
}

// ── Diagram model ────────────────────────────────────────────────────────

export interface ElementProvenance {
  origin: ProvenanceT["origin"];
  reviewed: boolean;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}

export interface DiagramStep {
  id: string;
  kind: StepKind;
  title: string;
  summary: string;
  index: number; // 1-based display index
  gate: null | { type: "guard" | "wait_approval" };
  event?: { key: string; timeoutMinutes?: number | null };
  branch?: { then: string; otherwise: string; condition: string };
  provenance: ElementProvenance;
}

export interface DiagramCheck {
  index: number;
  kind: CheckKind;
  label: string;
  provenance: ElementProvenance;
}

export interface SuiteSummary {
  suite_id?: string;
  cases: number;
  trials: number;
  threshold?: number;
  lastGate?: "passed" | "failed" | null;
}

export interface DiagramModel {
  trigger: {
    type: LoopSpecT["trigger"]["type"] | "webhook";
    label: string;
    cron?: string | null;
    nextFire?: string | null; // ISO UTC
    planned?: boolean;
  };
  steps: DiagramStep[];
  verify: {
    checks: DiagramCheck[];
    retryPlanned: boolean;
  };
  improve: {
    suite: SuiteSummary | null;
    autoEvalOnSave: boolean;
    analystPlanned: boolean;
  };
  exitProse: string;
  /** Layer badge row for thumbnails — planned things never appear here. */
  badges: { work: boolean; verified: boolean; trigger: string | null; improving: boolean };
  aiDraft: { total: number; reviewed: number };
}

const KIND_TITLES: Record<StepKind, string> = {
  llm: "LLM step",
  tool: "Tool",
  branch: "Decision",
  wait_approval: "Human approval",
  extract: "Extract",
  wait_event: "Wait for event",
  agent: "Agent",
};

function provenanceOf(p?: ProvenanceT | null): ElementProvenance {
  // Missing stamp = pre-provenance spec: compiler-authored, unreviewed —
  // the honest default (docs/37 §4.1).
  if (!p) return { origin: "compiler", reviewed: false };
  return {
    origin: p.origin,
    reviewed: Boolean(p.reviewed_by),
    reviewedBy: p.reviewed_by ?? null,
    reviewedAt: p.reviewed_at ?? null,
  };
}

function stepTitle(s: SpecStep): string {
  if (s.name) return s.name;
  const c = s.config || {};
  if (s.kind === "tool" && c.tool) return String(c.tool).replace(/_/g, " ");
  if (s.kind === "agent" && c.agent_id) return `Agent: ${c.agent_id}`;
  if (s.kind === "wait_event") return `Wait: ${c.event_key || "event"}`;
  if (s.kind === "wait_approval") return "Human approval";
  if (s.kind === "extract") return `Extract ${c.output_field || ""}`.trim();
  if (s.kind === "llm" && c.output_field) return `Write ${c.output_field}`;
  return s.id.replace(/_/g, " ");
}

function stepSummary(s: SpecStep): string {
  const c = s.config || {};
  switch (s.kind) {
    case "llm": {
      const p = String(c.prompt || "");
      return p.length > 70 ? `${p.slice(0, 67)}…` : p || "LLM step";
    }
    case "tool":
      return `Tool · ${c.tool || "unconfigured"}`;
    case "branch": {
      const cond = c.condition || {};
      return `If ${cond.field || "?"} ${cond.op || "?"}${cond.value !== undefined ? ` ${JSON.stringify(cond.value)}` : ""}`;
    }
    case "wait_approval":
      return c.prompt || "Run pauses until approved";
    case "extract":
      return `Map-reduce ${c.source_field || "?"} → ${c.output_field || "?"}`;
    case "wait_event":
      return c.timeout_minutes
        ? `Waits for '${c.event_key}' · timeout ${c.timeout_minutes}m`
        : `Waits for '${c.event_key || "event"}'`;
    case "agent":
      return `Delegates to ${c.agent_id || "?"}`;
    default:
      return KIND_TITLES[s.kind] ?? s.kind;
  }
}

function checkLabel(c: SpecCheck): string {
  if (c.label) return c.label;
  if (c.kind === "assertion") return `${c.field} ${c.op}${c.value !== undefined && c.value !== null ? ` ${JSON.stringify(c.value)}` : ""}`;
  if (c.kind === "llm_judge") {
    const r = String(c.rubric || "");
    return r.length > 60 ? `${r.slice(0, 57)}…` : r || "LLM judge";
  }
  return c.prompt || "Human approval";
}

function triggerLabel(t: LoopSpecT["trigger"]): string {
  switch (t.type) {
    case "schedule":
      return t.cron ? describeCron(t.cron) : "Schedule (no cron set)";
    case "chat":
      return "Chat (WhatsApp)";
    case "api":
      return "API";
    default:
      return "Manual";
  }
}

export function buildDiagramModel(
  spec: LoopSpecT,
  suite?: SuiteSummary | null,
): DiagramModel {
  let nextFire: string | null = null;
  if (spec.trigger.type === "schedule" && spec.trigger.cron) {
    try {
      nextFire = new Cron(spec.trigger.cron).nextFires(new Date(), 1)[0]
        ?.toISOString() ?? null;
    } catch {
      nextFire = null;
    }
  }

  const steps: DiagramStep[] = (spec.steps || []).map((s, i) => ({
    id: s.id,
    kind: s.kind,
    title: stepTitle(s),
    summary: stepSummary(s),
    index: i + 1,
    gate: s.kind === "wait_approval"
      ? { type: "wait_approval" as const }
      : s.guard === "human_approval"
        ? { type: "guard" as const }
        : null,
    ...(s.kind === "wait_event"
      ? { event: { key: String(s.config?.event_key || "event"), timeoutMinutes: s.config?.timeout_minutes ?? null } }
      : {}),
    ...(s.kind === "branch"
      ? {
        branch: {
          then: String(s.config?.then || "?"),
          otherwise: String(s.config?.["else"] || "?"),
          condition: stepSummary(s),
        },
      }
      : {}),
    provenance: provenanceOf(s.provenance),
  }));

  const checks: DiagramCheck[] = (spec.exit?.checks || []).map((c, i) => ({
    index: i,
    kind: c.kind,
    label: checkLabel(c),
    provenance: provenanceOf(c.provenance),
  }));

  const drafted = [
    ...steps.map((s) => s.provenance),
    ...checks.map((c) => c.provenance),
  ].filter((p) => p.origin !== "human");

  return {
    trigger: {
      type: spec.trigger.type,
      label: triggerLabel(spec.trigger),
      cron: spec.trigger.cron ?? null,
      nextFire,
    },
    steps,
    verify: { checks, retryPlanned: !CAPABILITIES.retryOnFail },
    improve: {
      suite: suite ?? null,
      autoEvalOnSave: true, // platform default on the save endpoint
      analystPlanned: !CAPABILITIES.analyst,
    },
    exitProse: spec.exit?.success_prose || "",
    badges: {
      work: (spec.steps || []).length > 0,
      verified: checks.length > 0,
      trigger: spec.trigger.type === "manual" ? null : spec.trigger.type,
      improving: Boolean(suite && suite.cases > 0),
    },
    aiDraft: {
      total: drafted.length,
      reviewed: drafted.filter((p) => p.reviewed).length,
    },
  };
}

// ── Run overlay ──────────────────────────────────────────────────────────

export type StepRunState =
  | "done" | "running" | "pending" | "failed" | "awaiting_approval"
  | "awaiting_event" | "skipped";

export type CheckRunState = "pending" | "passed" | "failed" | "unknown" | "waiting";

export interface RunDoc {
  run_id: string;
  status: string;
  exit_reason?: string | null;
  verdict?: string | null;
  trigger?: string;
  dry_run?: boolean;
  state?: Record<string, any>;
  history?: Array<{ step_id: string; phase: string; note?: string; at?: string; kind?: string }>;
  pending_approval?: { step_id: string; prompt?: string; requested_at?: string } | null;
  pending_event?: { step_id: string; event_key?: string; timeout_minutes?: number; requested_at?: string } | null;
  check_results?: Array<{ passed?: boolean | null; verdict?: string; kind?: string; type?: string; evidence?: any; [k: string]: any }>;
  cost_usd?: number;
  iteration?: number;
  [k: string]: any;
}

export interface RunOverlay {
  runStatus: string;
  verdict: string | null;
  stepStates: Record<string, StepRunState>;
  /** step_id → true when the amber shield belongs on the step (gate parked) */
  parkedStepId: string | null;
  parkedPrompt: string | null;
  /** which exit check index a verification human-gate is parked on, if any */
  parkedCheckIndex: number | null;
  checkStates: CheckRunState[];
  event: { stepId: string; key: string; deadline: string | null } | null;
  budget: { costUsd: number; maxCostUsd: number; iterations: number; maxIterations: number };
  firedTrigger: string | null;
}

export function buildRunOverlay(run: RunDoc, spec: LoopSpecT): RunOverlay {
  const stepStates: Record<string, StepRunState> = {};
  for (const s of spec.steps || []) stepStates[s.id] = "pending";

  for (const h of run.history || []) {
    const id = h.step_id;
    if (!(id in stepStates)) continue;
    switch (h.phase) {
      case "started":
        stepStates[id] = "running";
        break;
      case "finished":
        stepStates[id] = "done";
        break;
      case "failed":
        stepStates[id] = "failed";
        break;
      case "parked_event":
        stepStates[id] = "awaiting_event";
        break;
      case "event_timeout":
        stepStates[id] = "awaiting_approval";
        break;
      case "skipped":
        stepStates[id] = "skipped";
        break;
      default:
        break;
    }
  }

  let parkedStepId: string | null = null;
  let parkedCheckIndex: number | null = null;
  const pa = run.pending_approval;
  if (run.status === "awaiting_approval" && pa?.step_id) {
    if (pa.step_id.startsWith("__check__:")) {
      parkedCheckIndex = Number(pa.step_id.split(":")[1]);
    } else {
      parkedStepId = pa.step_id;
      if (pa.step_id in stepStates) stepStates[pa.step_id] = "awaiting_approval";
    }
  }

  let event: RunOverlay["event"] = null;
  const pe = run.pending_event;
  if (run.status === "awaiting_event" && pe?.step_id) {
    stepStates[pe.step_id] = "awaiting_event";
    let deadline: string | null = null;
    if (pe.timeout_minutes && pe.requested_at) {
      const d = new Date(pe.requested_at);
      if (!Number.isNaN(d.getTime())) {
        deadline = new Date(d.getTime() + pe.timeout_minutes * 60_000).toISOString();
      }
    }
    event = { stepId: pe.step_id, key: pe.event_key || "event", deadline };
  }

  // A run that ended mid-step (crash) leaves "running" rows; a COMPLETED or
  // FAILED run must not show anything as still running.
  if (["completed", "failed", "cancelled"].includes(run.status)) {
    for (const [id, st] of Object.entries(stepStates)) {
      if (st === "running") stepStates[id] = run.status === "completed" ? "done" : "failed";
    }
  }

  const checkStates: CheckRunState[] = (spec.exit?.checks || []).map((_, i) => {
    if (parkedCheckIndex === i) return "waiting";
    const r = (run.check_results || [])[i];
    if (!r) return "pending";
    if (r.passed === true || r.verdict === "pass" || r.verdict === "passed") return "passed";
    if (r.passed === false || r.verdict === "fail" || r.verdict === "failed") return "failed";
    if (r.verdict === "unknown" || r.verdict === "skipped") return "unknown";
    return "pending";
  });

  return {
    runStatus: run.status,
    verdict: run.verdict ?? null,
    stepStates,
    parkedStepId,
    parkedPrompt: pa?.prompt ?? null,
    parkedCheckIndex,
    checkStates,
    event,
    budget: {
      costUsd: Number(run.cost_usd || 0),
      maxCostUsd: Number(spec.budgets?.max_cost_usd || 0),
      iterations: Number(run.iteration || 0),
      maxIterations: Number(spec.budgets?.max_iterations || 0),
    },
    firedTrigger: run.trigger ?? null,
  };
}
