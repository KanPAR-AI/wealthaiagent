/**
 * The diagram model is a pure function of the spec; the run overlay is a pure
 * function of the run doc (docs/37 §3). These tests use the docs/37
 * "Collections follow-up" example: schedule daily 09:00 UTC, 5 steps with a
 * human gate, 3 checks, one run parked at the gate.
 */
import {
  buildDiagramModel,
  buildRunOverlay,
  LoopSpecT,
  RunDoc,
} from "../model";

const SPEC: LoopSpecT = {
  loop_id: "collections_followup",
  name: "Collections follow-up",
  status: "active",
  version: 3,
  source_sop: "Every day at 09:00…",
  trigger: { type: "schedule", cron: "0 9 * * *" },
  state_schema: { invoices: {}, reminders: {} },
  steps: [
    { id: "fetch", kind: "tool", config: { tool: "billing_read" },
      provenance: { origin: "compiler", at: "t", reviewed_by: "ravi", reviewed_at: "t" } },
    { id: "draft", kind: "llm", name: "Draft reminders",
      config: { prompt: "Draft a professional reminder for each overdue invoice", output_field: "reminders" },
      provenance: { origin: "compiler", at: "t" } },
    { id: "gate", kind: "wait_approval", config: { prompt: "Review drafts" } },
    { id: "send", kind: "tool", config: { tool: "whatsapp_send" }, guard: "human_approval",
      provenance: { origin: "human", at: "t", reviewed_by: "ravi", reviewed_at: "t" } },
    { id: "log", kind: "llm", config: { prompt: "Log contacts" } },
  ],
  exit: {
    success_prose: "all invoices contacted",
    checks: [
      { kind: "assertion", field: "reminders", op: "not_empty", label: "All invoices contacted" },
      { kind: "llm_judge", rubric: "Tone is professional", provenance: { origin: "compiler", at: "t" } },
      { kind: "human_approval", prompt: "Final sign-off" },
    ],
  },
  budgets: { max_iterations: 20, max_cost_usd: 1.0 },
};

describe("buildDiagramModel", () => {
  const m = buildDiagramModel(SPEC, { cases: 10, trials: 3 });

  test("trigger describes the cron and computes a next fire", () => {
    expect(m.trigger.type).toBe("schedule");
    expect(m.trigger.label).toBe("Daily at 09:00 UTC");
    expect(m.trigger.nextFire).toMatch(/T09:00:00/);
  });

  test("steps carry index, gates and summaries", () => {
    expect(m.steps).toHaveLength(5);
    expect(m.steps[2].gate).toEqual({ type: "wait_approval" });
    expect(m.steps[3].gate).toEqual({ type: "guard" });
    expect(m.steps[0].summary).toBe("Tool · billing_read");
    expect(m.steps[1].title).toBe("Draft reminders");
  });

  test("planned capabilities come from the capability map, never the spec", () => {
    expect(m.verify.retryPlanned).toBe(true);
    expect(m.improve.analystPlanned).toBe(true);
  });

  test("badge row includes only what exists — honesty rule", () => {
    expect(m.badges).toEqual({
      work: true, verified: true, trigger: "schedule", improving: true,
    });
  });

  test("ai-draft counter: human-origin elements are not drafts", () => {
    // 5 steps + 3 checks = 8 elements; step 'send' is origin human → 7 drafts.
    expect(m.aiDraft.total).toBe(7);
    // reviewed drafts: fetch (reviewed compiler). draft/gate/log/checks unreviewed.
    expect(m.aiDraft.reviewed).toBe(1);
  });

  test("unstamped legacy elements default to compiler/unreviewed", () => {
    expect(m.steps[4].provenance).toEqual({ origin: "compiler", reviewed: false });
  });
});

describe("buildRunOverlay", () => {
  const RUN: RunDoc = {
    run_id: "r1",
    status: "awaiting_approval",
    trigger: "schedule",
    cost_usd: 0.14,
    iteration: 4,
    history: [
      { step_id: "fetch", phase: "started" },
      { step_id: "fetch", phase: "finished" },
      { step_id: "draft", phase: "started" },
      { step_id: "draft", phase: "finished" },
    ],
    pending_approval: { step_id: "gate", prompt: "Review drafts" },
    state: { reminders: ["…17 drafts…"] },
  };

  const o = buildRunOverlay(RUN, SPEC);

  test("parked run: shield on the gate, done before, pending after", () => {
    expect(o.stepStates).toEqual({
      fetch: "done", draft: "done", gate: "awaiting_approval",
      send: "pending", log: "pending",
    });
    expect(o.parkedStepId).toBe("gate");
    expect(o.parkedPrompt).toBe("Review drafts");
  });

  test("checks are pending while the run is parked mid-work", () => {
    expect(o.checkStates).toEqual(["pending", "pending", "pending"]);
  });

  test("budget meter values", () => {
    expect(o.budget).toEqual({
      costUsd: 0.14, maxCostUsd: 1.0, iterations: 4, maxIterations: 20,
    });
  });

  test("verification human-gate parks on the CHECK, not a step", () => {
    const o2 = buildRunOverlay({
      ...RUN,
      history: SPEC.steps.flatMap((s) => [
        { step_id: s.id, phase: "started" }, { step_id: s.id, phase: "finished" },
      ]),
      pending_approval: { step_id: "__check__:2", prompt: "Final sign-off" },
    }, SPEC);
    expect(o2.parkedStepId).toBeNull();
    expect(o2.parkedCheckIndex).toBe(2);
    expect(o2.checkStates[2]).toBe("waiting");
  });

  test("awaiting_event computes the deadline from the park", () => {
    const o3 = buildRunOverlay({
      run_id: "r3", status: "awaiting_event",
      history: [{ step_id: "fetch", phase: "finished" }],
      pending_event: { step_id: "draft", event_key: "payment",
        timeout_minutes: 60, requested_at: "2026-08-08T09:00:00+00:00" },
    }, SPEC);
    expect(o3.event).toEqual({
      stepId: "draft", key: "payment", deadline: "2026-08-08T10:00:00.000Z",
    });
    expect(o3.stepStates.draft).toBe("awaiting_event");
  });

  test("a completed run never shows anything still running", () => {
    const o4 = buildRunOverlay({
      run_id: "r4", status: "completed", verdict: "passed",
      history: [
        { step_id: "fetch", phase: "started" },
        { step_id: "fetch", phase: "finished" },
        { step_id: "draft", phase: "started" }, // crashed mid-write, then resumed
      ],
      check_results: [
        { passed: true }, { verdict: "pass" }, { verdict: "unknown" },
      ],
    }, SPEC);
    expect(o4.stepStates.draft).toBe("done");
    expect(o4.checkStates).toEqual(["passed", "passed", "unknown"]);
    expect(o4.verdict).toBe("passed");
  });
});
