// "Ask Jarvis" — floating helper bot for all admin surfaces.
//
// Rendered once in Admin.tsx. Any feature can summon it pre-seeded with the
// current screen's context via openJarvis({seedQuestion, context}) — the same
// CustomEvent discipline the chat widgets use. Answers arrive as markdown
// whose in-app deeplinks (/chataiagent/admin?section=…) navigate with the
// router instead of a full reload.

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, RefreshCw, Send, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  askJarvis, refreshKb, JarvisContext, JarvisMessage,
} from "@/services/jarvis-service";

const OPEN_JARVIS_EVENT = "open-jarvis";
const BASENAME = "/chataiagent";

export interface OpenJarvisDetail {
  seedQuestion?: string;
  context?: JarvisContext;
}

/** Summon the panel from anywhere in the admin UI. */
export function openJarvis(detail: OpenJarvisDetail = {}) {
  window.dispatchEvent(new CustomEvent(OPEN_JARVIS_EVENT, { detail }));
}

export function JarvisPanel({ baseContext }: { baseContext: JarvisContext }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<JarvisMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Context from the chip that summoned us (richer than the page default).
  const [chipContext, setChipContext] = useState<JarvisContext | null>(null);
  const navigate = useNavigate();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<OpenJarvisDetail>).detail || {};
      setOpen(true);
      if (detail.context) setChipContext(detail.context);
      if (detail.seedQuestion) setInput(detail.seedQuestion);
      setTimeout(() => inputRef.current?.focus(), 50);
    };
    window.addEventListener(OPEN_JARVIS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_JARVIS_EVENT, onOpen);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const send = useCallback(async () => {
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setBusy(true);
    const history = messages;
    setMessages((m) => [...m, { role: "user", content: question }]);
    try {
      const ctx = { ...baseContext, ...(chipContext || {}) };
      const r = await askJarvis(question, ctx, history);
      setMessages((m) => [...m, { role: "assistant", content: r.answer }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `_(${e.message})_` }]);
    } finally {
      setBusy(false);
    }
  }, [input, busy, messages, baseContext, chipContext]);

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium shadow-lg hover:opacity-90"
        title="Ask Jarvis — help with this screen"
      >
        <Sparkles size={15} /> Ask Jarvis
      </button>
    );
  }

  return (
    <div className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[26rem] flex flex-col border-l border-border bg-background shadow-2xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Sparkles size={16} className="text-primary" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">Ask Jarvis</p>
          <p className="text-[11px] text-muted-foreground truncate">
            Help with loops, integrations, prompts, evals — knows this screen.
          </p>
        </div>
        <Button size="sm" variant="ghost" className="h-7 px-2" title="Refresh knowledge (after a feature ship)"
                onClick={async () => {
                  const r = await refreshKb().catch((e) => ({ cleared: 0, note: e.message }));
                  setNote(`Knowledge refreshed (${r.cleared}) — ${r.note}`);
                  setTimeout(() => setNote(null), 5000);
                }}>
          <RefreshCw size={13} />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setOpen(false)}>
          <X size={14} />
        </Button>
      </div>
      {note && <p className="px-4 py-1.5 text-[11px] text-emerald-600 border-b border-border">{note}</p>}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-xs text-muted-foreground space-y-2 pt-2">
            <p>Ask anything about using the admin portal, e.g.:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>How do I map whatsapp_send_message to Zapier?</li>
              <li>Why is my procedure blocked from activating?</li>
              <li>How do evals decide pass/fail?</li>
            </ul>
            <p>Answers include links that take you to the right screen.</p>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-8 rounded-lg bg-primary/10 px-3 py-2 text-sm whitespace-pre-wrap">
              {m.content}
            </div>
          ) : (
            <div key={i} className="mr-4 text-sm jarvis-markdown [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mb-2 [&_li]:mb-1 [&_code]:font-mono [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target={href?.startsWith(BASENAME) ? undefined : "_blank"}
                      rel="noreferrer"
                      onClick={(e) => {
                        if (href?.startsWith(BASENAME)) {
                          e.preventDefault();
                          navigate(href.slice(BASENAME.length));
                        }
                      }}
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {m.content}
              </ReactMarkdown>
            </div>
          ),
        )}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={13} className="animate-spin" /> Jarvis is thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
            }}
            rows={2}
            placeholder="Ask how to do something…"
            className="flex-1 resize-none rounded-md border border-border bg-background p-2 text-sm"
          />
          <Button size="sm" disabled={busy || !input.trim()} onClick={() => void send()}>
            <Send size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Small "✨ Ask Jarvis" chip a feature places next to a problem/panel. */
export function JarvisChip({ question, context, label = "Ask Jarvis" }: {
  question: string;
  context?: JarvisContext;
  label?: string;
}) {
  return (
    <button
      onClick={() => openJarvis({ seedQuestion: question, context })}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/50"
      title="Get help with this from Jarvis"
    >
      <Sparkles size={11} className="text-primary" /> {label}
    </button>
  );
}
