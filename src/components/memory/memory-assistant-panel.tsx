/**
 * The Memory Assistant panel (docs/39) — a copilot on the Memory page that
 * answers "what does my memory actually say" and helps the user act on it.
 *
 * Doctrine carried from the corpus/loop assistants (loop-assistant-panel.tsx):
 * the TOOL TRACE is shown, not hidden — an assistant that reports only prose
 * asks to be trusted; one that shows "ran memory_search" can be checked.
 *
 * Propose-not-perform (memory-spec MUI-0023/0046, security-boundaries): the
 * assistant is READ-ONLY. It never forgets or corrects anything itself — it
 * emits an inert `action` proposal that THIS panel turns into an explicit
 * confirm button. Only when the user clicks confirm does the real, already-
 * authorized endpoint run (correctMemory / forgetMemory), on the user's own
 * session. Nothing mutates without that click, and the button states the exact
 * memory id (and, for a correction, the exact new value) being changed.
 *
 * Answer + memory-derived strings are rendered as INERT escaped text (no
 * markdown/HTML renderer), the same T24 guarantee the rest of the Memory UI
 * keeps — a memory value shaped like an instruction is quoted data, never
 * executed.
 */

import {
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  askMemoryAssistant,
  correctMemory,
  forgetMemory,
  MemoryEngineError,
  type MemoryAssistantAction,
  type MemoryAssistantReply,
} from "@/services/memory-engine-service";

interface Msg {
  role: "user" | "assistant";
  content: string;
  toolCalls?: MemoryAssistantReply["tool_calls"];
  actions?: MemoryAssistantAction[];
}

const SUGGESTIONS = [
  "What do you remember about me?",
  "How many memories do you have, by namespace?",
  "How did my preferences change over time?",
  "What's new this week?",
];

function ToolTrace({ calls }: { calls: NonNullable<Msg["toolCalls"]> }) {
  const [open, setOpen] = useState(false);
  if (!calls.length) return null;
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        ran {calls.map((c) => c.name).join(", ")}
      </button>
      {open && (
        <div className="mt-1 space-y-1">
          {calls.map((c, i) => (
            <pre
              key={i}
              className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded border border-border bg-muted/30 p-1.5 text-[10px]"
            >
              {c.name}({JSON.stringify(c.arguments)}) →{" "}
              {JSON.stringify(c.result, null, 1)?.slice(0, 1500)}
            </pre>
          ))}
        </div>
      )}
    </div>
  );
}

type ActionPhase = "proposed" | "running" | "done" | "error" | "dismissed";

/** One propose-not-perform confirm control. The assistant only PROPOSED
 *  this; nothing has changed yet. Clicking confirm calls the real endpoint. */
