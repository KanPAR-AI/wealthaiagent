import { useEffect, useState, useCallback } from "react";
import { Save, RotateCcw, History, Loader2, Clock, FileText } from "lucide-react";
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
  fetchPromptVersions,
  updatePrompts,
  restorePromptVersion,
} from "@/services/agent-builder-service";
import type { PromptVersion } from "@/services/agent-builder-service";
import { toast } from "sonner";

interface Props {
  agentId: string;
}

export function PromptEditor({ agentId }: Props) {
  const {
    agentConfig,
    setAgentConfig,
    promptVersions,
    setPromptVersions,
    loading,
    setLoading,
  } = useAdminStore();

  const [systemPrompt, setSystemPrompt] = useState("");
  const [userInstruction, setUserInstruction] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [dirty, setDirty] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading("promptEditor", true);
    try {
      const config = await fetchAgentConfig(agentId);
      setAgentConfig(config);
      setSystemPrompt(config.prompts.system_prompt);
      setUserInstruction(config.prompts.user_instruction);
      setDirty(false);
    } catch (err) {
      toast.error("Failed to load agent config", {
        description: (err as Error).message,
      });
    } finally {
      setLoading("promptEditor", false);
    }
  }, [agentId, setAgentConfig, setLoading]);

  const loadVersions = useCallback(async () => {
    try {
      const data = await fetchPromptVersions(agentId);
      setPromptVersions(data.versions);
    } catch (err) {
      toast.error("Failed to load versions", {
        description: (err as Error).message,
      });
    }
  }, [agentId, setPromptVersions]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (showHistory) loadVersions();
  }, [showHistory, loadVersions]);

  // Track dirty
  useEffect(() => {
    if (!agentConfig) return;
    const changed =
      systemPrompt !== agentConfig.prompts.system_prompt ||
      userInstruction !== agentConfig.prompts.user_instruction;
    setDirty(changed);
  }, [systemPrompt, userInstruction, agentConfig]);

  const handleSave = async () => {
    if (!changeNote.trim()) {
      toast.error("Please add a change note");
      return;
    }
    setLoading("promptSave", true);
    try {
      const result = await updatePrompts(
        agentId,
        systemPrompt,
        userInstruction,
        changeNote.trim()
      );
      toast.success("Prompts saved", {
        description: `Version ${result.version} created`,
      });
      setChangeNote("");
      await loadConfig();
      if (showHistory) await loadVersions();
    } catch (err) {
      toast.error("Failed to save prompts", {
        description: (err as Error).message,
      });
    } finally {
      setLoading("promptSave", false);
    }
  };

  const handleRestore = async (version: PromptVersion) => {
    if (!confirm(`Restore version ${version.version}? This creates a new version.`))
      return;
    try {
      const result = await restorePromptVersion(agentId, version.version);
      toast.success(`Restored to version ${result.restored_version}`, {
        description: `New version ${result.new_version} created`,
      });
      await loadConfig();
      await loadVersions();
    } catch (err) {
      toast.error("Failed to restore version", {
        description: (err as Error).message,
      });
    }
  };

  if (loading["promptEditor"]) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* System Prompt */}
      <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2 bg-gradient-to-r from-blue-500/5 to-transparent rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <FileText size={14} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-sm">System Prompt</CardTitle>
                <CardDescription className="text-xs">
                  Core agent personality and instructions
                  {agentConfig?.prompts.active_version != null && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      v{agentConfig.prompts.active_version}
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="rounded-lg"
            >
              <History size={14} className="mr-1" />
              {showHistory ? "Hide" : "History"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={12}
            className="w-full rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary/30 resize-y transition-colors"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] text-muted-foreground">
              {systemPrompt.length} characters
            </p>
            {dirty && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-medium">
                Unsaved changes
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* User Instruction */}
      <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">User Instruction</CardTitle>
          <CardDescription className="text-xs">
            Additional instructions appended to system prompt
          </CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            value={userInstruction}
            onChange={(e) => setUserInstruction(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary/30 resize-y transition-colors"
          />
        </CardContent>
      </Card>

      {/* Save controls */}
      {dirty && (
        <Card className="border-primary/20 bg-primary/[0.02] shadow-sm animate-in slide-in-from-bottom-2 duration-200">
          <CardContent className="pt-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-xs font-semibold text-foreground/80">Change Note</label>
                <input
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                  placeholder="e.g. Added CBT-I techniques section"
                  className="w-full mt-1.5 h-9 rounded-lg border border-border/50 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors"
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                />
              </div>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={loading["promptSave"] || !changeNote.trim()}
                className="rounded-lg"
              >
                {loading["promptSave"] ? (
                  <Loader2 size={14} className="mr-1 animate-spin" />
                ) : (
                  <Save size={14} className="mr-1" />
                )}
                {loading["promptSave"] ? "Saving..." : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Version History */}
      {showHistory && (
        <Card className="border-border/50 shadow-sm animate-in slide-in-from-top-2 duration-200">
          <CardHeader className="pb-2 bg-gradient-to-r from-muted/50 to-transparent rounded-t-lg">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-muted-foreground" />
              <CardTitle className="text-sm">Version History</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {promptVersions.length === 0 ? (
              <div className="text-center py-8">
                <Clock size={24} className="mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No versions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {promptVersions.map((v) => (
                  <div
                    key={v.version}
                    className={`flex items-center justify-between rounded-xl border p-3 transition-colors hover:bg-muted/30 ${
                      v.version === agentConfig?.prompts.active_version
                        ? "border-primary/30 bg-primary/[0.03]"
                        : "border-border/50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">
                          v{v.version}
                        </p>
                        {v.version === agentConfig?.prompts.active_version && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">
                            active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {v.change_note || "No note"} — {v.created_by}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">
                        {new Date(v.created_at).toLocaleString()}
                      </p>
                    </div>
                    {v.version !== agentConfig?.prompts.active_version && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(v)}
                        className="rounded-lg ml-3 shrink-0"
                      >
                        <RotateCcw size={12} className="mr-1" />
                        Restore
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
