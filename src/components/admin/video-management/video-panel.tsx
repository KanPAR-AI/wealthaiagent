import { useEffect, useState, useRef, useCallback } from "react";
import { Plus, Trash2, ExternalLink, Film, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminStore } from "@/store/admin";
import {
  fetchVideos,
  addVideo,
  deleteVideo,
  pollVideoJob,
  type AddVideoRequest,
} from "@/services/admin-service";
import { toast } from "sonner";

export function VideoPanel({ agentId }: { agentId: string }) {
  const { videoData, setVideoData, activeJob, setActiveJob, loading, setLoading } =
    useAdminStore();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const loadVideos = useCallback(async () => {
    setLoading("videos", true);
    try {
      const data = await fetchVideos(agentId);
      setVideoData(data);
    } catch (err: unknown) {
      toast.error("Failed to load videos", { description: (err as Error).message });
    } finally {
      setLoading("videos", false);
    }
  }, [agentId, setVideoData, setLoading]);

  useEffect(() => {
    loadVideos();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadVideos]);

  // Poll active job
  useEffect(() => {
    if (!activeJob || activeJob.status === "completed" || activeJob.status === "failed") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    pollRef.current = setInterval(async () => {
      try {
        const job = await pollVideoJob(agentId, activeJob.job_id);
        setActiveJob(job);
        if (job.status === "completed") {
          toast.success("Video added successfully", {
            description: `${job.result?.new_chunks || 0} chunks added`,
          });
          loadVideos();
        } else if (job.status === "failed") {
          toast.error("Video add failed", { description: job.error || "Unknown error" });
        }
      } catch {
        // poll errors are transient
      }
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeJob, agentId, setActiveJob, loadVideos]);

  const handleAdd = async (req: AddVideoRequest) => {
    try {
      const resp = await addVideo(agentId, req);
      setActiveJob({
        job_id: resp.job_id,
        video_id: resp.video_id,
        status: "pending",
        current_step: "",
        step_number: 0,
        total_steps: 7,
        message: "Queued...",
        result: null,
        error: null,
      });
      setShowAddDialog(false);
      toast.info("Adding video...", { description: `Job started for ${resp.video_id}` });
    } catch (err: unknown) {
      toast.error("Failed to start video add", { description: (err as Error).message });
    }
  };

  const handleDelete = async (videoId: string) => {
    if (!confirm(`Delete video ${videoId} and all its chunks?`)) return;
    try {
      const res = await deleteVideo(agentId, videoId);
      toast.success(`Deleted ${res.chunks_removed} chunks`);
      loadVideos();
    } catch (err: unknown) {
      toast.error("Delete failed", { description: (err as Error).message });
    }
  };

  return (
    <div className="space-y-4">
      {/* Job progress banner */}
      {activeJob && (activeJob.status === "pending" || activeJob.status === "running") && (
        <Card className="border-blue-500/30 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                Adding video: {activeJob.video_id}
              </span>
              <span className="text-xs text-muted-foreground">
                Step {activeJob.step_number}/{activeJob.total_steps}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${(activeJob.step_number / activeJob.total_steps) * 100}%`,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{activeJob.message}</p>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Video Corpus</h3>
          {videoData && (
            <p className="text-sm text-muted-foreground">
              {videoData.total_videos} videos, {videoData.total_chunks} chunks
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus size={14} />
          Add Video
        </Button>
      </div>

      {/* Add dialog */}
      {showAddDialog && (
        <AddVideoDialog onClose={() => setShowAddDialog(false)} onSubmit={handleAdd} />
      )}

      {/* Video list */}
      {loading["videos"] ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : videoData?.videos.length ? (
        <div className="space-y-2">
          {videoData.videos.map((v) => (
            <Card key={v.video_id} className="p-0">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:underline truncate"
                    >
                      {v.title}
                    </a>
                    <ExternalLink size={12} className="text-muted-foreground flex-shrink-0" />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Film size={10} /> {v.exercise_chunks} exercise
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen size={10} /> {v.knowledge_chunks} knowledge
                    </span>
                    {v.exercises_found.length > 0 && (
                      <span className="text-green-600 dark:text-green-400">
                        {v.exercises_found.join(", ")}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={() => handleDelete(v.video_id)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">
          No videos in corpus yet.
        </p>
      )}
    </div>
  );
}

// --- Add Video Dialog (inline, no Radix Dialog needed) ---

function AddVideoDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (req: AddVideoRequest) => void;
}) {
  const [url, setUrl] = useState("");
  const [extract, setExtract] = useState(true);
  const [rebuild, setRebuild] = useState(true);
  const [redis, setRedis] = useState(false);

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Add YouTube Video</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          type="text"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          autoFocus
        />
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={extract} onChange={(e) => setExtract(e.target.checked)} />
            Extract exercises
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={rebuild} onChange={(e) => setRebuild(e.target.checked)} />
            Rebuild catalog
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={redis} onChange={(e) => setRedis(e.target.checked)} />
            Reload Redis
          </label>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!url.trim()}
            onClick={() =>
              onSubmit({
                youtube_url: url.trim(),
                extract_exercises: extract,
                rebuild_catalog: rebuild,
                reload_redis: redis,
              })
            }
          >
            Add Video
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
