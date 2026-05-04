import { useCallback, useEffect, useRef, useState } from "react";
import {
  Database,
  Youtube,
  FileText,
  Trash2,
  RefreshCw,
  Plus,
  Music,
  Video,
  Type,
  Image,
  Upload,
  Search,
  ChevronDown,
  X,
  Pencil,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAdminStore } from "@/store/admin";
import {
  fetchCorpus,
  fetchCorpusStats,
  addCorpusYouTube,
  addCorpusPdf,
  addCorpusAudio,
  addCorpusVideoFile,
  addCorpusDocument,
  addCorpusText,
  addCorpusBatch,
  pollCorpusJob,
  listCorpusJobs,
  deleteCorpusItem,
  reloadCorpusVectors,
  runCorpusTest,
  updateCorpusChunk,
  deleteCorpusChunkById,
} from "@/services/admin-service";
import { TranscriptReviewPanel } from "./transcript-review-panel";
import type { CorpusJob, RetrievalTestResult } from "@/services/admin-service";
import { toast } from "sonner";

type AddSourceMode =
  | null
  | "youtube"
  | "youtube_transcript"
  | "pdf"
  | "audio"
  | "video_file"
  | "document"
  | "text"
  | "batch";

// Module-scope helper so both CorpusPanel and SourceRow can use it.
function sourceTypeIconGlobal(type: string) {
  switch (type) {
    case "youtube":
      return <Youtube size={14} className="text-red-500" />;
    case "document":
      return <FileText size={14} className="text-blue-500" />;
    case "pdf":
      return <FileText size={14} className="text-orange-500" />;
    case "audio":
      return <Music size={14} className="text-purple-500" />;
    case "video_file":
      return <Video size={14} className="text-green-500" />;
    case "text":
      return <Type size={14} className="text-gray-500" />;
    case "image":
      return <Image size={14} className="text-blue-500" />;
    default:
      return <Database size={14} />;
  }
}

