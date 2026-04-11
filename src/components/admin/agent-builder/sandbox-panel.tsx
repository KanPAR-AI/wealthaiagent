import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Loader2,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Play,
  Pause,
  Archive,
  User,
  Bot,
  FlaskConical,
  Eye,
  ChevronDown,
  ChevronRight,
  Database,
  Brain,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useAdminStore } from "@/store/admin";
import {
  fetchAgentConfig,
  reloadAgent,
  updateAgentStatus,
} from "@/services/agent-builder-service";
import type { AgentStatus } from "@/services/agent-builder-service";
import { AgentStatusBadge } from "./agent-status-badge";
import { getApiUrl } from "@/config/environment";
import { auth } from "@/config/firebase";
import { toast } from "sonner";

interface Props {
  agentId: string;
}

// Phase 1D — sandbox trace payload. Mirrors the backend trace
// collector in services/agents/dynamic_rag_agent.py::_execute().
interface RetrievedChunk {
  title: string;
  text: string;
  score: number;
  source_type: string;
  source_id: string;
  url: string | null;
}

interface MemoryFact {
  category: string;
  key: string;
  value: string;
}

interface SandboxTrace {
  agent_id: string;
  agent_type: string;
  org_id: string;
  mode: string;
  retrieved_chunks: RetrievedChunk[];
  memory_facts: MemoryFact[];
  system_prompt: string;
  user_message: string;
  tool_calls: unknown[];
  response_length: number;
}

interface TestMessage {
  role: "user" | "assistant";
  content: string;
  rating?: "up" | "down";
  streaming?: boolean;
  trace?: SandboxTrace;
}

/**
 * ChunkRow — renders one retrieved corpus chunk with source-type-aware
 * playback controls. Video chunks (`video_file`) with a `url` can be
 * expanded into an inline `<video>` player that seeks to the chunk's
 * timestamp via the URL's `#t=<seconds>` fragment. YouTube chunks open
 * in a new tab (embedding them inline requires the iframe API + ToS
 * constraints, not worth the complexity for the sandbox debugging
 * surface).
 */
