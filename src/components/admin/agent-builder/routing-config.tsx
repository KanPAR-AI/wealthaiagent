import { useEffect, useState, useCallback } from "react";
import { Save, X, Plus, Loader2, Route, Signpost, MessageSquare } from "lucide-react";
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

export function RoutingConfig({ agentId }: Props) {
  const { agentConfig, setAgentConfig, loading, setLoading } = useAdminStore();

  const [indicators, setIndicators] = useState<string[]>([]);
  const [markers, setMarkers] = useState<string[]>([]);
  const [routerDesc, setRouterDesc] = useState("");
  const [newIndicator, setNewIndicator] = useState("");
  const [newMarker, setNewMarker] = useState("");
  const [dirty, setDirty] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading("routing", true);
    try {
      const config = await fetchAgentConfig(agentId);
      setAgentConfig(config);
      setIndicators(config.routing.strong_indicators);
      setMarkers(config.routing.context_markers);
      setRouterDesc(config.routing.router_description);
      setDirty(false);
    } catch (err) {
      toast.error("Failed to load routing config", {
        description: (err as Error).message,
      });
    } finally {
      setLoading("routing", false);
    }
  }, [agentId, setAgentConfig, setLoading]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const addIndicator = () => {
    const val = newIndicator.trim();
    if (val && !indicators.includes(val)) {
      setIndicators([...indicators, val]);
      setNewIndicator("");
      setDirty(true);
    }
  };

  const removeIndicator = (idx: number) => {
    setIndicators(indicators.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const addMarker = () => {
    const val = newMarker.trim();
    if (val && !markers.includes(val)) {
      setMarkers([...markers, val]);
      setNewMarker("");
      setDirty(true);
    }
  };

  const removeMarker = (idx: number) => {
    setMarkers(markers.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const handleSave = async () => {
    setLoading("routingSave", true);
    try {
      await updateAgentConfig(agentId, {
        routing: {
          strong_indicators: indicators,
          context_markers: markers,
          router_description: routerDesc.trim(),
        },
      } as any);
      toast.success("Routing config saved");
      setDirty(false);
      await loadConfig();
    } catch (err) {
      toast.error("Failed to save routing config", {
        description: (err as Error).message,
      });
    } finally {
      setLoading("routingSave", false);
    }
  };

  if (loading["routing"]) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Strong Indicators */}
      <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2 bg-gradient-to-r from-blue-500/5 to-transparent rounded-t-lg">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Route size={14} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-sm">Strong Indicators</CardTitle>
              <CardDescription className="text-xs">
                Keywords that route messages directly to this agent
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5 mb-3 min-h-[32px]">
            {indicators.map((ind, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 transition-all hover:bg-blue-200 dark:hover:bg-blue-900/50"
              >
                {ind}
                <button
                  onClick={() => removeIndicator(i)}
                  className="hover:text-destructive transition-colors"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            {indicators.length === 0 && (
              <span className="text-xs text-muted-foreground/60 italic py-1">
                No keywords added yet
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={newIndicator}
              onChange={(e) => setNewIndicator(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addIndicator()}
              placeholder="Add keyword..."
              className="flex-1 h-9 rounded-lg border border-border/50 bg-muted/20 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary/30 transition-colors"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={addIndicator}
              disabled={!newIndicator.trim()}
              className="rounded-lg"
            >
              <Plus size={14} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Context Markers */}
      <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2 bg-gradient-to-r from-purple-500/5 to-transparent rounded-t-lg">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Signpost size={14} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-sm">Context Markers</CardTitle>
              <CardDescription className="text-xs">
                Markers for context continuity in multi-turn conversations
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5 mb-3 min-h-[32px]">
            {markers.map((m, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 transition-all hover:bg-purple-200 dark:hover:bg-purple-900/50"
              >
                {m}
                <button
                  onClick={() => removeMarker(i)}
                  className="hover:text-destructive transition-colors"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            {markers.length === 0 && (
              <span className="text-xs text-muted-foreground/60 italic py-1">
                No markers added yet
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={newMarker}
              onChange={(e) => setNewMarker(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMarker()}
              placeholder="Add marker..."
              className="flex-1 h-9 rounded-lg border border-border/50 bg-muted/20 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary/30 transition-colors"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={addMarker}
              disabled={!newMarker.trim()}
              className="rounded-lg"
            >
              <Plus size={14} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Router Description */}
      <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2 bg-gradient-to-r from-emerald-500/5 to-transparent rounded-t-lg">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <MessageSquare size={14} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-sm">Router Description</CardTitle>
              <CardDescription className="text-xs">
                Description used by the LLM router to classify messages
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <textarea
            value={routerDesc}
            onChange={(e) => {
              setRouterDesc(e.target.value);
              setDirty(true);
            }}
            rows={3}
            placeholder="SLEEP_WELLNESS: sleep disorders, insomnia, circadian rhythm"
            className="w-full rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary/30 resize-y transition-colors"
          />
        </CardContent>
      </Card>

      {/* Save */}
      {dirty && (
        <div className="flex justify-end animate-in slide-in-from-bottom-2 duration-200">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={loading["routingSave"]}
            className="rounded-lg shadow-sm"
          >
            {loading["routingSave"] ? (
              <Loader2 size={14} className="mr-1 animate-spin" />
            ) : (
              <Save size={14} className="mr-1" />
            )}
            {loading["routingSave"] ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
