/**
 * Loop Stack integration pieces (docs/37 §5.4, design spec screens 2/3/6):
 *
 *  - LoopStackSection: the spec-mode diagram on the loop detail page, with
 *    the provenance counter, the step/check drawers ("mark reviewed",
 *    provenance history), and the two-click gate flow wired to a real spec
 *    save (a gate edit IS a spec edit and versions normally).
 *  - RunStackSection: the run-mode diagram above a run's detail, animated
 *    from the polled/streamed run doc.
 *
 * Structure is never edited here — the drawers configure and vouch; the SOP
 * remains the source of truth (design spec §9).
 */

import { Loader2, Shield } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  buildDiagramModel, buildRunOverlay, DiagramCheck, DiagramStep, LoopSpecT,
  RunDoc, SuiteSummary,
} from "@/lib/loop-stack/model";
import { listSuites, reviewLoopElements, updateLoopSpec } from "@/services/loops-service";

import { LoopStack, ProvenanceSummary } from "./loop-stack";

// ── drawers ──────────────────────────────────────────────────────────────

function ProvenanceBlock({ provenance, onReview, busy }: {
  provenance: { origin: string; reviewed: boolean; reviewedBy?: string | null; reviewedAt?: string | null };
  onReview?: () => void;
  busy?: boolean;
}) {
  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Provenance</p>
      {provenance.reviewed ? (
        <p className="mt-1 text-sm">
          ✓ Reviewed by {provenance.reviewedBy}
          {provenance.reviewedAt && (
            <span className="text-muted-foreground"> · {new Date(provenanceDate(provenance.reviewedAt)).toLocaleString()}</span>
          )}
        </p>
      ) : provenance.origin === "human" ? (
        <p className="mt-1 text-sm">Authored by a human — counts as reviewed.</p>
      ) : (
        <>
          <p className="mt-1 flex items-center gap-1.5 text-sm">
            <span aria-hidden className="size-2 rounded-full bg-violet-500/80" />
            Drafted by {provenance.origin} · not yet reviewed
          </p>
          {onReview && (
            <Button size="sm" variant="outline" className="mt-2" disabled={busy} onClick={onReview}>
              {busy ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
              {busy ? "Marking reviewed…" : "Mark reviewed"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function provenanceDate(v: string): string { return v; }

function StepDrawer({ step, loop, runInfo, onClose, onReview, reviewBusy }: {
  step: DiagramStep;
  loop: LoopSpecT;
  runInfo?: { state?: string; history: Array<{ phase: string; note?: string; at?: string }> } | null;
  onClose: () => void;
  onReview: (t: { kind: "step"; id: string }) => Promise<void>;
  reviewBusy: boolean;
}) {
  const raw = (loop.steps || []).find((s) => s.id === step.id);
  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {step.gate && <Shield aria-hidden className="size-4 text-amber-600" />}
            {step.title}
          </SheetTitle>
          <SheetDescription>
            Step {step.index} of {loop.steps.length} · {step.kind}
            {runInfo?.state ? ` · ${runInfo.state}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 px-4 pb-6 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Configuration</p>
            <pre className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-2 text-xs">
              {JSON.stringify(raw?.config ?? {}, null, 1)}
            </pre>
            {step.gate && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <Shield aria-hidden className="size-3" />
                {step.gate.type === "guard"
                  ? "A person must approve before this step runs."
                  : "This step IS a human approval."}
              </p>
            )}
          </div>

          {runInfo && runInfo.history.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                This run
              </p>
              <ul className="mt-1 space-y-0.5 text-xs">
                {runInfo.history.map((h, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-24 shrink-0 text-muted-foreground">{h.phase}</span>
                    <span className="min-w-0 break-words">{h.note || (h.at ? new Date(h.at).toLocaleTimeString() : "")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ProvenanceBlock
            provenance={step.provenance}
            busy={reviewBusy}
            onReview={step.provenance.reviewed || step.provenance.origin === "human"
              ? undefined
              : () => onReview({ kind: "step", id: step.id })}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CheckDrawer({ check, loop, onClose, onReview, reviewBusy }: {
  check: DiagramCheck;
  loop: LoopSpecT;
  onClose: () => void;
  onReview: (t: { kind: "check"; index: number }) => Promise<void>;
  reviewBusy: boolean;
}) {
  const raw = (loop.exit?.checks || [])[check.index];
  const kindLabel = check.kind === "assertion" ? "Assertion"
    : check.kind === "llm_judge" ? "LLM Judge" : "Human approval";
  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{check.label}</SheetTitle>
          <SheetDescription>{kindLabel} · exit check {check.index + 1} of {loop.exit.checks.length}</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-6 text-sm">
          <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-2 text-xs">
            {JSON.stringify(raw ?? {}, null, 1)}
          </pre>
          {check.kind === "llm_judge" && (
            <p className="text-xs text-muted-foreground">
              Verdicts: passed · failed · needs_review. The judge runs in a clean
            context — rubric + final state only.
            </p>
          )}
          <ProvenanceBlock
            provenance={check.provenance}
            busy={reviewBusy}
            onReview={check.provenance.reviewed || check.provenance.origin === "human"
              ? undefined
              : () => onReview({ kind: "check", index: check.index })}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── spec mode section ────────────────────────────────────────────────────

export function LoopStackSection({ loop, loopId, onChanged, onOpenEvals }: {
  loop: LoopSpecT & Record<string, any>;
  loopId: string;
  onChanged: () => void;
  onOpenEvals?: () => void;
}) {
  const [suite, setSuite] = useState<SuiteSummary | null>(null);
  const [openStep, setOpenStep] = useState<DiagramStep | null>(null);
  const [openCheck, setOpenCheck] = useState<DiagramCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    listSuites(loopId).then((d: any) => {
      const s = (d.suites || [])[0];
      if (s) {
        // list_suites returns cases as a COUNT, not a list.
        setSuite({
          suite_id: s.suite_id,
          cases: Number(s.cases || 0),
          trials: s.trials_per_case ?? s.trials ?? 3,
          threshold: s.pass_threshold,
        });
      }
    }).catch(() => {});
  }, [loopId, loop.version]);

  const model = useMemo(() => buildDiagramModel(loop, suite), [loop, suite]);

  const review = useCallback(async (t: { kind: "step" | "check"; id?: string; index?: number }) => {
    setBusy(true);
    setNote(null);
    try {
      await reviewLoopElements(loopId, [t]);
      setNote("Marked as reviewed");
      setOpenStep(null);
      setOpenCheck(null);
      onChanged();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save review");
    } finally {
      setBusy(false);
    }
  }, [loopId, onChanged]);

  const addGate = useCallback(async (stepId: string) => {
    setBusy(true);
    setNote(null);
    try {
      const spec = JSON.parse(JSON.stringify(loop));
      const step = (spec.steps || []).find((s: any) => s.id === stepId);
      if (!step) throw new Error(`step ${stepId} not found`);
      step.guard = "human_approval";
      await updateLoopSpec(loopId, spec, `Added human approval gate before '${stepId}'`);
      setNote("Human approval gate added");
      onChanged();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not add gate");
    } finally {
      setBusy(false);
    }
  }, [loop, loopId, onChanged]);

  return (
    <div className="mt-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">Loop stack</h3>
        <span className="ml-auto">
          <ProvenanceSummary total={model.aiDraft.total} reviewed={model.aiDraft.reviewed} />
        </span>
      </div>
      {note && <p className="mb-2 text-xs text-muted-foreground">{note}</p>}
      <LoopStack
        mode="spec"
        model={model}
        onStepOpen={setOpenStep}
        onCheckOpen={setOpenCheck}
        onEvalOpen={onOpenEvals}
        onAddGate={busy ? undefined : addGate}
      />
      {openStep && (
        <StepDrawer
          step={openStep}
          loop={loop}
          onClose={() => setOpenStep(null)}
          onReview={review}
          reviewBusy={busy}
        />
      )}
      {openCheck && (
        <CheckDrawer
          check={openCheck}
          loop={loop}
          onClose={() => setOpenCheck(null)}
          onReview={review}
          reviewBusy={busy}
        />
      )}
    </div>
  );
}

// ── run mode section ─────────────────────────────────────────────────────

export function RunStackSection({ loop, run }: {
  loop: LoopSpecT & Record<string, any>;
  run: RunDoc;
}) {
  const [openStep, setOpenStep] = useState<DiagramStep | null>(null);
  const model = useMemo(() => buildDiagramModel(loop, null), [loop]);
  const overlay = useMemo(() => buildRunOverlay(run, loop), [run, loop]);

  const runInfo = openStep
    ? {
      state: overlay.stepStates[openStep.id],
      history: (run.history || []).filter((h) => h.step_id === openStep.id),
    }
    : null;

  return (
    <div>
      <LoopStack
        mode="run"
        model={model}
        overlay={overlay}
        onStepOpen={setOpenStep}
      />
      {openStep && (
        <StepDrawer
          step={openStep}
          loop={loop}
          runInfo={runInfo}
          onClose={() => setOpenStep(null)}
          onReview={async () => {}}
          reviewBusy={false}
        />
      )}
    </div>
  );
}
