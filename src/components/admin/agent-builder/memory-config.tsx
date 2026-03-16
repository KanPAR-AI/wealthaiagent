import { useEffect, useState, useCallback } from "react";
import { Save, X, Plus, Loader2, Brain, Sparkles } from "lucide-react";
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
  updateAgentConfig,
} from "@/services/agent-builder-service";
import { toast } from "sonner";

interface Props {
  agentId: string;
}

export function MemoryConfigPanel({ agentId }: Props) {
  const { agentConfig, setAgentConfig, loading, setLoading } = useAdminStore();

  const [enabled, setEnabled] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [decayRates, setDecayRates] = useState<Record<string, number>>({});
  const [extractionPrompt, setExtractionPrompt] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [dirty, setDirty] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading("memoryConfig", true);
    try {
      const config = await fetchAgentConfig(agentId);
      setAgentConfig(config);
      setEnabled(config.memory_config.enabled);
      setCategories(config.memory_config.categories);
      setDecayRates(config.memory_config.decay_rates);
      setExtractionPrompt(config.memory_config.extraction_prompt);
      setDirty(false);
    } catch (err) {
      toast.error("Failed to load memory config", {
        description: (err as Error).message,
      });
    } finally {
      setLoading("memoryConfig", false);
    }
  }, [agentId, setAgentConfig, setLoading]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const addCategory = () => {
    const val = newCategory.trim().toUpperCase();
    if (val && !categories.includes(val)) {
      setCategories([...categories, val]);
      setDecayRates({ ...decayRates, [val]: 0.05 });
      setNewCategory("");
      setDirty(true);
    }
  };

  const removeCategory = (cat: string) => {
    setCategories(categories.filter((c) => c !== cat));
    const newRates = { ...decayRates };
    delete newRates[cat];
    setDecayRates(newRates);
    setDirty(true);
  };

  const updateDecayRate = (cat: string, rate: number) => {
    setDecayRates({ ...decayRates, [cat]: rate });
    setDirty(true);
  };

  const handleSave = async () => {
    setLoading("memorySave", true);
    try {
      await updateAgentConfig(agentId, {
        memory_config: {
          enabled,
          categories,
          decay_rates: decayRates,
          extraction_prompt: extractionPrompt.trim(),
        },
      } as any);
      toast.success("Memory config saved");
      setDirty(false);
      await loadConfig();
    } catch (err) {
      toast.error("Failed to save memory config", {
        description: (err as Error).message,
      });
    } finally {
      setLoading("memorySave", false);
    }
  };

  if (loading["memoryConfig"]) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Enable Toggle */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors ${
                enabled
                  ? "bg-gradient-to-br from-violet-500/20 to-purple-500/20"
                  : "bg-muted/50"
              }`}>
                <Brain size={18} className={enabled ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground"} />
              </div>
              <div>
                <p className="text-sm font-semibold">User Memory</p>
                <p className="text-xs text-muted-foreground">
                  Extract and remember facts from conversations
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setEnabled(!enabled);
                setDirty(true);
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                enabled ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {enabled && (
        <>
          {/* Categories + Decay Rates */}
          <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-200 animate-in slide-in-from-top-2 duration-300">
            <CardHeader className="pb-2 bg-gradient-to-r from-violet-500/5 to-transparent rounded-t-lg">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Sparkles size={14} className="text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <CardTitle className="text-sm">Memory Categories</CardTitle>
                  <CardDescription className="text-xs">
                    Each category has its own decay rate (0 = permanent, 0.5 = fast decay)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-3">
                {categories.map((cat) => (
                  <div
                    key={cat}
                    className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/20 p-3 hover:bg-muted/30 transition-colors"
                  >
                    <span className="text-xs font-mono font-semibold min-w-[140px] px-2.5 py-1 rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                      {cat}
                    </span>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground/60">slow</span>
                      <input
                        type="range"
                        min={0}
                        max={0.5}
                        step={0.01}
                        value={decayRates[cat] ?? 0.05}
                        onChange={(e) =>
                          updateDecayRate(cat, parseFloat(e.target.value))
                        }
                        className="flex-1 h-1.5 accent-primary cursor-pointer"
                      />
                      <span className="text-[10px] text-muted-foreground/60">fast</span>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground w-10 text-right tabular-nums">
                      {(decayRates[cat] ?? 0.05).toFixed(2)}
                    </span>
                    <button
                      onClick={() => removeCategory(cat)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md hover:bg-destructive/10"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {categories.length === 0 && (
                  <div className="text-center py-6">
                    <Brain size={24} className="mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground/60 italic">
                      No categories added yet
                    </p>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCategory()}
                  placeholder="e.g. SLEEP_PATTERNS"
                  className="flex-1 h-9 rounded-lg border border-border/50 bg-muted/20 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary/30 transition-colors"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addCategory}
                  disabled={!newCategory.trim()}
                  className="rounded-lg"
                >
                  <Plus size={14} />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Extraction Prompt */}
          <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-200 animate-in slide-in-from-top-2 duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Extraction Prompt</CardTitle>
              <CardDescription className="text-xs">
                LLM prompt used to extract facts from conversations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                value={extractionPrompt}
                onChange={(e) => {
                  setExtractionPrompt(e.target.value);
                  setDirty(true);
                }}
                rows={5}
                placeholder="Extract facts about sleep patterns, triggers, medications..."
                className="w-full rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary/30 resize-y transition-colors"
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* Save */}
      {dirty && (
        <div className="flex justify-end animate-in slide-in-from-bottom-2 duration-200">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={loading["memorySave"]}
            className="rounded-lg shadow-sm"
          >
            {loading["memorySave"] ? (
              <Loader2 size={14} className="mr-1 animate-spin" />
            ) : (
              <Save size={14} className="mr-1" />
            )}
            {loading["memorySave"] ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