function ActionConfirm({ action }: { action: MemoryAssistantAction }) {
  const [phase, setPhase] = useState<ActionPhase>("proposed");
  const [outcome, setOutcome] = useState<string>("");

  const run = async () => {
    setPhase("running");
    try {
      if (action.type === "forget") {
        const r = await forgetMemory(action.memory_id);
        if (r.not_found || r.forgotten_count === 0) {
          setOutcome("Nothing was deleted — that memory was not found.");
          setPhase("error");
          return;
        }
        // Forget completeness is the engine's accounting, never inferred:
        // derived-index cleanup still owed = an honest "incomplete", not
        // success (MUI-0023, mirrors use-memory-mutations classifyForget).
        if (r.projection_purges.pending.length > 0) {
          setOutcome(
            "Removed from your memory; derived-index cleanup is still in " +
              "progress (the engine reported pending purges).",
          );
        } else {
          setOutcome("Forgotten. The memory has been deleted.");
        }
        setPhase("done");
      } else {
        const r = await correctMemory(action.memory_id, { value: action.value });
        if (r.operation === "rejected") {
          setOutcome(r.decision_reason || "The correction was not applied.");
          setPhase("error");
          return;
        }
        setOutcome("Corrected. A new value was recorded and the old one superseded.");
        setPhase("done");
      }
    } catch (e) {
      setOutcome(
        e instanceof MemoryEngineError
          ? e.message
          : e instanceof Error
            ? e.message
            : "The action failed. No change was made.",
      );
      setPhase("error");
    }
  };

  if (phase === "dismissed") return null;

  if (phase === "done" || phase === "error") {
    return (
      <div
        className={cn(
          "mt-2 flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-xs",
          phase === "done"
            ? "border-emerald-500/40 text-emerald-600"
            : "border-destructive/40 text-destructive",
        )}
        role="status"
      >
        {phase === "done" ? (
          <Check size={13} className="mt-0.5 shrink-0" />
        ) : (
          <TriangleAlert size={13} className="mt-0.5 shrink-0" />
        )}
        <span>{outcome}</span>
      </div>
    );
  }

  const verb = action.type === "forget" ? "Forget" : "Correct";
  return (
    <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
      <p className="mb-1.5 text-muted-foreground">
        {action.type === "forget" ? (
          <>
            Confirm to permanently <b>forget</b> memory{" "}
            <code className="rounded bg-muted px-1">{action.memory_id}</code>.
            Nothing has changed yet.
          </>
        ) : (
          <>
            Confirm to <b>correct</b> memory{" "}
            <code className="rounded bg-muted px-1">{action.memory_id}</code> to:{" "}
            <span className="rounded bg-muted px-1 font-medium text-foreground/90">
              {action.value}
            </span>
            . Nothing has changed yet.
          </>
        )}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          className="h-7 text-xs"
          disabled={phase === "running"}
          onClick={run}
        >
          {phase === "running" ? (
            <Loader2 size={12} className="mr-1 animate-spin" />
          ) : action.type === "forget" ? (
            <Trash2 size={12} className="mr-1" />
          ) : (
            <Check size={12} className="mr-1" />
          )}
          {verb} it
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          disabled={phase === "running"}
          onClick={() => setPhase("dismissed")}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function MemoryAssistantPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: q }]);
    setBusy(true);
    try {
      const reply = await askMemoryAssistant(q, history);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: reply.answer,
          toolCalls: reply.tool_calls,
          actions: reply.actions,
        },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `_(request failed: ${e instanceof Error ? e.message : e})_`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg hover:opacity-90"
        title="Ask about your own memory"
        data-testid="memory-assistant-open"
      >
        <Sparkles size={15} /> Ask about your memory
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-40 flex max-h-[75vh] w-[400px] max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-border bg-popover shadow-xl"
      role="dialog"
      aria-label="Memory Assistant"
    >
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Bot size={16} className="text-muted-foreground" />
        <span className="text-sm font-medium">Memory Assistant</span>
        <span className="text-xs text-muted-foreground">· your memory only</span>
        <button
          type="button"
          aria-label="Close assistant"
          className="ml-auto text-muted-foreground hover:text-foreground"
          onClick={() => setOpen(false)}
        >
          <X size={16} />
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-2 text-sm">
        {messages.length === 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Ask what this platform remembers about you — I read only your own
              memory and show every tool call I make. I can also propose a
              forget or correction, but you confirm it.
            </p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="block w-full rounded-md border border-border/60 px-2 py-1 text-left text-xs hover:bg-accent/60"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn(m.role === "user" && "text-right")}>
            <div
              className={cn(
                "inline-block max-w-[92%] whitespace-pre-wrap rounded-lg px-2.5 py-1.5 text-left",
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/50",
              )}
            >
              {m.content}
              {m.toolCalls && <ToolTrace calls={m.toolCalls} />}
            </div>
            {m.role === "assistant" &&
              m.actions?.map((a, ai) => <ActionConfirm key={ai} action={a} />)}
          </div>
        ))}
        {busy && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" /> looking through your memory…
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-center gap-1.5 border-t border-border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your memory…"
          aria-label="Ask about your memory"
          className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm"
        />
        <Button type="submit" size="sm" disabled={busy || !input.trim()} aria-label="Send">
          <Send size={14} />
        </Button>
      </form>
    </div>
  );
}
