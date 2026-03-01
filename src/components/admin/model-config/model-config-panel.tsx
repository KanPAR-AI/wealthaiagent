import { useEffect, useState, useCallback } from "react";
import { Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAdminStore } from "@/store/admin";
import { fetchModelConfig, updateModelConfig } from "@/services/admin-service";
import { toast } from "sonner";

export function ModelConfigPanel({ agentId }: { agentId: string }) {
  const { modelConfig, setModelConfig, loading, setLoading } = useAdminStore();
  const [localSlots, setLocalSlots] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading("models", true);
    try {
      const data = await fetchModelConfig(agentId);
      setModelConfig(data);
      // Initialize local state from current config
      const initial: Record<string, string> = {};
      for (const [key, slot] of Object.entries(data.model_slots)) {
        initial[key] = slot.current_model;
      }
      setLocalSlots(initial);
      setDirty(false);
    } catch (err: unknown) {
      toast.error("Failed to load model config", { description: (err as Error).message });
    } finally {
      setLoading("models", false);
    }
  }, [agentId, setModelConfig, setLoading]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleChange = (slotName: string, model: string) => {
    setLocalSlots((prev) => ({ ...prev, [slotName]: model }));
    setDirty(true);
  };

  const handleSave = async () => {
    setLoading("modelsSave", true);
    try {
      await updateModelConfig(agentId, localSlots);
      toast.success("Model configuration updated", {
        description: "Changes take effect on the next request",
      });
      setDirty(false);
      loadConfig(); // Refresh to confirm
    } catch (err: unknown) {
      toast.error("Failed to update config", { description: (err as Error).message });
    } finally {
      setLoading("modelsSave", false);
    }
  };

  const handleReset = () => {
    if (!modelConfig) return;
    const reset: Record<string, string> = {};
    for (const [key, slot] of Object.entries(modelConfig.model_slots)) {
      reset[key] = slot.default_model;
    }
    setLocalSlots(reset);
    setDirty(true);
  };

  if (loading["models"]) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!modelConfig) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Model Configuration</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={!dirty}>
            <RotateCcw size={14} />
            Reset to Defaults
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirty || loading["modelsSave"]}
          >
            <Save size={14} />
            {loading["modelsSave"] ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {Object.entries(modelConfig.model_slots).map(([slotName, slot]) => (
          <Card key={slotName}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{slot.label}</CardTitle>
              <CardDescription className="text-xs">{slot.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <select
                value={localSlots[slotName] || slot.current_model}
                onChange={(e) => handleChange(slotName, e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {slot.allowed_models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                    {m === slot.default_model ? " (default)" : ""}
                  </option>
                ))}
              </select>
              {localSlots[slotName] !== slot.current_model && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Changed from: {slot.current_model}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
