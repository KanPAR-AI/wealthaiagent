import { useState } from "react";
import { X, ArrowRight, ArrowLeft, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { createDynamicAgent } from "@/services/agent-builder-service";
import type { CreateAgentRequest } from "@/services/agent-builder-service";
import { useAdminStore } from "@/store/admin";
import { fetchAgents } from "@/services/admin-service";
import { toast } from "sonner";

interface WizardProps {
  onClose: () => void;
}

const STEPS = [
  "Basic Info",
  "System Prompt",
  "Routing & Memory",
  "Review & Create",
];

export function AgentCreationWizard({ onClose }: WizardProps) {
  const { setAgents, setSelectedAgentId } = useAdminStore();
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);

  // Step 1: Basic Info
  const [agentId, setAgentId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Step 2: System Prompt
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userInstruction, setUserInstruction] = useState("");
  const [disclaimer, setDisclaimer] = useState("");

  // Step 3: Routing & Memory
  const [keywords, setKeywords] = useState("");
  const [contextMarkers, setContextMarkers] = useState("");
  const [routerDesc, setRouterDesc] = useState("");
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [categories, setCategories] = useState("");
  const [extractionPrompt, setExtractionPrompt] = useState("");

  const canNext = () => {
    if (step === 0) return agentId.trim() && name.trim();
    if (step === 1) return systemPrompt.trim();
    return true;
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const req: CreateAgentRequest = {
        agent_id: agentId.trim(),
        name: name.trim(),
        description: description.trim(),
        prompts: {
          system_prompt: systemPrompt.trim(),
          user_instruction: userInstruction.trim(),
          disclaimer: disclaimer.trim(),
        },
        routing: {
          strong_indicators: keywords
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          context_markers: contextMarkers
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          router_description: routerDesc.trim(),
        },
        memory_config: {
          enabled: memoryEnabled,
          categories: categories
            .split(",")
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean),
          decay_rates: {},
          extraction_prompt: extractionPrompt.trim(),
        },
        capabilities: ["prompt_editor", "routing_config", "memory_config", "ontology", "model_config", "cost_dashboard", "rag_corpus", "user_memory", "agent_builder", "sandbox"],
      };

      const result = await createDynamicAgent(req);
      toast.success("Agent created", {
        description: `${name} (${result.agent_id}) is now in ${result.status} status`,
      });

      // Refresh agent list and select the new agent
      const data = await fetchAgents();
      setAgents(data.agents);
      setSelectedAgentId(result.agent_id);
      onClose();
    } catch (err) {
      toast.error("Failed to create agent", {
        description: (err as Error).message,
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4 shadow-2xl border-border/50 animate-in slide-in-from-bottom-4 duration-300">
        <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-primary/10 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Create New Agent</CardTitle>
              <CardDescription>
                Step {step + 1} of {STEPS.length}: {STEPS[step]}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X size={16} />
            </Button>
          </div>
          {/* Progress bar */}
          <div className="flex gap-1.5 mt-3">
            {STEPS.map((s, i) => (
              <div key={i} className="flex-1">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i < step
                      ? "bg-primary"
                      : i === step
                        ? "bg-primary/70 animate-pulse"
                        : "bg-muted"
                  }`}
                />
                <p
                  className={`text-[10px] mt-1 transition-colors ${
                    i <= step
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  {s}
                </p>
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Step 1: Basic Info */}
          {step === 0 && (
            <>
              <div>
                <label className="text-sm font-medium">
                  Agent ID <span className="text-destructive">*</span>
                </label>
                <input
                  value={agentId}
                  onChange={(e) =>
                    setAgentId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                  }
                  placeholder="e.g. sleep_wellness"
                  className="w-full mt-1 h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lowercase letters, numbers, underscores only
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">
                  Display Name <span className="text-destructive">*</span>
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sleep Wellness Coach"
                  className="w-full mt-1 h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Helps users improve sleep with evidence-based techniques..."
                  rows={3}
                  className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
            </>
          )}

          {/* Step 2: System Prompt */}
          {step === 1 && (
            <>
              <div>
                <label className="text-sm font-medium">
                  System Prompt <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="You are a compassionate sleep wellness coach..."
                  rows={8}
                  className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                />
              </div>
              <div>
                <label className="text-sm font-medium">User Instruction</label>
                <textarea
                  value={userInstruction}
                  onChange={(e) => setUserInstruction(e.target.value)}
                  placeholder="Always ask about sleep schedule first..."
                  rows={3}
                  className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Appended to system prompt as additional instructions
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Disclaimer</label>
                <input
                  value={disclaimer}
                  onChange={(e) => setDisclaimer(e.target.value)}
                  placeholder="This is not medical advice."
                  className="w-full mt-1 h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </>
          )}

          {/* Step 3: Routing & Memory */}
          {step === 2 && (
            <>
              <div>
                <label className="text-sm font-medium">
                  Routing Keywords
                </label>
                <input
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="insomnia, sleep hygiene, can't sleep"
                  className="w-full mt-1 h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Comma-separated keywords that route messages to this agent
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Context Markers</label>
                <input
                  value={contextMarkers}
                  onChange={(e) => setContextMarkers(e.target.value)}
                  placeholder={`[Using ${agentId || "agent"} agent]`}
                  className="w-full mt-1 h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  Router Description
                </label>
                <input
                  value={routerDesc}
                  onChange={(e) => setRouterDesc(e.target.value)}
                  placeholder="SLEEP_WELLNESS: sleep disorders, insomnia, sleep hygiene"
                  className="w-full mt-1 h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="memory-enabled"
                    checked={memoryEnabled}
                    onChange={(e) => setMemoryEnabled(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="memory-enabled" className="text-sm font-medium">
                    Enable User Memory
                  </label>
                </div>
                {memoryEnabled && (
                  <>
                    <div className="mb-3">
                      <label className="text-sm font-medium">
                        Memory Categories
                      </label>
                      <input
                        value={categories}
                        onChange={(e) => setCategories(e.target.value)}
                        placeholder="DEMOGRAPHICS, SLEEP_PATTERNS, TRIGGERS"
                        className="w-full mt-1 h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Extraction Prompt
                      </label>
                      <textarea
                        value={extractionPrompt}
                        onChange={(e) => setExtractionPrompt(e.target.value)}
                        placeholder="Extract facts about sleep patterns, triggers..."
                        rows={3}
                        className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                      />
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* Step 4: Review */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                    Agent ID
                  </p>
                  <p className="text-sm font-mono font-semibold">{agentId}</p>
                </div>
                <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                    Display Name
                  </p>
                  <p className="text-sm font-semibold">{name}</p>
                </div>
              </div>
              {description && (
                <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                    Description
                  </p>
                  <p className="text-sm text-foreground/80">{description}</p>
                </div>
              )}
              <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                  System Prompt
                </p>
                <p className="text-xs font-mono text-foreground/70 whitespace-pre-wrap line-clamp-4 leading-relaxed">
                  {systemPrompt}
                </p>
              </div>
              {keywords && (
                <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                    Routing Keywords
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {keywords
                      .split(",")
                      .map((k) => k.trim())
                      .filter(Boolean)
                      .map((k) => (
                        <span
                          key={k}
                          className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        >
                          {k}
                        </span>
                      ))}
                  </div>
                </div>
              )}
              <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                  Memory
                </p>
                <p className="text-sm">
                  {memoryEnabled ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      Enabled — {categories.split(",").filter((s) => s.trim()).length} categories
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-gray-400" />
                      Disabled
                    </span>
                  )}
                </p>
              </div>
              <div className="rounded-xl border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Agent will be created in <strong>draft</strong> status. You can test and activate it from the Sandbox tab.
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => (step > 0 ? setStep(step - 1) : onClose())}
              disabled={creating}
            >
              <ArrowLeft size={14} className="mr-1" />
              {step > 0 ? "Back" : "Cancel"}
            </Button>

            {step < STEPS.length - 1 ? (
              <Button
                size="sm"
                onClick={() => setStep(step + 1)}
                disabled={!canNext()}
              >
                Next
                <ArrowRight size={14} className="ml-1" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={creating || !canNext()}
              >
                {creating ? (
                  <Loader2 size={14} className="mr-1 animate-spin" />
                ) : (
                  <Check size={14} className="mr-1" />
                )}
                {creating ? "Creating..." : "Create Agent"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
