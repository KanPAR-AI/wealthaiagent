// Ask about this corpus, and act on it.
//
// Separate from Jarvis on purpose: Jarvis is advisory and global — it answers
// from the help KB and links you somewhere. This one is scoped to the corpus on
// screen and CALLS TOOLS, so it has a blast radius Jarvis does not.
//
// THE TOOL TRACE IS PART OF THE ANSWER, not a debug affordance. An assistant
// that changes a corpus and reports only prose is asking to be trusted; one
// that shows `corpus_query {has_transcript: false} -> matched 30` can be
// checked against the corpus by the person reading it.

import { useRef, useState } from "react";
import { Bot, CornerDownLeft, Loader2, Terminal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { askCorpusAssistant, type AssistantTurn } from "@/services/corpus-video-service";

interface Turn {
  role: "user" | "assistant";
  content: string;
  tools?: AssistantTurn["tool_calls"];
}

// Openers that map to what someone actually arrives wanting to know. Not
// feature names — the questions the page cannot currently answer at a glance.
const STARTERS = [
  "What's in this corpus and what needs my attention?",
  "Which documents have no real content?",
  "Is this ready to publish?",
];

function ToolTrace({ calls }: { calls: AssistantTurn["tool_calls"] }) {
  if (!calls?.length) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {calls.map((c, i) => {
        const r = c.result || {};
        const n = r.matched ?? r.would_reject ?? r.rejected ?? r.documents_published;
        const warnings = (r.warnings as string[] | undefined) || [];
        return (
          <div key={i} className="rounded-md border border-border/60 bg-muted/40 px-2.5 py-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
              <Terminal size={11} />
              <span className="text-foreground">{c.name}</span>
              {n !== undefined && <span className="ml-auto tabular-nums">{String(n)}</span>}
            </div>
            {/* Warnings are computed in code, not written by the model — which
                is the point. Surfacing them here means the caveat survives even
                if the prose above forgets it. */}
            {warnings.map((w, j) => (
              <p key={j} className="mt-1 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
                {w}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function CorpusAssistantPanel({
  corpusId,
  onChanged,
}: {
  corpusId: string;
  /** A tool may have mutated the corpus, so the list above should re-read. */
  onChanged?: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setTurns((t) => [...t, { role: "user", content: q }]);
    setBusy(true);
    try {
      const history = turns.map((t) => ({ role: t.role, content: t.content }));
      const res = await askCorpusAssistant(corpusId, q, history);
      setTurns((t) => [...t, { role: "assistant", content: res.answer, tools: res.tool_calls }]);
      if (res.tool_calls?.some((c) => c.name !== "corpus_inspect" && c.name !== "corpus_query")) {
        onChanged?.();
      }
    } catch (e) {
      setTurns((t) => [
        ...t,
        { role: "assistant", content: `Could not reach the assistant — ${e instanceof Error ? e.message : String(e)}` },
      ]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => boxRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bot size={14} /> Corpus assistant
          <span className="ml-auto text-[11px] font-normal text-muted-foreground">
            reads and edits <span className="font-mono">{corpusId}</span>
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div ref={boxRef} className="max-h-[26rem] space-y-3 overflow-y-auto">
          {turns.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Ask about this corpus. It answers from the corpus itself, never
                from memory — and anything that would change documents is
                previewed with a count before it runs.
              </p>
              <div className="flex flex-col gap-1.5">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-md border border-border px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((t, i) => (
            <div key={i} className={t.role === "user" ? "text-right" : ""}>
              <div
                className={`inline-block max-w-full rounded-lg px-3 py-2 text-xs leading-relaxed ${
                  t.role === "user"
                    ? "bg-primary/10 text-foreground"
                    : "bg-muted/60 text-foreground"
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{t.content}</div>
                {t.role === "assistant" && <ToolTrace calls={t.tools || []} />}
              </div>
            </div>
          ))}

          {busy && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin" /> checking the corpus…
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask about this corpus…"
            disabled={busy}
            className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
          />
          <Button size="sm" disabled={busy || !input.trim()} onClick={() => send(input)}>
            <CornerDownLeft size={13} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
