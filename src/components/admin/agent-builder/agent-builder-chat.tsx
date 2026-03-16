import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Wand2, Copy, Check, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useAdminStore } from "@/store/admin";
import { fetchAgentConfig } from "@/services/agent-builder-service";
import { getApiUrl } from "@/config/environment";
import { auth } from "@/config/firebase";
import { toast } from "sonner";

interface Props {
  agentId: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function builderFetch(endpoint: string, body: Record<string, unknown>) {
  const token = await auth.currentUser?.getIdToken();
  const url = getApiUrl(`/admin/agent-builder${endpoint}`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(data.detail || `Error: ${res.status}`);
  }
  return res.json();
}

export function AgentBuilderChat({ agentId }: Props) {
  const { agentConfig, setAgentConfig } = useAdminStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAgentConfig(agentId)
      .then(setAgentConfig)
      .catch((err) =>
        toast.error("Failed to load config", { description: (err as Error).message })
      );
  }, [agentId, setAgentConfig]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setSending(true);

    try {
      const result = await builderFetch("/chat", {
        message: userMsg,
        agent_config: agentConfig || {},
        history: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.response },
      ]);
    } catch (err) {
      toast.error("Chat failed", { description: (err as Error).message });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleGenerateConfig = async () => {
    if (!agentConfig) return;
    setGenerating(true);
    try {
      const result = await builderFetch("/generate", {
        description: agentConfig.description || agentConfig.name,
        goals: "",
        target_audience: "",
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Generated a new configuration:\n\`\`\`json\n${JSON.stringify(result.config, null, 2)}\n\`\`\`\n\nReview the config above. You can ask me to refine specific parts.`,
        },
      ]);
    } catch (err) {
      toast.error("Generation failed", { description: (err as Error).message });
    } finally {
      setGenerating(false);
    }
  };

  const handleImprovePrompt = async () => {
    if (!agentConfig?.prompts?.system_prompt) {
      toast.error("No system prompt to improve");
      return;
    }
    setGenerating(true);
    try {
      const result = await builderFetch("/improve", {
        current_prompt: agentConfig.prompts.system_prompt,
        feedback: "Improve clarity, specificity, and safety boundaries",
      });
      const r = result.result;
      let responseText = `**Improved Prompt:**\n\`\`\`\n${r.improved_prompt}\n\`\`\`\n\n**Summary:** ${r.summary}\n\n**Changes:**`;
      if (r.changes) {
        for (const change of r.changes) {
          responseText += `\n- **${change.description}**: ${change.reasoning}`;
        }
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: responseText },
      ]);
    } catch (err) {
      toast.error("Improvement failed", { description: (err as Error).message });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateOntology = async () => {
    if (!agentConfig) return;
    setGenerating(true);
    try {
      const result = await builderFetch("/ontology", {
        domain: agentConfig.name || agentId,
        description: agentConfig.description || "",
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Generated ontology with ${Object.keys(result.entities).length} entities:\n\`\`\`json\n${JSON.stringify(result.entities, null, 2)}\n\`\`\``,
        },
      ]);
    } catch (err) {
      toast.error("Ontology generation failed", {
        description: (err as Error).message,
      });
    } finally {
      setGenerating(false);
    }
  };

  const copyLastCodeBlock = () => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;
    const match = lastAssistant.content.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
    if (match) {
      navigator.clipboard.writeText(match[1]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Copied to clipboard");
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent rounded-t-lg">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
              <Bot size={14} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <CardTitle className="text-sm">AI Agent Builder</CardTitle>
              <CardDescription className="text-xs">
                Claude Opus 4.6 helps you design and refine your agent
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateConfig}
              disabled={generating}
              className="rounded-lg bg-gradient-to-r from-indigo-500/5 to-transparent hover:from-indigo-500/10 border-indigo-200 dark:border-indigo-800/50"
            >
              {generating ? (
                <Loader2 size={14} className="mr-1.5 animate-spin" />
              ) : (
                <Wand2 size={14} className="mr-1.5 text-indigo-500" />
              )}
              Generate Config
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImprovePrompt}
              disabled={generating}
              className="rounded-lg bg-gradient-to-r from-purple-500/5 to-transparent hover:from-purple-500/10 border-purple-200 dark:border-purple-800/50"
            >
              <Wand2 size={14} className="mr-1.5 text-purple-500" />
              Improve Prompt
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateOntology}
              disabled={generating}
              className="rounded-lg bg-gradient-to-r from-amber-500/5 to-transparent hover:from-amber-500/10 border-amber-200 dark:border-amber-800/50"
            >
              <Wand2 size={14} className="mr-1.5 text-amber-500" />
              Generate Ontology
            </Button>
            {messages.some(
              (m) => m.role === "assistant" && m.content.includes("```")
            ) && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyLastCodeBlock}
                className="rounded-lg"
              >
                {copied ? (
                  <Check size={14} className="mr-1.5 text-green-500" />
                ) : (
                  <Copy size={14} className="mr-1.5" />
                )}
                Copy Last Output
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Chat Messages */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="pt-4">
          <div className="h-[400px] overflow-y-auto space-y-4 mb-3 rounded-xl border border-border/30 bg-muted/10 p-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mb-3">
                  <Bot size={24} className="text-indigo-400/60" />
                </div>
                <p className="text-sm text-muted-foreground/60">
                  Use the quick actions above or chat to refine your agent
                </p>
                <p className="text-xs text-muted-foreground/40 mt-1">
                  Powered by Claude Opus 4.6
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
                    : "bg-gradient-to-br from-indigo-500/15 to-purple-500/15"
                }`}>
                  {msg.role === "user" ? (
                    <User size={12} className="text-primary" />
                  ) : (
                    <Bot size={12} className="text-indigo-500" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background border border-border/50 shadow-sm"
                  }`}
                >
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {msg.content}
                  </pre>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500/15 to-purple-500/15 flex items-center justify-center shrink-0">
                  <Bot size={12} className="text-indigo-500" />
                </div>
                <div className="bg-background border border-border/50 rounded-2xl px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-indigo-400/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 rounded-full bg-indigo-400/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 rounded-full bg-indigo-400/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Ask about prompt design, routing, memory categories..."
              className="flex-1 h-10 rounded-xl border border-border/50 bg-muted/20 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary/30 transition-colors"
              disabled={sending}
            />
            <Button
              size="sm"
              onClick={sendMessage}
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