export function CorpusPanel({ agentId }: { agentId: string }) {
  const { corpusData, corpusStats, setCorpusData, setCorpusStats, loading, setLoading } =
    useAdminStore();

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeTranscript, setYoutubeTranscript] = useState("");
  const [addMode, setAddMode] = useState<AddSourceMode>(null);
  const [activeJob, setActiveJob] = useState<CorpusJob | null>(null);
  const [recentJobs, setRecentJobs] = useState<CorpusJob[]>([]);
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [dragOver, setDragOver] = useState(false);
  // Phase 1D video ingestion: when uploading a video, admin decides
  // whether to persist the original file to GCS. Storing = clickable
  // source citations in the sandbox (via #t=<seconds>). Not storing =
  // transcript-only, smaller footprint, ephemeral preview.
  const [storeVideoSource, setStoreVideoSource] = useState(true);
  // Language of the uploaded audio/video. "auto" → let Gemini detect;
  // an ISO-639 code routes both Gemini (prompt hint) and AssemblyAI
  // (language_code) away from the default English assumption.
  const [uploadLanguage, setUploadLanguage] = useState<string>("auto");
  const [testResult, setTestResult] = useState<RetrievalTestResult | null>(null);
  const [testQuery, setTestQuery] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recentJobsPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const batchInputRef = useRef<HTMLInputElement | null>(null);

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

  const loadRecentJobs = useCallback(async () => {
    try {
      const { jobs } = await listCorpusJobs(agentId);
      setRecentJobs(jobs);
      // On first load (or after reload), resume any in-flight job.
      // Users who close the tab mid-transcription come back and see
      // progress pick up where it left off.
      if (!activeJob) {
        const inFlight = jobs.find(
          (j) =>
            j.status === "pending" ||
            j.status === "running" ||
            j.status === "finalizing" ||
            j.status === "awaiting_review",
        );
        if (inFlight) {
          setActiveJob(inFlight);
          if (inFlight.status !== "awaiting_review") {
            // resume polling for still-processing jobs
            startPolling(inFlight.job_id, inFlight.source_type, inFlight.source_ref);
          }
        }
      }
    } catch {
      // List endpoint may transiently fail during startup — ignore.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  useEffect(() => {
    loadData();
    loadRecentJobs();
    // Poll recent jobs every 5s so the list reflects progress even
    // across reloads and for jobs started in other tabs.
    recentJobsPollRef.current = setInterval(loadRecentJobs, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (recentJobsPollRef.current) clearInterval(recentJobsPollRef.current);
    };
  }, [loadData, loadRecentJobs]);

  const startPolling = (jobId: string, sourceType: string, sourceRef: string) => {
    setActiveJob({
      job_id: jobId,
      source_type: sourceType,
      source_ref: sourceRef,
      status: "pending",
      chunks_created: 0,
      error: null,
      created_at: new Date().toISOString(),
    });

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const job = await pollCorpusJob(agentId, jobId);
        setActiveJob(job);
        // Terminal states stop polling.
        // - "complete" / "failed" / "cancelled" → done
        // - "awaiting_review" → also stop polling; the review panel
        //   takes over from here and will call /finalize which
        //   re-starts polling through its own mechanism (or we'll
        //   just refresh the corpus list after finalize returns).
        const isTerminal =
          job.status === "complete" ||
          job.status === "failed" ||
          job.status === "cancelled" ||
          job.status === "awaiting_review";
        if (isTerminal) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          if (job.status === "complete") {
            toast.success(`Added ${job.chunks_created} chunks`);
            loadData();
          } else if (job.status === "failed") {
            toast.error(`Job failed: ${job.error}`);
          } else if (job.status === "awaiting_review") {
            toast.info("Transcript ready for review", {
              description: "Curate segments below before committing to corpus.",
            });
          }
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 5000);
  };

  const handleAddYouTube = async () => {
    if (!youtubeUrl.trim()) return;
    try {
      const transcript = addMode === "youtube_transcript" ? youtubeTranscript.trim() || undefined : undefined;
      const result = await addCorpusYouTube(agentId, youtubeUrl.trim(), transcript);
      startPolling(result.job_id, "youtube", youtubeUrl);
      setYoutubeUrl("");
      setYoutubeTranscript("");
      setAddMode(null);
      toast.success("YouTube video job started");
    } catch (err) {
      toast.error(`Failed to add video: ${(err as Error).message}`);
    }
  };

  const handleFileUpload = async (file: File, mode: AddSourceMode) => {
    try {
      let result: { job_id: string; poll_url?: string };
      const ref = file.name;
      switch (mode) {
        case "pdf":
          result = await addCorpusPdf(agentId, file);
          break;
        case "audio":
          result = await addCorpusAudio(agentId, file, {
            language: uploadLanguage === "auto" ? undefined : uploadLanguage,
          });
          break;
        case "video_file":
          result = await addCorpusVideoFile(agentId, file, storeVideoSource, {
            language: uploadLanguage === "auto" ? undefined : uploadLanguage,
          });
          break;
        case "document":
          result = await addCorpusDocument(agentId, file);
          break;
        default:
          return;
      }
      startPolling(result.job_id, mode, ref);
      setAddMode(null);
      toast.success(`Upload started: ${file.name}`);
    } catch (err) {
      toast.error(`Upload failed: ${(err as Error).message}`);
    }
  };

  const handleTextSubmit = async () => {
    if (!textContent.trim() || !textTitle.trim()) return;
    try {
      const result = await addCorpusText(agentId, textContent.trim(), textTitle.trim());
      startPolling(result.job_id, "text", textTitle);
      setTextTitle("");
      setTextContent("");
      setAddMode(null);
      toast.success("Text corpus job started");
    } catch (err) {
      toast.error(`Failed to add text: ${(err as Error).message}`);
    }
  };

  const handleBatchUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    try {
      const result = await addCorpusBatch(agentId, fileArray);
      toast.success(`Started ${result.jobs.length} upload jobs`);
      // Poll the first job for progress indication
      if (result.jobs.length > 0) {
        startPolling(result.jobs[0].job_id, "batch", `${result.jobs.length} files`);
      }
      setAddMode(null);
    } catch (err) {
      toast.error(`Batch upload failed: ${(err as Error).message}`);
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

  const handleRunTest = async () => {
    setLoading("corpusTest", true);
    setTestResult(null);
    try {
      const result = await runCorpusTest(agentId, testQuery.trim());
      setTestResult(result);
    } catch (err) {
      toast.error(`Test failed: ${(err as Error).message}`);
    } finally {
      setLoading("corpusTest", false);
    }
  };

  const sourceTypeIcon = sourceTypeIconGlobal;

  const acceptForMode = (mode: AddSourceMode): string => {
    switch (mode) {
      case "pdf":
        return ".pdf";
      case "audio":
        return ".mp3,.wav,.m4a,.ogg,.flac";
      case "video_file":
        // Accept anything ffmpeg can read — users may have arbitrary
        // video containers, and ffmpeg is configured with wide codec
        // support in the Docker image.
        return ".mp4,.mov,.webm,.mkv,.avi,.m4v,video/*";
      case "document":
        return ".jpg,.jpeg,.png,.gif";
      default:
        return "";
    }
  };

  const labelForMode = (mode: AddSourceMode): string => {
    switch (mode) {
      case "pdf":
        return "PDF";
      case "audio":
        return "Audio (mp3, wav, m4a)";
      case "video_file":
        return "Video (mp4, mov, webm, mkv, avi)";
      case "document":
        return "Document/Image";
      default:
        return "";
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

  const isFileMode = addMode === "pdf" || addMode === "audio" || addMode === "video_file" || addMode === "document";

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

      {/* Active job progress — running/finalizing phases */}
      {activeJob &&
        (activeJob.status === "pending" ||
          activeJob.status === "running" ||
          activeJob.status === "finalizing") && (
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <RefreshCw size={14} className="animate-spin" />
                <span className="text-sm font-medium truncate">
                  {activeJob.status === "finalizing" ? "Committing" : "Processing"}:{" "}
                  {activeJob.source_ref}
                </span>
                <span className="text-xs text-muted-foreground ml-auto font-mono">
                  {activeJob.progress_pct ?? 0}%
                </span>
              </div>
              {/* Progress bar */}
              <div className="mt-2 h-1.5 w-full rounded-full bg-blue-100 dark:bg-blue-900/30 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(2, activeJob.progress_pct ?? 0)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {activeJob.progress_stage || "Starting…"}
              </p>
            </CardContent>
          </Card>
        )}

      {/* Recent jobs — survives reload, shows everything in flight + recent history */}
      {recentJobs.length > 0 && (
        <RecentJobsList
          jobs={recentJobs}
          activeJobId={activeJob?.job_id}
          onSelect={(j) => {
            setActiveJob(j);
            if (
              j.status === "pending" ||
              j.status === "running" ||
              j.status === "finalizing"
            ) {
              startPolling(j.job_id, j.source_type, j.source_ref);
            }
          }}
        />
      )}

      {/* Staged transcript review — shows when job is awaiting_review.
          Admin curates segments here before they're committed to the corpus. */}
      {activeJob && activeJob.status === "awaiting_review" && (
        <TranscriptReviewPanel
          agentId={agentId}
          jobId={activeJob.job_id}
          onFinalized={() => {
            setActiveJob(null);
            loadData();
            toast.success("Corpus updated");
          }}
          onCancelled={() => {
            setActiveJob(null);
          }}
        />
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              <Plus size={14} className="mr-1" /> Add Source
              <ChevronDown size={12} className="ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setAddMode("youtube")}>
              <Youtube size={14} className="mr-2 text-red-500" /> YouTube URL
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAddMode("youtube_transcript")}>
              <Youtube size={14} className="mr-2 text-red-500" /> YouTube URL + Transcript
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAddMode("pdf")}>
              <FileText size={14} className="mr-2 text-orange-500" /> Upload PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAddMode("audio")}>
              <Music size={14} className="mr-2 text-purple-500" /> Upload Audio
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAddMode("video_file")}>
              <Video size={14} className="mr-2 text-green-500" /> Upload Video File
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAddMode("document")}>
              <Image size={14} className="mr-2 text-blue-500" /> Upload Document/Image
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAddMode("text")}>
              <Type size={14} className="mr-2 text-gray-500" /> Paste Text
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAddMode("batch")}>
              <Upload size={14} className="mr-2" /> Batch Upload
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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

      {/* YouTube form */}
      {addMode === "youtube" && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Youtube size={16} className="text-red-500" />
              <span className="text-sm font-medium">Add YouTube URL</span>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setAddMode(null)}>
                <X size={14} />
              </Button>
            </div>
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* YouTube + Transcript form */}
      {addMode === "youtube_transcript" && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Youtube size={16} className="text-red-500" />
              <span className="text-sm font-medium">Add YouTube URL + Transcript</span>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setAddMode(null)}>
                <X size={14} />
              </Button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                className="w-full px-3 py-1.5 text-sm border rounded-md bg-background"
                placeholder="https://youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
              />
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Paste the transcript from YouTube (copy from video description or captions)
                </label>
                <textarea
                  className="w-full px-3 py-2 text-sm border rounded-md bg-background min-h-[200px] resize-y font-mono"
                  placeholder="Paste the full video transcript here..."
                  value={youtubeTranscript}
                  onChange={(e) => setYoutubeTranscript(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Uses your pasted transcript instead of auto-fetching from YouTube. Helpful when auto-captions are unavailable or low quality.
                </p>
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleAddYouTube}
                  disabled={!youtubeUrl.trim() || !youtubeTranscript.trim()}
                >
                  Add
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* File upload form (PDF, Audio, Video, Document) */}
      {isFileMode && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              {sourceTypeIcon(addMode!)}
              <span className="text-sm font-medium">Upload {labelForMode(addMode)}</span>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setAddMode(null)}>
                <X size={14} />
              </Button>
            </div>

            {/* Audio/Video: language selector — routes AssemblyAI language_code
                and gives Gemini a native-language prompt hint. Critical for
                non-English audio; without it AssemblyAI produces phonetic
                English gibberish when the speaker is Hindi/Bengali/Tamil/etc. */}
            {(addMode === "audio" || addMode === "video_file") && (
              <div className="mb-3 flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 p-3">
                <label htmlFor="upload-language" className="text-xs font-medium text-foreground">
                  Audio language
                </label>
                <select
                  id="upload-language"
                  value={uploadLanguage}
                  onChange={(e) => setUploadLanguage(e.target.value)}
                  className="text-xs rounded border border-border bg-background px-2 py-1"
                >
                  <option value="auto">Auto-detect</option>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="bn">Bengali</option>
                  <option value="ta">Tamil</option>
                  <option value="te">Telugu</option>
                  <option value="mr">Marathi</option>
                  <option value="gu">Gujarati</option>
                  <option value="kn">Kannada</option>
                  <option value="ml">Malayalam</option>
                  <option value="pa">Punjabi</option>
                  <option value="ur">Urdu</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="ja">Japanese</option>
                  <option value="zh">Chinese</option>
                </select>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  Default is English — set explicitly for non-English audio.
                </span>
              </div>
            )}

            {/* Video-specific options: store source in GCS for clickable citations */}
            {addMode === "video_file" && (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-border/50 bg-muted/30 p-3">
                <input
                  type="checkbox"
                  id="store-video-source"
                  checked={storeVideoSource}
                  onChange={(e) => setStoreVideoSource(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-muted-foreground/40"
                />
                <label htmlFor="store-video-source" className="text-xs text-muted-foreground cursor-pointer">
                  <span className="font-medium text-foreground">Store original video in GCS</span>
                  <br />
                  When enabled, the uploaded video is persisted so source citations
                  in the sandbox &quot;Show your work&quot; panel become clickable —
                  jumping to the exact moment via <code>#t=</code> fragments.
                  Transcript + timestamps are always stored either way.
                </label>
              </div>
            )}

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFileUpload(file, addMode);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drop file here or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Accepts: {acceptForMode(addMode)}
              </p>
              {addMode === "video_file" && (
                <p className="text-[10px] text-muted-foreground/60 mt-2">
                  Max 4 hours. Transcribed with OpenAI Whisper (segment-level
                  timestamps). Long videos auto-chunk into 20-min parts.
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={acceptForMode(addMode)}
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileUpload(e.target.files[0], addMode);
                  e.target.value = "";
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Text paste form */}
      {addMode === "text" && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Type size={16} className="text-gray-500" />
              <span className="text-sm font-medium">Paste Text</span>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setAddMode(null)}>
                <X size={14} />
              </Button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                className="w-full px-3 py-1.5 text-sm border rounded-md bg-background"
                placeholder="Title"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
              />
              <textarea
                className="w-full px-3 py-2 text-sm border rounded-md bg-background min-h-[120px] resize-y"
                placeholder="Paste your text content here..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleTextSubmit}
                  disabled={!textTitle.trim() || !textContent.trim()}
                >
                  Add Text
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Batch upload form */}
      {addMode === "batch" && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Upload size={16} />
              <span className="text-sm font-medium">Batch Upload</span>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setAddMode(null)}>
                <X size={14} />
              </Button>
            </div>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files.length > 0) {
                  handleBatchUpload(e.dataTransfer.files);
                }
              }}
              onClick={() => batchInputRef.current?.click()}
            >
              <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drop multiple files here or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Accepts: PDF, audio, video, images. Type auto-detected.
              </p>
              <input
                ref={batchInputRef}
                type="file"
                className="hidden"
                multiple
                accept=".pdf,.mp3,.wav,.m4a,.mp4,.mov,.jpg,.jpeg,.png,.gif"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleBatchUpload(e.target.files);
                  }
                  e.target.value = "";
                }}
              />
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
                <SourceRow
                  key={item.source_id}
                  item={item}
                  agentId={agentId}
                  onDelete={() => handleDelete(item.source_id)}
                  onChunksChanged={loadData}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Retrieval */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search size={16} />
            Test Retrieval
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-3 py-1.5 text-sm border rounded-md bg-background"
                placeholder="Enter a test query..."
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRunTest()}
              />
              <Button
                size="sm"
                onClick={handleRunTest}
                disabled={loading["corpusTest"]}
              >
                {loading["corpusTest"] ? (
                  <RefreshCw size={14} className="mr-1 animate-spin" />
                ) : (
                  <Search size={14} className="mr-1" />
                )}
                Test
              </Button>
            </div>

            {testResult && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {testResult.per_query_results.length} result{testResult.per_query_results.length !== 1 ? "s" : ""} retrieved
                </p>

                {testResult.per_query_results.length > 0 && testResult.per_query_results[0].text ? (
                  /* Custom query mode — show retrieved chunks */
                  <div className="space-y-2">
                    {testResult.per_query_results.map((r, i) => (
                      <div key={i} className="border rounded-lg p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">
                            #{i + 1} {r.title || r.source_id?.slice(0, 12)}
                          </span>
                          {r.score != null && (
                            <span className="text-xs text-muted-foreground">
                              score: {r.score.toFixed(4)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {r.text}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : testResult.per_query_results.length > 0 ? (
                  /* Golden query mode — show recall/MRR table */
                  <>
                    <div className="flex gap-4">
                      <div className="text-center">
                        <p className="text-lg font-bold">
                          {(testResult.recall_at_5 * 100).toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground">Recall@5</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">
                          {(testResult.mrr_at_5 * 100).toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground">MRR@5</p>
                      </div>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="text-left px-3 py-2 font-medium">Query</th>
                            <th className="text-right px-3 py-2 font-medium">Recall</th>
                            <th className="text-right px-3 py-2 font-medium">MRR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {testResult.per_query_results.map((r, i) => (
                            <tr key={i} className="border-t">
                              <td className="px-3 py-2 truncate max-w-[200px]">{r.query}</td>
                              <td className="px-3 py-2 text-right">
                                {(r.recall * 100).toFixed(0)}%
                              </td>
                              <td className="px-3 py-2 text-right">
                                {(r.mrr * 100).toFixed(0)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No results found. Try a different query.</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SourceRow — expandable source in the corpus list. Clicking "Chunks"
// fetches individual chunks for the source and renders them with inline
// edit/delete. Lets admins fix transcription errors at chunk granularity
// without re-ingesting the whole source.
// ---------------------------------------------------------------------------

import type { CorpusItem, CorpusChunk } from "@/services/admin-service";

function SourceRow({
  item,
  agentId,
  onDelete,
  onChunksChanged,
}: {
  item: CorpusItem;
  agentId: string;
  onDelete: () => void;
  onChunksChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [chunks, setChunks] = useState<CorpusChunk[] | null>(null);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const loadChunks = async () => {
    setLoadingChunks(true);
    try {
      const res = await fetchCorpus(agentId, {
        sourceId: item.source_id,
        includeChunks: true,
      });
      setChunks(res.chunks || []);
    } catch (err) {
      toast.error(`Failed to load chunks: ${(err as Error).message}`);
    } finally {
      setLoadingChunks(false);
    }
  };

  const toggleExpand = async () => {
    if (!expanded && !chunks) await loadChunks();
    setExpanded((e) => !e);
  };

  const handleEditSave = async (chunkId: number) => {
    try {
      await updateCorpusChunk(agentId, chunkId, editText.trim());
      toast.success("Chunk updated");
      setEditingId(null);
      await loadChunks();
      onChunksChanged();
    } catch (err) {
      toast.error(`Update failed: ${(err as Error).message}`);
    }
  };

  const handleChunkDelete = async (chunkId: number) => {
    if (!confirm("Delete this chunk? Cannot be undone.")) return;
    try {
      await deleteCorpusChunkById(agentId, chunkId);
      toast.success("Chunk deleted");
      await loadChunks();
      onChunksChanged();
    } catch (err) {
      toast.error(`Delete failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="rounded-lg border hover:bg-muted/30 transition-colors overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        {sourceTypeIconGlobal(item.source_type)}
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
        <Button size="sm" variant="ghost" onClick={toggleExpand}>
          {expanded ? "Hide chunks" : "View chunks"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
          title="Delete entire source"
        >
          <Trash2 size={14} />
        </Button>
      </div>

      {/* Expanded chunk list with inline edit/delete */}
      {expanded && (
        <div className="border-t border-border/50 bg-muted/10 px-3 py-2 space-y-1.5 max-h-96 overflow-y-auto">
          {loadingChunks ? (
            <p className="text-xs text-muted-foreground py-2">Loading chunks…</p>
          ) : !chunks || chunks.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No chunks.</p>
          ) : (
            chunks.map((c) => (
              <div
                key={c.chunk_id}
                className="rounded border border-border/40 bg-background p-2 text-xs space-y-1"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[9px] text-muted-foreground">
                    #{c.chunk_id}
                  </span>
                  {c.speaker && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted font-mono">
                      Speaker {c.speaker}
                    </span>
                  )}
                  {c.timestamp_seconds !== undefined && c.timestamp_seconds !== null && (
                    <span className="text-[9px] text-muted-foreground font-mono">
                      @ {Math.floor(c.timestamp_seconds / 60)}:
                      {String(Math.floor(c.timestamp_seconds % 60)).padStart(2, "0")}
                    </span>
                  )}
                  {c.asr_confidence !== undefined && c.asr_confidence !== null && (
                    <span className="text-[9px] text-muted-foreground font-mono">
                      conf {c.asr_confidence.toFixed(2)}
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    {editingId !== c.chunk_id && (
                      <>
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-muted"
                          title="Edit"
                          onClick={() => {
                            setEditingId(c.chunk_id);
                            setEditText(c.text);
                          }}
                        >
                          <Pencil size={10} />
                        </button>
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-muted text-destructive"
                          title="Delete"
                          onClick={() => handleChunkDelete(c.chunk_id)}
                        >
                          <Trash2 size={10} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {editingId === c.chunk_id ? (
                  <div className="space-y-1">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={Math.max(2, Math.ceil(editText.length / 80))}
                      className="w-full text-xs font-mono rounded border border-border/50 bg-background p-1.5"
                      autoFocus
                    />
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => handleEditSave(c.chunk_id)}
                        disabled={!editText.trim()}
                      >
                        Save + re-embed
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-foreground/80 leading-snug">{c.text}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Recent Jobs — persists across reload, polls every 5s.
// Shows status, progress bar for in-flight jobs, and lets admin
// jump back into any job (resume progress view or resume review).
// ---------------------------------------------------------------

function formatRelativeTime(iso?: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function jobStatusColor(status: CorpusJob["status"]): string {
  switch (status) {
    case "pending":
    case "running":
    case "finalizing":
      return "text-blue-600 dark:text-blue-400";
    case "awaiting_review":
      return "text-amber-600 dark:text-amber-400";
    case "complete":
      return "text-green-600 dark:text-green-400";
    case "failed":
      return "text-red-600 dark:text-red-400";
    case "cancelled":
      return "text-muted-foreground";
  }
}

function RecentJobsList({
  jobs,
  activeJobId,
  onSelect,
}: {
  jobs: CorpusJob[];
  activeJobId?: string;
  onSelect: (job: CorpusJob) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const inFlight = jobs.filter(
    (j) =>
      j.status === "pending" ||
      j.status === "running" ||
      j.status === "finalizing" ||
      j.status === "awaiting_review",
  );

  return (
    <Card>
      <CardHeader
        className="cursor-pointer py-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <CardTitle className="text-sm flex items-center justify-between">
          <span>
            Ingestion jobs
            {inFlight.length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-blue-600 dark:text-blue-400">
                <RefreshCw size={10} className="animate-spin" />
                {inFlight.length} active
              </span>
            )}
          </span>
          <ChevronDown
            size={14}
            className={`transition-transform ${expanded ? "" : "-rotate-90"}`}
          />
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="p-3 pt-0">
          <div className="space-y-1.5">
            {jobs.slice(0, 10).map((j) => {
              const isActive = j.job_id === activeJobId;
              const pct = j.progress_pct ?? 0;
              const isInFlight =
                j.status === "pending" ||
                j.status === "running" ||
                j.status === "finalizing";
              return (
                <button
                  key={j.job_id}
                  onClick={() => onSelect(j)}
                  className={`w-full text-left p-2 rounded-md border transition-colors ${
                    isActive
                      ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {sourceTypeIconGlobal(j.source_type)}
                    <span className="text-xs font-medium truncate flex-1">
                      {j.source_ref}
                    </span>
                    <span
                      className={`text-[10px] font-medium capitalize ${jobStatusColor(j.status)}`}
                    >
                      {j.status.replace("_", " ")}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {formatRelativeTime(j.updated_at || j.created_at)}
                    </span>
                  </div>
                  {isInFlight && (
                    <>
                      <div className="mt-1.5 h-1 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all duration-500 ease-out"
                          style={{ width: `${Math.max(2, pct)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 truncate">
                        {j.progress_stage || "Starting…"} · {pct}%
                      </p>
                    </>
                  )}
                  {j.status === "failed" && j.error && (
                    <p className="text-[10px] text-red-500 mt-1 truncate">
                      {j.error}
                    </p>
                  )}
                  {j.status === "complete" && j.chunks_created > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {j.chunks_created} chunks added
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
