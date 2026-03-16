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
  deleteCorpusItem,
  reloadCorpusVectors,
  runCorpusTest,
} from "@/services/admin-service";
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

export function CorpusPanel({ agentId }: { agentId: string }) {
  const { corpusData, corpusStats, setCorpusData, setCorpusStats, loading, setLoading } =
    useAdminStore();

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeTranscript, setYoutubeTranscript] = useState("");
  const [addMode, setAddMode] = useState<AddSourceMode>(null);
  const [activeJob, setActiveJob] = useState<CorpusJob | null>(null);
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [testResult, setTestResult] = useState<RetrievalTestResult | null>(null);
  const [testQuery, setTestQuery] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  useEffect(() => {
    loadData();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadData]);

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
          result = await addCorpusAudio(agentId, file);
          break;
        case "video_file":
          result = await addCorpusVideoFile(agentId, file);
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

  const sourceTypeIcon = (type: string) => {
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
  };

  const acceptForMode = (mode: AddSourceMode): string => {
    switch (mode) {
      case "pdf":
        return ".pdf";
      case "audio":
        return ".mp3,.wav,.m4a";
      case "video_file":
        return ".mp4,.mov";
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
        return "Video (mp4, mov)";
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
