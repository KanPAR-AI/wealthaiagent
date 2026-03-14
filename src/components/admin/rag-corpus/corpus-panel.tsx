import { useCallback, useEffect, useRef, useState } from "react";
import { Database, Youtube, FileText, Trash2, RefreshCw, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAdminStore } from "@/store/admin";
import {
  fetchCorpus,
  fetchCorpusStats,
  addCorpusYouTube,
  pollCorpusJob,
  deleteCorpusItem,
  reloadCorpusVectors,
} from "@/services/admin-service";
import type { CorpusJob } from "@/services/admin-service";
import { toast } from "sonner";

export function CorpusPanel({ agentId }: { agentId: string }) {
  const { corpusData, corpusStats, setCorpusData, setCorpusStats, loading, setLoading } =
    useAdminStore();

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeJob, setActiveJob] = useState<CorpusJob | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    setLoading("corpus", true);
    try {
      const [items, stats] = await Promise.all([
        fetchCorpus(agentId),
        fetchCorpusStats(agentId),
      ]);
      setCorpusData(items);
      setCorpusStats(stats);
    } catch (err) {
      toast.error(`Failed to load corpus: ${(err as Error).message}`);
    } finally {
      setLoading("corpus", false);
    }
  }, [agentId, setCorpusData, setCorpusStats, setLoading]);

  useEffect(() => {
    loadData();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadData]);

  const handleAddYouTube = async () => {
    if (!youtubeUrl.trim()) return;
    try {
      const result = await addCorpusYouTube(agentId, youtubeUrl.trim());
      setActiveJob({
        job_id: result.job_id,
        source_type: "youtube",
        source_ref: youtubeUrl,
        status: "pending",
        chunks_created: 0,
        error: null,
        created_at: new Date().toISOString(),
      });
      setYoutubeUrl("");
      setShowAddForm(false);
      toast.success("YouTube video job started");

      // Start polling
      pollRef.current = setInterval(async () => {
        try {
          const job = await pollCorpusJob(agentId, result.job_id);
          setActiveJob(job);
          if (job.status === "complete" || job.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            if (job.status === "complete") {
              toast.success(`Added ${job.chunks_created} chunks`);
              loadData();
            } else {
              toast.error(`Job failed: ${job.error}`);
            }
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }, 3000);
    } catch (err) {
      toast.error(`Failed to add video: ${(err as Error).message}`);
    }
  };

  const handleDelete = async (sourceId: string) => {
    if (!confirm("Delete this source and all its chunks?")) return;
    try {
      const result = await deleteCorpusItem(agentId, sourceId);
      toast.success(`Removed ${result.chunks_removed} chunks`);
      loadData();
    } catch (err) {
      toast.error(`Delete failed: ${(err as Error).message}`);
    }
  };

  const handleReloadVectors = async () => {
    if (!confirm("Reload all vectors into Redis from baked-in files?")) return;
    setLoading("reload", true);
    try {
      const result = await reloadCorpusVectors(agentId);
      toast.success(`Reloaded ${result.chunks_loaded} chunks into Redis`);
    } catch (err) {
      toast.error(`Reload failed: ${(err as Error).message}`);
    } finally {
      setLoading("reload", false);
    }
  };

  const sourceTypeIcon = (type: string) => {
    switch (type) {
      case "youtube": return <Youtube size={14} className="text-red-500" />;
      case "document": return <FileText size={14} className="text-blue-500" />;
      default: return <Database size={14} />;
    }
  };

  if (loading["corpus"]) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      {corpusStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{corpusStats.total_chunks}</p>
              <p className="text-xs text-muted-foreground">Total Chunks</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{corpusStats.unique_sources}</p>
              <p className="text-xs text-muted-foreground">Sources</p>
            </CardContent>
          </Card>
          {Object.entries(corpusStats.by_source_type).map(([type, count]) => (
            <Card key={type}>
              <CardContent className="p-4 flex items-center gap-2">
                {sourceTypeIcon(type)}
                <div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground capitalize">{type}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Active job progress */}
      {activeJob && (activeJob.status === "pending" || activeJob.status === "running") && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className="animate-spin" />
              <span className="text-sm font-medium">
                Processing: {activeJob.source_ref}
              </span>
              <span className="text-xs text-muted-foreground ml-auto capitalize">
                {activeJob.status}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
          <Plus size={14} className="mr-1" /> Add YouTube
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleReloadVectors}
          disabled={loading["reload"]}
        >
          <RefreshCw size={14} className={`mr-1 ${loading["reload"] ? "animate-spin" : ""}`} />
          Reload Vectors
        </Button>
      </div>

      {/* Add YouTube form */}
      {showAddForm && (
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-3 py-1.5 text-sm border rounded-md bg-background"
                placeholder="https://youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddYouTube()}
              />
              <Button size="sm" onClick={handleAddYouTube} disabled={!youtubeUrl.trim()}>
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Corpus items list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Corpus Sources</CardTitle>
        </CardHeader>
        <CardContent>
          {!corpusData?.items.length ? (
            <p className="text-sm text-muted-foreground">No corpus items yet.</p>
          ) : (
            <div className="space-y-2">
              {corpusData.items.map((item) => (
                <div
                  key={item.source_id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  {sourceTypeIcon(item.source_type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {item.title || item.source_id.slice(0, 12) + "..."}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.chunk_count} chunks | {item.language}
                      {item.original_language !== item.language &&
                        ` (translated from ${item.original_language})`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(item.source_id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
