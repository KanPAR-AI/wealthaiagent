import { useState } from "react";
import { Search, Trash2, Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAdminStore } from "@/store/admin";
import { fetchUserMemory, clearUserMemory } from "@/services/admin-service";
import { toast } from "sonner";

const CATEGORY_COLORS: Record<string, string> = {
  DEMOGRAPHICS: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  CONDITIONS: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  MEDICATIONS: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  TRIGGERS: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  COPING: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  MOOD: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  THERAPY: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  CRISIS_HISTORY: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  PREFERENCES: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
};

export function UserMemoryPanel({ agentId }: { agentId: string }) {
  const { userMemoryData, setUserMemoryData, loading, setLoading } = useAdminStore();
  const [userId, setUserId] = useState("");

  const handleSearch = async () => {
    if (!userId.trim()) return;
    setLoading("memory", true);
    try {
      const data = await fetchUserMemory(agentId, userId.trim());
      setUserMemoryData(data);
    } catch (err) {
      toast.error(`Failed to load memory: ${(err as Error).message}`);
      setUserMemoryData(null);
    } finally {
      setLoading("memory", false);
    }
  };

  const handleClear = async () => {
    if (!userMemoryData?.user_id) return;
    if (!confirm(`Clear ALL memory for user ${userMemoryData.user_id}? This cannot be undone.`))
      return;
    try {
      const result = await clearUserMemory(agentId, userMemoryData.user_id);
      toast.success(`Cleared ${result.facts_cleared} facts`);
      setUserMemoryData(null);
    } catch (err) {
      toast.error(`Clear failed: ${(err as Error).message}`);
    }
  };

  // Group facts by category
  const factsByCategory: Record<string, typeof userMemoryData extends null ? never : NonNullable<typeof userMemoryData>["facts"]> = {};
  if (userMemoryData?.facts) {
    for (const fact of userMemoryData.facts) {
      if (!factsByCategory[fact.category]) factsByCategory[fact.category] = [];
      factsByCategory[fact.category].push(fact);
    }
  }

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-md bg-background"
                placeholder="Enter user ID to search..."
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button size="sm" onClick={handleSearch} disabled={!userId.trim() || loading["memory"]}>
              {loading["memory"] ? "Searching..." : "Search"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {userMemoryData && (
        <>
          {/* Summary header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain size={16} />
              <span className="text-sm font-medium">
                User: {userMemoryData.user_id}
              </span>
              <span className="text-xs text-muted-foreground">
                ({userMemoryData.total_facts} facts)
              </span>
            </div>
            {userMemoryData.total_facts > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleClear}
              >
                <Trash2 size={14} className="mr-1" /> Clear All
              </Button>
            )}
          </div>

          {/* Facts by category */}
          {userMemoryData.total_facts === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No memory facts stored for this user.
              </CardContent>
            </Card>
          ) : (
            Object.entries(factsByCategory).map(([category, facts]) => (
              <Card key={category}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        CATEGORY_COLORS[category] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {category.replace("_", " ")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {facts.length} fact{facts.length !== 1 ? "s" : ""}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    {facts.map((fact, i) => (
                      <div
                        key={`${fact.key}-${i}`}
                        className="flex items-start gap-2 text-sm py-1 border-b last:border-0"
                      >
                        <span className="font-medium text-muted-foreground min-w-[120px]">
                          {fact.key}:
                        </span>
                        <span className="flex-1">{fact.value}</span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {(fact.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </>
      )}

      {/* Empty state */}
      {!userMemoryData && !loading["memory"] && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Enter a user ID above to view their stored memory facts.
        </div>
      )}
    </div>
  );
}
