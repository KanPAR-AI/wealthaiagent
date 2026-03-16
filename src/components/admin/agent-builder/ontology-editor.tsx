import { useEffect, useState, useCallback } from "react";
import { Save, Trash2, Plus, Download, Upload, Loader2, BookOpen } from "lucide-react";
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
import type { OntologyEntity } from "@/services/agent-builder-service";
import { toast } from "sonner";

interface Props {
  agentId: string;
}

interface EntityRow {
  canonical: string;
  display_name: string;
  category: string;
  aliases: string;
}

export function OntologyEditor({ agentId }: Props) {
  const { setAgentConfig, loading, setLoading } = useAdminStore();

  const [rows, setRows] = useState<EntityRow[]>([]);
  const [dirty, setDirty] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading("ontology", true);
    try {
      const config = await fetchAgentConfig(agentId);
      setAgentConfig(config);
      const entities = config.ontology?.entities || {};
      setRows(
        Object.entries(entities).map(([key, ent]) => ({
          canonical: key,
          display_name: ent.display_name,
          category: ent.category,
          aliases: ent.aliases.join(", "),
        }))
      );
      setDirty(false);
    } catch (err) {
      toast.error("Failed to load ontology", {
        description: (err as Error).message,
      });
    } finally {
      setLoading("ontology", false);
    }
  }, [agentId, setAgentConfig, setLoading]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const addRow = () => {
    setRows([
      ...rows,
      { canonical: "", display_name: "", category: "", aliases: "" },
    ]);
    setDirty(true);
  };

  const removeRow = (idx: number) => {
    setRows(rows.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const updateRow = (idx: number, field: keyof EntityRow, value: string) => {
    const updated = [...rows];
    updated[idx] = { ...updated[idx], [field]: value };
    setRows(updated);
    setDirty(true);
  };

  const handleSave = async () => {
    const invalid = rows.some((r) => !r.canonical.trim());
    if (invalid) {
      toast.error("All entities need a canonical name");
      return;
    }

    setLoading("ontologySave", true);
    try {
      const entities: Record<string, OntologyEntity> = {};
      for (const row of rows) {
        entities[row.canonical.trim()] = {
          display_name: row.display_name.trim() || row.canonical.trim(),
          category: row.category.trim(),
          aliases: row.aliases
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean),
        };
      }
      await updateAgentConfig(agentId, {
        ontology: { entities },
      } as any);
      toast.success("Ontology saved", {
        description: `${Object.keys(entities).length} entities`,
      });
      setDirty(false);
    } catch (err) {
      toast.error("Failed to save ontology", {
        description: (err as Error).message,
      });
    } finally {
      setLoading("ontologySave", false);
    }
  };

  const exportJson = () => {
    const entities: Record<string, OntologyEntity> = {};
    for (const row of rows) {
      if (!row.canonical.trim()) continue;
      entities[row.canonical.trim()] = {
        display_name: row.display_name.trim() || row.canonical.trim(),
        category: row.category.trim(),
        aliases: row.aliases
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
      };
    }
    const blob = new Blob([JSON.stringify(entities, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${agentId}_ontology.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const entities: Record<string, OntologyEntity> = JSON.parse(text);
        setRows(
          Object.entries(entities).map(([key, ent]) => ({
            canonical: key,
            display_name: ent.display_name,
            category: ent.category,
            aliases: Array.isArray(ent.aliases) ? ent.aliases.join(", ") : "",
          }))
        );
        setDirty(true);
        toast.success(`Imported ${Object.keys(entities).length} entities`);
      } catch {
        toast.error("Invalid JSON file");
      }
    };
    input.click();
  };

  if (loading["ontology"]) {
    return (
      <div className="space-y-3">
        <div className="h-64 rounded-xl bg-muted/50 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2 bg-gradient-to-r from-amber-500/5 to-transparent rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <BookOpen size={14} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-sm">Domain Ontology</CardTitle>
                <CardDescription className="text-xs">
                  Entities, categories, and aliases for this agent's domain
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={importJson} className="rounded-lg">
                <Upload size={14} className="mr-1" />
                Import
              </Button>
              <Button variant="outline" size="sm" onClick={exportJson} className="rounded-lg">
                <Download size={14} className="mr-1" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length > 0 ? (
            <>
              {/* Table header */}
              <div className="grid grid-cols-[1fr_1fr_0.8fr_1.5fr_auto] gap-2 mb-2 px-3">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Canonical</span>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Display Name</span>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Category</span>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Aliases (comma-sep)</span>
                <span className="w-8" />
              </div>

              {/* Rows */}
              <div className="space-y-1.5">
                {rows.map((row, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_1fr_0.8fr_1.5fr_auto] gap-2 items-center rounded-xl border border-border/30 bg-muted/10 p-1.5 hover:bg-muted/20 transition-colors"
                  >
                    <input
                      value={row.canonical}
                      onChange={(e) => updateRow(i, "canonical", e.target.value)}
                      placeholder="insomnia"
                      className="h-8 rounded-lg border border-border/50 bg-background px-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors"
                    />
                    <input
                      value={row.display_name}
                      onChange={(e) => updateRow(i, "display_name", e.target.value)}
                      placeholder="Insomnia"
                      className="h-8 rounded-lg border border-border/50 bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors"
                    />
                    <input
                      value={row.category}
                      onChange={(e) => updateRow(i, "category", e.target.value)}
                      placeholder="condition"
                      className="h-8 rounded-lg border border-border/50 bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors"
                    />
                    <input
                      value={row.aliases}
                      onChange={(e) => updateRow(i, "aliases", e.target.value)}
                      placeholder="sleeplessness, trouble sleeping"
                      className="h-8 rounded-lg border border-border/50 bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors"
                    />
                    <button
                      onClick={() => removeRow(i)}
                      className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-10">
              <BookOpen size={32} className="mx-auto text-muted-foreground/25 mb-3" />
              <p className="text-sm text-muted-foreground/60">No entities defined</p>
              <p className="text-xs text-muted-foreground/40 mt-1">Add entities manually or import from JSON</p>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={addRow}
            className="mt-3 rounded-lg"
          >
            <Plus size={14} className="mr-1" />
            Add Entity
          </Button>
        </CardContent>
      </Card>

      {dirty && (
        <div className="flex justify-end animate-in slide-in-from-bottom-2 duration-200">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={loading["ontologySave"]}
            className="rounded-lg shadow-sm"
          >
            {loading["ontologySave"] ? (
              <Loader2 size={14} className="mr-1 animate-spin" />
            ) : (
              <Save size={14} className="mr-1" />
            )}
            {loading["ontologySave"] ? "Saving..." : "Save Ontology"}
          </Button>
        </div>
      )}
    </div>
  );
}
