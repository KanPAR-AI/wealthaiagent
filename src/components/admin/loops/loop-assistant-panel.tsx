/**
 * The Loop Assistant panel (docs/38) — a copilot present across the Verified
 * Procedures section: loop-scoped on a detail page, wizard-scoped during
 * creation (the draft isn't saved yet, so its state travels as context).
 *
 * Doctrine carried from the corpus assistant: the TOOL TRACE is shown, not
 * hidden — an assistant that reports only prose asks to be trusted; one that
 * shows "ran loop_inspect" can be checked. The bridge to the corpus
 * assistant renders with attribution.
 */

import { Bot, ChevronDown, ChevronUp, Loader2, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { askLoopAssistant, LoopAssistantReply } from "@/services/loops-service";

interface Msg {
  role: "user" | "assistant";
  content: string;
  toolCalls?: LoopAssistantReply["tool_calls"];
}

function ToolTrace({ calls }: { calls: NonNullable<Msg["toolCalls"]> }) {
  const [open, setOpen] = useState(false);
  if (!calls.length) return null;
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        ran {calls.map((c) => c.name).join(", ")}
      </button>
      {open && (
        <div className="mt-1 space-y-1">
          {calls.map((c, i) => (
            <pre key={i} className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded border border-border bg-muted/30 p-1.5 text-[10px]">
              {c.name}({JSON.stringify(c.arguments)}) →{" "}
              {JSON.stringify(c.result, null, 1)?.slice(0, 1500)}
            </pre>
          ))}
        </div>
      )}
    </div>
  );
}

export function LoopAssistantPanel({ loopId, context, suggestions }: {
  loopId?: string;
  /** Wizard state when no loop exists yet (step, sop, layers). */
  context?: Record<string, unknown>;
  suggestions?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setBusy(true);
    try {
      const reply = await askLoopAssistant(q, {
        loopId,
        context,
        history: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      setMessages((m) => [...m, {
        role: "assistant",
        content: reply.answer,
        toolCalls: reply.tool_calls,
      }]);
    } catch (e) {
      setMessages((m) => [...m, {
        role: "assistant",
        content: `_(request failed: ${e instanceof Error ? e.message : e})_`,
      }]);
    } finally {
      setBusy(false);
    }
  };

  const defaultSuggestions = loopId
    ? ["What's wrong with this loop?", "Why did the last run fail?",
      "When will it run next?", "Is it proven by evals?"]
    : ["Review my SOP", "Which layers should I enable?",
      "Write checks for this procedure", "What cron do I need for weekday mornings?"];

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Sparkles size={14} /> Loop Assistant
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex max-h-[70vh] w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-border bg-popover shadow-xl">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Bot size={16} className="text-muted-foreground" />
        <span className="text-sm font-medium">Loop Assistant</span>
        {loopId && <span className="truncate text-xs text-muted-foreground">· {loopId}</span>}
        {!loopId && context && <span className="text-xs text-muted-foreground">· create wizard</span>}
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
              I can inspect this {loopId ? "loop" : "draft"}, explain failures,
              preview schedules, check eval coverage — and consult the corpus
              assistant when the answer lives in a knowledge base.
            </p>
            {(suggestions || defaultSuggestions).map((s) => (
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
            <div className={cn(
              "inline-block max-w-[92%] whitespace-pre-wrap rounded-lg px-2.5 py-1.5 text-left",
              m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/50",
            )}>
              {m.content}
              {m.toolCalls && <ToolTrace calls={m.toolCalls} />}
            </div>
          </div>
        ))}
        {busy && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" /> investigating…
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-center gap-1.5 border-t border-border p-2"
        onSubmit={(e) => { e.preventDefault(); send(input); }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={loopId ? `Ask about ${loopId}…` : "Ask about your loop design…"}
          className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm"
        />
        <Button type="submit" size="sm" disabled={busy || !input.trim()} aria-label="Send">
          <Send size={14} />
        </Button>
      </form>
    </div>
  );
}
