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

interface TestMessage {
  role: "user" | "assistant";
  content: string;
  rating?: "up" | "down";
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

  const sendTestMessage = async () => {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setSending(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      const url = getApiUrl("/chats");
      const chatRes = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      if (!chatRes.ok) throw new Error("Failed to create test chat");
      const chatData = await chatRes.json();

      const marker =
        agentConfig?.routing?.context_markers?.[0] ||
        `[Using ${agentId} agent]`;
      const msgUrl = getApiUrl(
        `/chats/${chatData.chat_id}/messages`
      );
      const msgRes = await fetch(msgUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: `${marker} ${userMsg}`,
        }),
      });
      if (!msgRes.ok) throw new Error("Failed to send message");
      const msgData = await msgRes.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            msgData.response || msgData.content || "No response received",
        },
      ]);
    } catch (err) {
      toast.error("Test chat failed", {
        description: (err as Error).message,
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error: Could not get a response. Make sure the agent is active." },
      ]);
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
                    <div className="flex gap-0.5 mt-1 ml-1">
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
                    </div>
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
