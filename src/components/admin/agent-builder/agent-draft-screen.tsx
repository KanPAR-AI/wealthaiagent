/**
 * Goal-First Agent Draft Screen — Phase 1C
 *
 * Replaces the 4-step creation wizard with a single-screen flow:
 *   1. Admin types a one-sentence goal
 *   2. Claude Opus 4.6 drafts the ENTIRE config (prompt, routing,
 *      memory, ontology, 10 example queries)
 *   3. Admin edits what they want inline
 *   4. Click "Create Agent" to persist and activate editing flow
 *
 * Escape hatch: "Advanced: manual create" link switches to the
 * original 4-step wizard for admins who want full control from
 * the start. Kept as a safety net until goal-first proves itself
 * across a variety of domains.
 */

import { useState } from "react";
import { X, Sparkles, Loader2, RefreshCw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  draftFromGoal,
  createDynamicAgent,
} from "@/services/agent-builder-service";
import type {
  AgentDraft,
  CreateAgentRequest,
} from "@/services/agent-builder-service";
import { useAdminStore } from "@/store/admin";
import { fetchAgents } from "@/services/admin-service";
import { toast } from "sonner";

interface Props {
  onClose: () => void;
  onOpenManualWizard: () => void;
}

const DEFAULT_CAPABILITIES = [
  "prompt_editor",
  "routing_config",
  "memory_config",
  "ontology",
  "model_config",
  "cost_dashboard",
  "rag_corpus",
  "user_memory",
  "agent_builder",
  "sandbox",
];

export function AgentDraftScreen({ onClose, onOpenManualWizard }: Props) {
  const { setAgents, setSelectedAgentId } = useAdminStore();

  const [goal, setGoal] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<AgentDraft | null>(null);

  // These mirror the draft so the admin can edit inline without
  // mutating the pristine draft (letting them regenerate cleanly).
  const [editedAgentId, setEditedAgentId] = useState("");
  const [editedName, setEditedName] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [editedSystemPrompt, setEditedSystemPrompt] = useState("");
  const [editedDisclaimer, setEditedDisclaimer] = useState("");
  const [editedUserInstruction, setEditedUserInstruction] = useState("");
  const [editedKeywords, setEditedKeywords] = useState("");
  const [editedCategories, setEditedCategories] = useState("");

  const applyDraft = (d: AgentDraft) => {
    setDraft(d);
    setEditedAgentId(d.agent_id);
    setEditedName(d.name);
    setEditedDescription(d.description);
    setEditedSystemPrompt(d.prompts.system_prompt);
    setEditedDisclaimer(d.prompts.disclaimer);
    setEditedUserInstruction(d.prompts.user_instruction);
    setEditedKeywords(d.routing.strong_indicators.join(", "));
    setEditedCategories(d.memory_config.categories.join(", "));
  };

  const handleDraft = async () => {
    if (goal.trim().length < 10) {
      toast.error("Goal too short", {
        description: "Please describe what the agent should do in at least 10 characters.",
      });
      return;
    }
    setDrafting(true);
    try {
      const res = await draftFromGoal(goal.trim());
      applyDraft(res.draft);
      toast.success("Draft ready", {
        description: `Claude drafted ${res.draft.example_queries.length} example queries to seed your eval set.`,
      });
    } catch (err) {
      toast.error("Draft failed", {
        description: (err as Error).message,
      });
    } finally {
      setDrafting(false);
    }
  };

  const handleCreate = async () => {
    if (!draft) return;
    if (!editedAgentId.trim() || !editedName.trim() || !editedSystemPrompt.trim()) {
      toast.error("Missing required fields", {
        description: "agent_id, name, and system prompt are required.",
      });
      return;
    }
    setCreating(true);
    try {
      const req: CreateAgentRequest = {
        agent_id: editedAgentId.trim(),
        name: editedName.trim(),
        description: editedDescription.trim(),
        prompts: {
          system_prompt: editedSystemPrompt.trim(),
          user_instruction: editedUserInstruction.trim(),
          disclaimer: editedDisclaimer.trim(),
        },
        routing: {
          strong_indicators: editedKeywords
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          context_markers: draft.routing.context_markers,
          router_description: draft.routing.router_description,
        },
        memory_config: {
          enabled: true,
          categories: editedCategories
            .split(",")
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean),
          decay_rates: draft.memory_config.decay_rates,
          extraction_prompt: draft.memory_config.extraction_prompt,
        },
        capabilities: DEFAULT_CAPABILITIES,
      };

      const result = await createDynamicAgent(req);
      toast.success("Agent created", {
        description: `${editedName} (${result.agent_id}) is now in ${result.status} status`,
      });

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
      <Card className="w-full max-w-3xl max-h-[92vh] overflow-y-auto mx-4 shadow-2xl border-border/50 animate-in slide-in-from-bottom-4 duration-300">
        <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-primary/10 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Create Agent
              </CardTitle>
              <CardDescription>
                Describe what you want in one sentence. Claude Opus 4.6 drafts the rest.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-5 space-y-5">
          {/* ── Step 1: Goal input ─────────────────────────────────── */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              What should this agent do?
            </label>
            <Textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Help users understand and improve their sleep quality using CBT-I techniques, sleep hygiene coaching, and habit tracking."
              rows={3}
              className="resize-none"
              disabled={drafting || creating}
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onOpenManualWizard}
                className="text-xs text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
                disabled={drafting || creating}
              >
                Advanced: skip AI, manual create
              </button>
              <Button
                onClick={handleDraft}
                disabled={drafting || creating || goal.trim().length < 10}
                size="sm"
                className="gap-2"
              >
                {drafting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Drafting…
                  </>
                ) : draft ? (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Redraft
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Draft with AI
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* ── Step 2: Inline edit the draft ──────────────────────── */}
          {draft && (
            <div className="space-y-4 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary">
                  Edit the draft
                </h3>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {draft.example_queries.length} example queries in draft
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Agent ID</label>
                  <Input
                    value={editedAgentId}
                    onChange={(e) => setEditedAgentId(e.target.value)}
                    placeholder="sleep_wellness"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Display name</label>
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    placeholder="Sleep Wellness Coach"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Description</label>
                <Input
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  System prompt
                </label>
                <Textarea
                  value={editedSystemPrompt}
                  onChange={(e) => setEditedSystemPrompt(e.target.value)}
                  rows={8}
                  className="text-sm font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  User instruction
                </label>
                <Textarea
                  value={editedUserInstruction}
                  onChange={(e) => setEditedUserInstruction(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  Routing keywords (comma-separated)
                </label>
                <Input
                  value={editedKeywords}
                  onChange={(e) => setEditedKeywords(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  Memory categories (comma-separated, auto-uppercased)
                </label>
                <Input
                  value={editedCategories}
                  onChange={(e) => setEditedCategories(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  Disclaimer
                </label>
                <Textarea
                  value={editedDisclaimer}
                  onChange={(e) => setEditedDisclaimer(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
              </div>

              {/* ── Example queries (read-only preview) ───────────── */}
              <details className="rounded-md border border-border/40 bg-muted/20 p-2">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  Example queries seed (future eval set)
                </summary>
                <ul className="mt-2 space-y-1 pl-3">
                  {draft.example_queries.map((q, i) => (
                    <li
                      key={i}
                      className="text-xs text-muted-foreground before:content-['•_'] before:text-primary"
                    >
                      {q}
                    </li>
                  ))}
                </ul>
              </details>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={creating}
                  size="sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={creating || !editedAgentId.trim() || !editedName.trim() || !editedSystemPrompt.trim()}
                  size="sm"
                  className="gap-2"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create Agent
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
