/**
 * The Loop Stack diagram (docs/37 §2): states are icon+label (never color
 * alone), planned capabilities are visibly planned and disabled, provenance
 * dots mark unreviewed AI drafts, thumbnails never advertise planned
 * features, and the two-click gate flow works.
 */
import { fireEvent, render, screen } from "@testing-library/react";

import {
  BudgetMeter, LoopStack, RunVerdictStrip, StackThumbnail,
} from "../loop-stack";
import { buildDiagramModel, buildRunOverlay, LoopSpecT } from "@/lib/loop-stack/model";

const SPEC: LoopSpecT = {
  loop_id: "collections_followup",
  name: "Collections follow-up",
  status: "active",
  version: 3,
  trigger: { type: "schedule", cron: "0 9 * * *" },
  steps: [
    { id: "fetch", kind: "tool", config: { tool: "billing_read" } },
    { id: "draft", kind: "llm", name: "Draft reminders", config: { prompt: "Draft…" } },
    { id: "gate", kind: "wait_approval", config: { prompt: "Review drafts" } },
    { id: "send", kind: "tool", config: { tool: "whatsapp_send" }, guard: "human_approval" },
    { id: "log", kind: "llm", config: { prompt: "Log contacts" } },
  ],
  exit: {
    success_prose: "all invoices contacted",
    checks: [
      { kind: "assertion", field: "reminders", op: "not_empty", label: "All invoices contacted" },
      { kind: "llm_judge", rubric: "Tone is professional" },
      { kind: "human_approval", prompt: "Final sign-off" },
    ],
  },
  budgets: { max_iterations: 20, max_cost_usd: 1.0 },
};

const model = () => buildDiagramModel(SPEC, { cases: 10, trials: 3 });

describe("LoopStack spec mode", () => {
  test("renders layers, steps, checks, planned capabilities", () => {
    render(<LoopStack mode="spec" model={model()} />);
    expect(screen.getByText("Improve")).toBeInTheDocument();
    expect(screen.getByText("Verify")).toBeInTheDocument();
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Draft reminders")).toBeInTheDocument();
    expect(screen.getByText("All invoices contacted")).toBeInTheDocument();
    // Planned capabilities: visible, tagged, disabled.
    const retry = screen.getByLabelText(/Retry.*Planned capability/i);
    expect(retry).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByLabelText(/Analyst.*Planned capability/i)).toBeInTheDocument();
  });

  test("trigger shows the cron in plain language", () => {
    render(<LoopStack mode="spec" model={model()} />);
    expect(screen.getByText("Daily at 09:00 UTC")).toBeInTheDocument();
  });

  test("two-click gate: hover affordance then popover then callback", () => {
    const onAddGate = jest.fn();
    render(<LoopStack mode="spec" model={model()} onAddGate={onAddGate} />);
    // Click 1: the + gate affordance on an ungated step (fetch).
    fireEvent.click(screen.getByLabelText("Add approval gate before billing read"));
    // Click 2: confirm inside the popover.
    fireEvent.click(screen.getByRole("button", { name: "Add human approval" }));
    expect(onAddGate).toHaveBeenCalledWith("fetch");
  });

  test("gated and approval steps offer no gate affordance", () => {
    render(<LoopStack mode="spec" model={model()} onAddGate={jest.fn()} />);
    expect(screen.queryByLabelText(/Add approval gate before whatsapp send/)).toBeNull();
    expect(screen.queryByLabelText(/Add approval gate before Human approval/)).toBeNull();
  });

  test("step click opens the drawer callback", () => {
    const onStepOpen = jest.fn();
    render(<LoopStack mode="spec" model={model()} onStepOpen={onStepOpen} />);
    fireEvent.click(screen.getByLabelText(/Step 2\. Draft reminders/));
    expect(onStepOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "draft" }));
  });
});

describe("LoopStack run mode", () => {
  const parkedRun = {
    run_id: "r1",
    status: "awaiting_approval",
    trigger: "schedule",
    cost_usd: 0.14,
    iteration: 4,
    history: [
      { step_id: "fetch", phase: "started" }, { step_id: "fetch", phase: "finished" },
      { step_id: "draft", phase: "started" }, { step_id: "draft", phase: "finished" },
    ],
    pending_approval: { step_id: "gate", prompt: "Review drafts" },
  };

  test("parked run shows the shield on the gate and states with labels", () => {
    const overlay = buildRunOverlay(parkedRun, SPEC);
    render(<LoopStack mode="run" model={model()} overlay={overlay} />);
    expect(screen.getAllByText("Done")).toHaveLength(2);
    expect(screen.getByText("Approval required")).toBeInTheDocument();
    expect(screen.getAllByText("Pending").length).toBeGreaterThanOrEqual(2);
    // Budget meter renders both meters.
    expect(screen.getByText("$0.14 / $1.00")).toBeInTheDocument();
    expect(screen.getByText("4 / 20")).toBeInTheDocument();
  });

  test("no gate affordance in run mode", () => {
    const overlay = buildRunOverlay(parkedRun, SPEC);
    render(<LoopStack mode="run" model={model()} overlay={overlay} onAddGate={jest.fn()} />);
    expect(screen.queryByLabelText(/Add approval gate/)).toBeNull();
  });
});

describe("StackThumbnail — honesty rule", () => {
  test("shows only real layers, never planned features", () => {
    render(<StackThumbnail model={model()} />);
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText("Improving")).toBeInTheDocument();
    expect(screen.queryByText(/planned/i)).toBeNull();
    expect(screen.queryByText(/Webhook/)).toBeNull();
  });

  test("missing layers read as honest absences", () => {
    const bare = buildDiagramModel(
      { ...SPEC, trigger: { type: "manual" }, exit: { checks: [] } }, null);
    render(<StackThumbnail model={bare} />);
    expect(screen.getByText("Verify incomplete")).toBeInTheDocument();
    expect(screen.getByText("Improve off")).toBeInTheDocument();
    expect(screen.queryByText("Scheduled")).toBeNull();
  });
});

describe("BudgetMeter thresholds", () => {
  test("warns at 80% and reports cap reached at 100%", () => {
    const { rerender } = render(
      <BudgetMeter costUsd={0.85} maxCostUsd={1} iterations={2} maxIterations={20} />);
    expect(screen.getByText("Approaching cost cap")).toBeInTheDocument();
    rerender(
      <BudgetMeter costUsd={1.2} maxCostUsd={1} iterations={2} maxIterations={20} />);
    expect(screen.getByText("Cost cap reached")).toBeInTheDocument();
  });
});

describe("RunVerdictStrip", () => {
  test("categorical glyphs with accessible summary", () => {
    render(<RunVerdictStrip runs={[
      { run_id: "a", verdict: "passed", status: "completed" },
      { run_id: "b", verdict: "failed", status: "completed" },
      { run_id: "c", verdict: null, status: "awaiting_approval" },
    ]} />);
    expect(screen.getByLabelText(
      "Recent runs: passed, failed, awaiting approval")).toBeInTheDocument();
  });
});
