// Create New Corpus — the five steps (docs/25 screens 2-3).
//
// WHERE THE CORPUS ACTUALLY GETS CREATED
//
// At the end of step 1, not at the end of step 5. Everything after Purpose
// needs a corpus_id to attach to: sources upload INTO one, the schema is
// proposed from one's media, publish indexes one. A wizard that held all five
// steps in memory and wrote at the end would have to invent a second, offline
// version of every one of those operations.
//
// The cost of that choice, stated plainly: abandoning the wizard after step 1
// leaves a draft corpus with no sources. That is the right failure — it shows
// up on the dashboard as a Draft with "0 sources", which is true and
// recoverable, where the alternative is losing an interview somebody just sat
// through.
//
// THE STEPS ARE NOT A STATE MACHINE
//
// `furthest` only ever grows. Going back to reword a purpose must not delete
// the sources already uploaded, and it does not, because the uploads live on
// the server the moment they finish rather than in this component.

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

import {
  completeInterview,
  fetchWizardSteps,
  type WizardStep,
} from "@/services/corpus-video-service";
import { PublishStep, ReviewStep, SchemaStep } from "./finish";
import { EMPTY_DRAFT, PurposeStep, type PurposeDraft } from "./purpose";
import { SourcesStep } from "./sources";
import { Stepper } from "./stepper";

// The five, hardcoded as a fallback. The server owns the real list, but a
// stepper that fails to render because a metadata call timed out would block
// the whole flow on the least important request in it.
const FALLBACK: WizardStep[] = [
  { key: "purpose", label: "Purpose", blurb: "What the assistant should be able to do" },
  { key: "sources", label: "Sources", blurb: "The material it will answer from" },
  { key: "schema", label: "Schema", blurb: "What to extract from every item" },
  { key: "review", label: "Review", blurb: "Check a sample before the whole corpus runs" },
  { key: "publish", label: "Publish", blurb: "Index it, and prove an agent can reach it" },
];

export function CreateWizard({
  onCancel,
  onOpenCorpus,
}: {
  onCancel: () => void;
  onOpenCorpus: (corpusId: string) => void;
}) {
  const [steps, setSteps] = useState<WizardStep[]>(FALLBACK);
  const [at, setAt] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [draft, setDraft] = useState<PurposeDraft>(EMPTY_DRAFT);
  const [corpusId, setCorpusId] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const out = await fetchWizardSteps();
        if (out.steps?.length) setSteps(out.steps);
      } catch {
        // The fallback is the same five. Nothing to report.
      }
    })();
  }, []);

  const advance = (to: number) => {
    setAt(to);
    setFurthest((f) => Math.max(f, to));
  };

  const finishPurpose = async () => {
    // Idempotent by guard rather than by endpoint: going back to step 1 and
    // forward again must not mint a second corpus from the same interview.
    if (corpusId) {
      advance(1);
      return;
    }
    setCreating(true);
    setError("");
    try {
      const out = await completeInterview({
        name: draft.name,
        purpose: draft.purpose,
        audience: draft.audience,
        questions: draft.questions,
        avoid: draft.avoid,
        focus: draft.focus,
        template: draft.template,
      });
      setCorpusId(out.corpus.corpus_id);
      advance(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={13} /> Corpora
        </button>
        <h2 className="text-sm font-semibold">
          New corpus
          {draft.name && <span className="font-normal text-muted-foreground"> · {draft.name}</span>}
        </h2>
      </div>

      <Stepper steps={steps} current={at} furthest={furthest} onGo={setAt} />

      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
      )}
      {creating && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" /> creating the corpus…
        </p>
      )}

      {at === 0 && (
        <PurposeStep draft={draft} onChange={setDraft} onContinue={() => void finishPurpose()} />
      )}

      {at === 1 && corpusId && (
        <SourcesStep
          corpusId={corpusId}
          instruction={draft.focus}
          onDone={() => advance(2)}
        />
      )}

      {at === 2 && corpusId && (
        <SchemaStep corpusId={corpusId} onContinue={() => advance(3)} />
      )}

      {at === 3 && corpusId && (
        <ReviewStep corpusId={corpusId} onContinue={() => advance(4)} />
      )}

      {at === 4 && corpusId && (
        <PublishStep corpusId={corpusId} onFinish={() => onOpenCorpus(corpusId)} />
      )}

      {at > 0 && !corpusId && (
        <p className="text-xs text-muted-foreground">
          Finish the purpose step first — everything after it attaches to a
          corpus, and there is not one yet.
        </p>
      )}
    </div>
  );
}
