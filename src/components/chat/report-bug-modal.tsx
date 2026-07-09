// src/components/chat/report-bug-modal.tsx
//
// "Report an issue" — the modal wired into the chat header. Captures
// a description, an optional screenshot, and the current chat_id so
// admins can reproduce what the user saw.
//
// Three ways to attach a screenshot (in order of expected use):
//   1. Paste from clipboard (Cmd/Ctrl-V while the modal is open).
//   2. Drag-and-drop onto the drop zone.
//   3. Click the drop zone → native file picker.
//
// We don't take the screenshot for the user with html2canvas or DOM
// serialization — those routinely miss OS-level overlays, iframes,
// device-pixel-ratio artifacts, and the UI state the user actually
// remembers. The user's own screenshot is higher-signal.

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useChatStore } from "@/store/chat";
import { submitBugReport } from "@/services/bug-report-service";

interface ReportBugModalProps {
  open: boolean;
  onClose: () => void;
}

const MAX_DESCRIPTION_CHARS = 5000;
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024; // 8 MB — matches file-service default

export function ReportBugModal({ open, onClose }: ReportBugModalProps) {
  const { chatid } = useParams<{ chatid: string }>();
  const selectedAgent = useChatStore((s) => s.selectedAgent);

  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset the form each time the modal opens.
  useEffect(() => {
    if (open) {
      setDescription("");
      setScreenshot(null);
      setScreenshotPreview(null);
    }
  }, [open]);

  // Cmd/Ctrl-V while the modal is open pastes an image into the slot.
  useEffect(() => {
    if (!open) return;
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            acceptScreenshot(file);
            return;
          }
        }
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
     
  }, [open]);

  const acceptScreenshot = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Screenshot must be an image");
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      toast.error(`Screenshot is too large (max ${MAX_SCREENSHOT_BYTES / 1024 / 1024} MB)`);
      return;
    }
    setScreenshot(file);
    const reader = new FileReader();
    reader.onload = () => setScreenshotPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) acceptScreenshot(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) acceptScreenshot(file);
  };

  const removeScreenshot = () => {
    setScreenshot(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    const trimmed = description.trim();
    if (trimmed.length < 3) {
      toast.error("Please describe the issue in at least a few words");
      return;
    }
    setSubmitting(true);
    try {
      const report = await submitBugReport({
        description: trimmed,
        chatId: chatid || null,
        screenshot,
        selectedAgent,
      });
      toast.success("Thanks — report sent", {
        description: `Reference: ${report.id.slice(0, 8)}…`,
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Couldn't send report", { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            Report an issue
          </DialogTitle>
          <DialogDescription>
            Tell us what went wrong. A screenshot helps a lot — you can paste
            (⌘V / Ctrl-V), drop, or pick a file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <Textarea
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION_CHARS))}
            placeholder="What happened? What did you expect?"
            rows={5}
            disabled={submitting}
            className="resize-none"
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>
              {chatid ? (
                <>Attaching context from this chat</>
              ) : (
                <>No chat context (you're on the landing page)</>
              )}
            </span>
            <span>
              {description.length.toLocaleString()} / {MAX_DESCRIPTION_CHARS.toLocaleString()}
            </span>
          </div>

          {screenshotPreview ? (
            <div className="relative rounded-md border border-border overflow-hidden bg-muted/40">
              <img
                src={screenshotPreview}
                alt="Screenshot preview"
                className="max-h-56 w-full object-contain bg-checkerboard"
              />
              <button
                type="button"
                onClick={removeScreenshot}
                disabled={submitting}
                aria-label="Remove screenshot"
                className="absolute top-2 right-2 rounded-full bg-black/60 hover:bg-black/80 text-white p-1"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border py-6 px-4 text-sm text-muted-foreground cursor-pointer transition hover:bg-muted/40 ${
                submitting ? "pointer-events-none opacity-60" : ""
              }`}
            >
              <ImagePlus className="h-5 w-5" />
              <span>
                Drop or click to add a screenshot
                <span className="hidden sm:inline"> — or paste (⌘V)</span>
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileInput}
                disabled={submitting}
              />
            </label>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || description.trim().length < 3}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Sending…
              </>
            ) : (
              "Send report"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