function ChunkRow({ chunk }: { chunk: RetrievedChunk }) {
  const [playing, setPlaying] = useState(false);
  const isInlinePlayable =
    chunk.source_type === "video_file" && !!chunk.url;
  const isYouTube = chunk.source_type === "youtube" && !!chunk.url;

  // Extract the seek-time from the URL's #t= fragment (written by the
  // backend for stored videos — see corpus_pipeline.add_video_file).
  const tMatch = chunk.url?.match(/#t=(\d+(?:\.\d+)?)/);
  const seekSeconds = tMatch ? parseFloat(tMatch[1]) : 0;

  return (
    <li className="border-l-2 border-emerald-500/30 pl-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-foreground/80 truncate">
          {chunk.title || chunk.source_id || "(untitled)"}
        </span>
        <span className="text-[10px] text-muted-foreground font-mono shrink-0">
          score {chunk.score.toFixed(3)}
        </span>
      </div>
      <div className="text-muted-foreground/80 line-clamp-2 mt-0.5">
        {chunk.text}
      </div>

      {chunk.url && (
        <div className="flex items-center gap-2 mt-0.5">
          {isInlinePlayable && (
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="text-[10px] text-primary hover:underline inline-flex items-center gap-1"
              data-testid="sandbox-video-play-toggle"
            >
              {playing ? "▾ hide" : "▸ play"} @ {formatSeek(seekSeconds)}
            </button>
          )}
          <a
            href={chunk.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-primary hover:underline"
            title={isYouTube ? "Open in YouTube" : "Open source"}
          >
            {chunk.source_type} ↗
          </a>
        </div>
      )}

      {isInlinePlayable && playing && chunk.url && (
        <div className="mt-1.5 rounded border border-emerald-500/20 bg-background/50 p-1">
          <video
            key={chunk.url}
            src={chunk.url}
            controls
            autoPlay
            preload="metadata"
            className="w-full max-h-56 rounded"
            // The #t= fragment in chunk.url tells the browser where
            // to seek on initial load — works natively in Chrome,
            // Safari, Firefox. No JS seek needed.
          />
        </div>
      )}
    </li>
  );
}

function formatSeek(seconds: number): string {
  if (!seconds || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * TracePanel — Phase 1D "Show your work" for the sandbox.
 *
 * Renders the structured trace returned by the backend alongside each
 * assistant response: which corpus chunks were retrieved (with scores),
 * which memory facts were injected, the FULL system prompt as sent to
 * the LLM, tool calls, and agent metadata. This is the admin's primary
 * debugging surface — if an answer looks wrong, open this first.
 */
function TracePanel({ trace }: { trace: SandboxTrace }) {
  return (
    <div className="mt-2 rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 to-background p-3 space-y-3 text-xs">
      {/* --- Metadata header --- */}
      <div className="flex items-center gap-3 flex-wrap text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>
          mode: <span className="text-primary font-medium">{trace.mode}</span>
        </span>
        <span>
          agent:{" "}
          <span className="text-primary font-medium">{trace.agent_id}</span>
        </span>
        <span>
          response:{" "}
          <span className="text-primary font-medium">
            {trace.response_length} chars
          </span>
        </span>
      </div>

      {/* --- Retrieved corpus chunks --- */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5 font-medium text-foreground/80">
          <Database size={11} className="text-emerald-500" />
          Retrieved chunks ({trace.retrieved_chunks.length})
        </div>
        {trace.retrieved_chunks.length === 0 ? (
          <div className="pl-4 text-muted-foreground/60 italic">
            No corpus retrieval — this agent has no RAG corpus, or none
            of the chunks matched the query closely enough.
          </div>
        ) : (
          <ul className="space-y-1.5 pl-4">
            {trace.retrieved_chunks.map((c, i) => (
              <ChunkRow key={i} chunk={c} />
            ))}
          </ul>
        )}
      </div>

      {/* --- Memory facts --- */}
      <div>
        <div className="flex items-center gap-1.5 mb-1.5 font-medium text-foreground/80">
          <Brain size={11} className="text-violet-500" />
          Memory facts injected ({trace.memory_facts.length})
        </div>
        {trace.memory_facts.length === 0 ? (
          <div className="pl-4 text-muted-foreground/60 italic">
            None — either memory is disabled or no facts stored for this user yet.
          </div>
        ) : (
          <ul className="space-y-0.5 pl-4">
            {trace.memory_facts.map((f, i) => (
              <li key={i} className="font-mono text-[10px]">
                <span className="text-violet-500">{f.category}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-foreground/80">{f.key}</span>
                <span className="text-muted-foreground"> = </span>
                <span>{f.value}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* --- Full system prompt as sent to the LLM --- */}
      <details className="group">
        <summary className="flex items-center gap-1.5 cursor-pointer font-medium text-foreground/80 hover:text-primary">
          <FileText size={11} className="text-amber-500" />
          Full system prompt sent to LLM
          <span className="text-[10px] text-muted-foreground ml-auto">
            {trace.system_prompt.length} chars
          </span>
        </summary>
        <pre className="mt-2 p-2 rounded border border-border/30 bg-muted/30 whitespace-pre-wrap font-mono text-[10px] leading-relaxed max-h-60 overflow-y-auto">
          {trace.system_prompt}
        </pre>
      </details>

      {/* --- Tool calls (if any) --- */}
      {trace.tool_calls.length > 0 && (
        <div>
          <div className="font-medium text-foreground/80 mb-1">
            Tool calls ({trace.tool_calls.length})
          </div>
          <pre className="pl-4 text-[10px] font-mono text-muted-foreground overflow-x-auto">
            {JSON.stringify(trace.tool_calls, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export function SandboxPanel({ agentId }: Props) {
  const { agentConfig, setAgentConfig, loading, setLoading } = useAdminStore();
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConfig = useCallback(async () => {
    try {
      const config = await fetchAgentConfig(agentId);
      setAgentConfig(config);
    } catch (err) {
      toast.error("Failed to load config", {
        description: (err as Error).message,
      });
    }
  }, [agentId, setAgentConfig]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /**
   * Send a test message to the agent via SSE with trace events.
   *
   * Flow:
   *   1. POST /chats with firstMessage (creates a throwaway test chat)
   *   2. Open /chats/{id}/stream?trace=true&force_agent={agentId}
   *   3. Parse SSE events — message_delta accumulates into streaming
   *      assistant message, trace attaches a full trace payload for
   *      the "Show your work" panel, message_complete finalizes.
   *
   * force_agent routes straight to THIS agent (bypasses the orchestrator's
   * routing heuristics), so we get a clean signal — no need to prefix
   * context markers the way the old sandbox did.
   */
  const sendTestMessage = async () => {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMsg },
      { role: "assistant", content: "", streaming: true },
    ]);
    setSending(true);

    try {
      const token = await auth.currentUser?.getIdToken();

      // 1) Create a fresh test chat with the user message as firstMessage
      const createRes = await fetch(getApiUrl("/chats"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: `Sandbox test: ${agentId}`,
          firstMessage: { content: userMsg, attachments: [] },
        }),
      });
      if (!createRes.ok) throw new Error("Failed to create test chat");
      const chatData = await createRes.json();
      const chatId = chatData.chat?.id;
      if (!chatId) throw new Error("Create chat returned no chat.id");

      // 2) Open the SSE stream with trace + force_agent pinning
      const streamUrl = getApiUrl(
        `/chats/${chatId}/stream?trace=true&force_agent=${encodeURIComponent(agentId)}`
      );
      const streamRes = await fetch(streamUrl, {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!streamRes.ok || !streamRes.body) {
        throw new Error(`Stream failed: ${streamRes.statusText}`);
      }

      // 3) Parse SSE line-by-line (matches chat-service.ts pattern)
      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let accumulated = "";

      const updateLastAssistant = (patch: Partial<TestMessage>) => {
        setMessages((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].role === "assistant") {
              next[i] = { ...next[i], ...patch };
              break;
            }
          }
          return next;
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (let line of lines) {
          line = line.replace(/\r$/, "");
          if (!line.startsWith("data:")) continue;

          const payload = line.replace(/^data:\s*/, "");
          if (!payload.startsWith("{")) continue;

          try {
            const evt = JSON.parse(payload);
            if (evt.type === "message_delta") {
              // Skip the router's "[Using X agent]\n\n" preamble from
              // the visible text — it's pure noise in a sandbox view.
              let delta = evt.delta || "";
              if (!accumulated && delta.startsWith("[Using ")) {
                const nlIdx = delta.indexOf("\n\n");
                delta = nlIdx >= 0 ? delta.slice(nlIdx + 2) : "";
              }
              accumulated += delta;
              updateLastAssistant({ content: accumulated });
              await new Promise((r) => setTimeout(r, 0));
            } else if (evt.type === "trace") {
              updateLastAssistant({ trace: evt.trace });
            } else if (evt.type === "message_complete") {
              updateLastAssistant({ streaming: false });
            }
          } catch (err) {
            console.warn("SSE parse error:", payload, err);
          }
        }
      }

      // If stream closed without explicit message_complete
      updateLastAssistant({ streaming: false });
    } catch (err) {
      toast.error("Test chat failed", {
        description: (err as Error).message,
      });
      setMessages((prev) => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === "assistant") {
            next[i] = {
              ...next[i],
              streaming: false,
              content:
                "Error: Could not get a response. Make sure the agent is active and force-routing is enabled.",
            };
            break;
          }
        }
        return next;
      });
    } finally {
      setSending(false);
    }
  };

  const rateMessage = (idx: number, rating: "up" | "down") => {
    setMessages((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, rating } : m))
    );
  };

  const handleReload = async () => {
    setLoading("reload", true);
    try {
      await reloadAgent(agentId);
      toast.success("Agent reloaded", {
        description: "Dynamic agent cache has been refreshed",
      });
    } catch (err) {
      toast.error("Reload failed", { description: (err as Error).message });
    } finally {
      setLoading("reload", false);
    }
  };

  const handleStatusChange = async (newStatus: AgentStatus) => {
    try {
      const result = await updateAgentStatus(agentId, newStatus);
      toast.success(`Agent ${result.status}`, {
        description: `Status changed to ${result.status}`,
      });
      await loadConfig();
    } catch (err) {
      toast.error("Status change failed", {
        description: (err as Error).message,
      });
    }
  };

  const clearChat = () => setMessages([]);

  // Toggle per-message trace panel open state.
  const [openTraces, setOpenTraces] = useState<Record<number, boolean>>({});
  const toggleTrace = (idx: number) =>
    setOpenTraces((prev) => ({ ...prev, [idx]: !prev[idx] }));

  return (
    <div className="space-y-4">
      {/* Status & Controls */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2 bg-gradient-to-r from-emerald-500/5 to-transparent rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <FlaskConical size={14} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-sm">Prompt Sandbox</CardTitle>
                <CardDescription className="text-xs">
                  Test your agent's responses in a live chat
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {agentConfig?.status && (
                <AgentStatusBadge status={agentConfig.status} />
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleReload}
                disabled={loading["reload"]}
                className="rounded-lg"
                title="Hot-reload agent config"
              >
                {loading["reload"] ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {agentConfig?.status === "draft" && (
              <Button
                size="sm"
                onClick={() => handleStatusChange("active")}
                className="rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
              >
                <Play size={12} className="mr-1.5" />
                Activate Agent
              </Button>
            )}
            {agentConfig?.status === "active" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange("draft")}
                className="rounded-lg"
              >
                <Pause size={12} className="mr-1.5" />
                Deactivate
              </Button>
            )}
            {agentConfig?.status === "archived" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange("draft")}
                className="rounded-lg"
              >
                <RotateCcw size={12} className="mr-1.5" />
                Unarchive
              </Button>
            )}
            {agentConfig?.status !== "archived" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (confirm("Archive this agent? It will stop receiving messages."))
                    handleStatusChange("archived");
                }}
                className="rounded-lg text-muted-foreground hover:text-destructive"
              >
                <Archive size={12} className="mr-1.5" />
                Archive
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Test Chat */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Test Chat</CardTitle>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearChat} className="rounded-lg text-muted-foreground">
                <RotateCcw size={12} className="mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] overflow-y-auto space-y-4 mb-3 rounded-xl border border-border/30 bg-muted/10 p-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center mb-3">
                  <FlaskConical size={24} className="text-emerald-400/60" />
                </div>
                <p className="text-sm text-muted-foreground/60">
                  Send a test message to see how your agent responds
                </p>
                <p className="text-xs text-muted-foreground/40 mt-1">
                  Messages are routed using the agent's context markers
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  msg.role === "user"
                    ? "bg-primary/10"
                    : "bg-gradient-to-br from-emerald-500/15 to-teal-500/15"
                }`}>
                  {msg.role === "user" ? (
                    <User size={12} className="text-primary" />
                  ) : (
                    <Bot size={12} className="text-emerald-500" />
                  )}
                </div>
                <div className="max-w-[80%]">
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background border border-border/50 shadow-sm"
                    }`}
                  >
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                      {msg.content}
                    </pre>
                  </div>
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-0.5 mt-1 ml-1">
                      <button
                        onClick={() => rateMessage(i, "up")}
                        className={`p-1.5 rounded-lg transition-colors ${
                          msg.rating === "up"
                            ? "text-green-500 bg-green-500/10"
                            : "text-muted-foreground/40 hover:text-green-500 hover:bg-green-500/10"
                        }`}
                      >
                        <ThumbsUp size={11} />
                      </button>
                      <button
                        onClick={() => rateMessage(i, "down")}
                        className={`p-1.5 rounded-lg transition-colors ${
                          msg.rating === "down"
                            ? "text-red-500 bg-red-500/10"
                            : "text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10"
                        }`}
                      >
                        <ThumbsDown size={11} />
                      </button>
                      {/* Phase 1D — "Show your work" toggle */}
                      {msg.trace && (
                        <button
                          onClick={() => toggleTrace(i)}
                          className="ml-1 px-2 py-1 rounded-lg flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors"
                          data-testid="sandbox-show-work"
                        >
                          {openTraces[i] ? (
                            <ChevronDown size={10} />
                          ) : (
                            <ChevronRight size={10} />
                          )}
                          <Eye size={10} />
                          Show your work
                        </button>
                      )}
                    </div>
                  )}
                  {/* Expandable trace panel */}
                  {msg.role === "assistant" && msg.trace && openTraces[i] && (
                    <TracePanel trace={msg.trace} />
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500/15 to-teal-500/15 flex items-center justify-center shrink-0">
                  <Bot size={12} className="text-emerald-500" />
                </div>
                <div className="bg-background border border-border/50 rounded-2xl px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-400/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 rounded-full bg-emerald-400/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 rounded-full bg-emerald-400/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && sendTestMessage()
              }
              placeholder="Type a test message..."
              className="flex-1 h-10 rounded-xl border border-border/50 bg-muted/20 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary/30 transition-colors"
              disabled={sending}
            />
            <Button
              size="sm"
              onClick={sendTestMessage}
              disabled={sending || !input.trim()}
              className="rounded-xl h-10 w-10 p-0"
            >
              <Send size={14} />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
