// Step 1 of 5 — Purpose (docs/25 screen 2).
//
// WHY AN INTERVIEW AND NOT A FORM
//
// The form this replaces asked "what should the assistant be able to do?",
// which still requires the person to know what a good answer looks like. The
// user this is built for is a physiotherapist who has said plainly they do not
// want to understand embeddings, chunking or prompts. A text box does not help
// them; being asked does.
//
// TWO THINGS THIS UI MUST NOT DO
//
// 1. It must not relabel the preview as a schema. The backend returns AREAS
//    on purpose — nothing has been uploaded yet, so promising a field the
//    footage cannot fill produces a column of nulls that reads as a processing
//    failure rather than an absence in the source. The caveat ships with the
//    payload and is rendered, not paraphrased.
//
// 2. It must not block on a follow-up. All four come back every turn and are
//    answerable in any order or skippable entirely. An interview that gates on
//    question two is a form with extra steps.

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Send, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  interviewTurn,
  startInterview,
  type InterviewTurn as Turn,
} from "@/services/corpus-video-service";

export interface PurposeDraft {
  name: string;
  purpose: string;
  audience: string;
  questions: string;
  avoid: string;
  focus: string;
  template: string;
}

export const EMPTY_DRAFT: PurposeDraft = {
  name: "", purpose: "", audience: "", questions: "", avoid: "", focus: "",
  template: "general",
};

export function PurposeStep({
  draft,
  onChange,
  onContinue,
}: {
  draft: PurposeDraft;
  onChange: (d: PurposeDraft) => void;
  onContinue: () => void;
}) {
  const [opening, setOpening] = useState<{ greeting: string; question: string } | null>(null);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [typing, setTyping] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string>("");
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        setOpening(await startInterview());
      } catch {
        // The opening is a fixed string on the server, so failing to fetch it
        // must not block the interview — the question matters, not who said it.
        setOpening({
          greeting: "I'm your Corpus Assistant.",
          question: "What kind of assistant do you want to create?",
        });
      }
    })();
  }, []);

  const answer = useCallback(async () => {
    const said = typing.trim();
    if (!said) return;
    setBusy(true);
    setError("");
    onChange({ ...draft, purpose: said });
    setTyping("");
    try {
      const t = await interviewTurn(said);
      setTurn(t);
      onChange({ ...draft, purpose: said, template: t.preview.template });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [typing, draft, onChange]);

  const ready = draft.name.trim().length > 0 && draft.purpose.trim().length > 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-start">
      {/* ── the conversation ─────────────────────────────────────────── */}
      <section className="space-y-3">
        {opening && (
          <Bubble>
            <p className="font-medium">{opening.greeting}</p>
            <p className="mt-1">{opening.question}</p>
          </Bubble>
        )}

        {draft.purpose && <Said>{draft.purpose}</Said>}

        {busy && (
          <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" /> thinking…
          </p>
        )}

        {turn && <Bubble>{turn.acknowledgement}</Bubble>}

        {!turn && (
          <div className="flex gap-2">
            <textarea
              value={typing}
              onChange={(e) => setTyping(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void answer();
              }}
              rows={3}
              placeholder="e.g. an assistant that recommends knee rehab exercises based on which recovery phase somebody is in"
              className="flex-1 rounded-lg border border-border bg-background px-2.5 py-2 text-xs"
            />
            <Button size="sm" onClick={() => void answer()} disabled={busy || !typing.trim()}>
              <Send size={13} />
            </Button>
          </div>
        )}

        {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

        {/* The four follow-ups: collapsible, answerable in any order, all
            optional. `why` is shown because "who is your audience?" reads as
            bureaucracy until you know the same footage answers a patient and a
            clinician differently. */}
        {turn && (
          <div className="space-y-1.5">
            {turn.follow_ups.map((f) => {
              const value = (draft as unknown as Record<string, string>)[f.key] ?? "";
              const isOpen = open === f.key;
              return (
                <div key={f.key} className="rounded-lg border border-border">
                  <button
                    onClick={() => setOpen(isOpen ? "" : f.key)}
                    className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs"
                  >
                    <ChevronDown
                      size={12}
                      className={`shrink-0 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`}
                    />
                    <span className="flex-1 font-medium">{f.question}</span>
                    {value && !isOpen && (
                      <span className="max-w-[12rem] truncate text-[11px] text-muted-foreground">
                        {value}
                      </span>
                    )}
                    {!value && (
                      <span className="text-[10px] text-muted-foreground">optional</span>
                    )}
                  </button>
                  {isOpen && (
                    <div className="border-t border-border px-2.5 py-2">
                      <p className="mb-1.5 text-[11px] text-muted-foreground">{f.why}</p>
                      <textarea
                        value={value}
                        onChange={(e) => onChange({ ...draft, [f.key]: e.target.value })}
                        rows={2}
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                        placeholder={
                          f.key === "questions"
                            ? "one per line — these become the only honest basis for evaluating the corpus"
                            : ""
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── the preview ──────────────────────────────────────────────── */}
      <aside className="space-y-3 lg:sticky lg:top-4">
        <div className="rounded-lg border border-border p-3">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Corpus name
          </label>
          <input
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            placeholder="Knee Rehab"
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          />
        </div>

        <div className="rounded-lg border border-border p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <Sparkles size={12} /> Assistant Preview
          </p>

          {!turn ? (
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Describe what you are building and this will fill in with the
              areas worth indexing.
            </p>
          ) : (
            <>
              <ul className="mt-2 space-y-1.5">
                {turn.preview.areas.map((a) => (
                  <li key={a.title} className="rounded-md bg-muted/40 px-2 py-1.5">
                    <p className="text-[11px] font-medium">{a.title}</p>
                    <p className="text-[11px] text-muted-foreground">{a.subtitle}</p>
                  </li>
                ))}
              </ul>
              {/* Rendered verbatim from the payload. Paraphrasing it is how a
                  preview quietly starts reading as a promise. */}
              <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                {turn.preview.caveat}
              </p>
            </>
          )}
        </div>

        <Button
          size="sm"
          className="w-full"
          disabled={!ready}
          onClick={onContinue}
          title={ready ? "" : "A corpus needs a name and a purpose before it can hold anything"}
        >
          Looks good, continue →
        </Button>
        {!ready && (
          <p className="text-[11px] text-muted-foreground">
            {draft.purpose.trim()
              ? "Give it a name."
              : "Tell the assistant what you are building."}
          </p>
        )}
      </aside>
    </div>
  );
}

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[36rem] rounded-lg rounded-tl-sm border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed">
      {children}
    </div>
  );
}

function Said({ children }: { children: React.ReactNode }) {
  return (
    <div className="ml-auto max-w-[36rem] rounded-lg rounded-tr-sm bg-primary/10 px-3 py-2 text-xs leading-relaxed">
      {children}
    </div>
  );
}
