// components/chat/chat-input.tsx

import { Button } from "@/components/ui/button";
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input";
import { getApiUrl } from "@/config/environment";
import { useJwtToken } from "@/hooks/use-jwt-token";
import { useCachedFile } from "@/hooks/use-cached-file";
import { MessageFile } from "@/types"; // Import MessageFile
import { ArrowUp, Mic, MicOff, Paperclip, Square, X, Loader2, FileText } from "lucide-react";
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";

// Props for the PromptInputWithActions component
interface PromptInputWithActionsProps {
  onSubmit: (text: string, attachments: MessageFile[], useMockService?: boolean) => void; // Added useMockService flag
  isLoading?: boolean;
  isInEmptyState?: boolean; // New prop to control border radius styling
}

// Ref methods exposed by the component
export interface PromptInputRef {
  setInputWithMockFlag: (text: string, useMockService: boolean) => void;
}

// Component to show file preview with loading state
function FilePreviewItem({ file, onRemove, isUploading }: { file: MessageFile; onRemove: () => void; isUploading: boolean }) {
  const { token } = useJwtToken();
  const { blobUrl, isLoading, error } = useCachedFile(file, token);

  const isImage = file.type?.startsWith('image/');
  const isPDF = file.type === 'application/pdf';

  return (
    <div className="bg-secondary flex items-center gap-2 rounded-lg p-2 text-sm max-w-[200px]">
      {isLoading ? (
        <div className="flex items-center gap-2 flex-1">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground text-xs">Loading...</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 flex-1">
          <FileText className="size-4 text-destructive" />
          <span className="text-destructive text-xs truncate" title={file.name}>
            {file.name}
          </span>
        </div>
      ) : isImage && blobUrl ? (
        <div className="flex items-center gap-2 flex-1">
          <img 
            src={blobUrl} 
            alt={file.name}
            className="size-8 object-cover rounded"
          />
          <span className="text-xs truncate" title={file.name}>
            {file.name}
          </span>
        </div>
      ) : isPDF && blobUrl ? (
        <div className="flex items-center gap-2 flex-1">
          <FileText className="size-4 text-red-500" />
          <span className="text-xs truncate" title={file.name}>
            {file.name}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1">
          <FileText className="size-4 text-muted-foreground" />
          <span className="text-xs truncate" title={file.name}>
            {file.name}
          </span>
        </div>
      )}
      
      <button
        type="button"
        onClick={onRemove}
        className="hover:bg-secondary-foreground/10 rounded-full p-1 flex-shrink-0 disabled:opacity-50"
        disabled={isUploading}
        aria-label={`Remove ${file.name}`}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

export const PromptInputWithActions = forwardRef<PromptInputRef, PromptInputWithActionsProps>(
  function PromptInputWithActions({
    onSubmit,
    isLoading = false,
    isInEmptyState = false,
  }, ref) {
    const [input, setInput] = useState<string>("");
    const [uploadedFiles, setUploadedFiles] = useState<MessageFile[]>([]); // Use MessageFile[]
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
    const [useMockService, setUseMockService] = useState<boolean>(false); // Track mock service flag

    const uploadInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const { token } = useJwtToken();

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      setInputWithMockFlag: (text: string, useMock: boolean) => {
        console.log('[ChatInput] Setting input with mock flag:', { text, useMock });
        setInput(text);
        setUseMockService(useMock);
      },
    }));

  // Effect to clear input and uploaded files when not busy
  useEffect(() => {
    // only wipe the inputs once the AI is done loading
    if (!isLoading) {
      setInput("");
      setUploadedFiles([]);
      setUseMockService(false); // Clear mock service flag
      if (uploadInputRef.current) {
        uploadInputRef.current.value = "";
      }
    }
  }, [isLoading]);
  

  // Handles submitting the message (text and/or files)
  const handleSubmitInternal = (): void => {
    // Ensure there's either text or at least one file before submitting
    if (input.trim() || uploadedFiles.length > 0) {
      onSubmit(input.trim(), uploadedFiles, useMockService); // Pass mock service flag
    }
  };

  // Handles keyboard events, specifically Enter for submission
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === "Enter" && !event.shiftKey && !isLoading) {
      event.preventDefault(); // Prevent new line on Enter
      handleSubmitInternal();
    }
  };

  // --- Voice Recording Functions ---
  const startRecording = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        transcribeAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop()); // Stop microphone track
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      // Use a custom modal or toast for user feedback instead of alert()
      // For now, using alert for quick demonstration as per instructions, but avoid in production.
      alert("Microphone access was denied. Please enable it in your browser settings.");
    }
  };

  const stopRecording = (): void => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleVoiceToggle = (): void => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const transcribeAudio = async (audioBlob: Blob): Promise<void> => {
    if (!token) {
      alert("Authentication error. Cannot transcribe audio.");
      return;
    }
    setIsTranscribing(true);

    const formData = new FormData();
    formData.append('file', audioBlob, 'voice-input.webm'); // Append the audio blob

    try {
      const response = await fetch(getApiUrl('/audio/transcribe'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Transcription failed with status: ${response.status}`);
      }

      const result = await response.json();
      const transcribedText = result.transcription;

      if (transcribedText) {
        setInput((prev) => prev + (prev ? " " : "") + transcribedText); // Append transcribed text
      }

    } catch (error) {
      console.error('Transcription error:', error);
      alert('Error transcribing audio. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  // --- File Upload Handling ---
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    if (!event.target.files?.length || !token) {
      if (!token) alert("Authentication error. Cannot upload files.");
      return;
    }

    const filesToUpload = Array.from(event.target.files);
    setIsUploading(true); // Set uploading state

    try {
      const uploadPromises = filesToUpload.map(async (file) => {
        const formData = new FormData();
        formData.append('files', file, file.name); // 'files' should match your backend's expected field name

        const response = await fetch(getApiUrl('/files/upload'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed for ${file.name} with status: ${response.status}`);
        }

        const result = await response.json();

        // Ensure the backend response structure is as expected
        if (!result.files || !Array.isArray(result.files) || result.files.length === 0) {
          throw new Error(`Invalid response format for ${file.name}: missing 'files' array or empty.`);
        }

        const uploadedFileResponse = result.files[0]; // Assuming single file upload per promise for simplicity
        if (!uploadedFileResponse || !uploadedFileResponse.url) {
          throw new Error(`Missing URL in response for ${file.name}`);
        }

        // Construct a complete MessageFile object using data from both original File and backend response
        return {
          name: uploadedFileResponse.fileName || file.name, // Use backend filename if available, else original
          url: getApiUrl(uploadedFileResponse.url), // Ensure full URL
          type: file.type, // Use original file's MIME type
          size: file.size, // Use original file's size
        } as MessageFile; // Assert type
      });

      const results = await Promise.all(uploadPromises);
      setUploadedFiles((prev) => [...prev, ...results]); // Add new uploaded files to state

    } catch (error) {
      console.error('File upload error:', error);
      alert(`File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false); // Reset uploading state
      if (uploadInputRef.current) {
        uploadInputRef.current.value = ""; // Clear the file input to allow re-uploading same file
      }
    }
  };

  // Handles removing an uploaded file from the display list
  const handleRemoveFile = (index: number): void => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // More granular loading states for better UX
  const canType = !isLoading && !isTranscribing;
  const canRecord = !isLoading && !isUploading && !isTranscribing;
  const canAttachFiles = !isLoading && !isUploading && !isTranscribing && !isRecording;
  const canSend = !isLoading && (!isUploading || input.trim()) && !isTranscribing && !isRecording;
  
  // Legacy isBusy for backward compatibility (used in some places)
  const isBusy = isLoading || isUploading || isTranscribing || isRecording;

  return (
    <div className="w-full max-w-full overflow-hidden">
      <PromptInput
        value={input}
        onValueChange={setInput}
        className="w-full relative max-w-full"
        isInEmptyState={isInEmptyState}
      >
      {/* Display uploaded files with previews */}
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-2 px-3">
          {uploadedFiles.map((file, index) => (
            <FilePreviewItem
              key={index}
              file={file}
              onRemove={() => handleRemoveFile(index)}
              isUploading={isUploading}
            />
          ))}
        </div>
      )}

      {/* Display recording/transcribing status */}
      {(isRecording || isTranscribing) && (
        <div className="flex items-center gap-2 px-3 pb-2 text-sm">
          {isRecording ? (
            <div className="flex items-center gap-2 text-red-500">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span>Recording...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-blue-500">
              <div className="size-4 border-2 border-background border-t-blue-500 rounded-full animate-spin" />
              <span>Transcribing...</span>
            </div>
          )}
        </div>
      )}

      {/* Main text input area */}
      <PromptInputTextarea
        placeholder="Ask me anything..."
        onKeyDown={handleKeyDown}
        disabled={!canType}
        className="dark:text-white text-zinc-950"
      />

      {/* Action buttons (attach, mic, send) */}
      <PromptInputActions className="flex items-center justify-between gap-2 pt-2">
        <div className="flex items-center gap-1">
          {/* Attach files button */}
          <PromptInputAction tooltip={
            !canAttachFiles 
              ? isUploading 
                ? "Please wait for current upload to finish" 
                : isRecording 
                  ? "Please stop recording first"
                  : "File attachment temporarily disabled"
              : "Attach files"
          }>
            <label
              htmlFor="file-upload"
              className={`hover:bg-secondary-foreground/10 flex h-8 w-8 items-center justify-center rounded-full ${!canAttachFiles ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            >
              <input
                type="file"
                multiple // Allow multiple file selection
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                ref={uploadInputRef}
                disabled={!canAttachFiles}
              />
              <Paperclip className="text-primary size-5" />
            </label>
          </PromptInputAction>

          {/* Microphone button */}
          <PromptInputAction tooltip={
            !canRecord
              ? isUploading
                ? "Please wait for file upload to finish"
                : "Microphone temporarily disabled"
              : isRecording 
                ? "Stop recording" 
                : "Use microphone"
          }>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`h-8 w-8 rounded-full ${isRecording ? 'text-red-500 bg-red-500/10' : 'text-primary'}`}
              onClick={handleVoiceToggle}
              disabled={!canRecord}
            >
              {isRecording ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </Button>
          </PromptInputAction>
        </div>

        {/* Send/Stop button */}
        <PromptInputAction tooltip={
          !canSend
            ? isUploading && !input.trim()
              ? "Please wait for file upload to finish or add some text"
              : "Send message"
            : isLoading 
              ? "Stop generation" 
              : "Send message"
        }>
          <Button
            type="button"
            variant="default"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={handleSubmitInternal}
            // Disable if can't send OR if there's no text and no uploaded files
            disabled={!canSend || (!input.trim() && uploadedFiles.length === 0)}
          >
            {isUploading || isTranscribing ? (
              // Show spinning loader for upload/transcribe
              <div className="size-5 animate-spin rounded-full border-2 border-background border-t-primary" />
            ) : isLoading ? (
              // Show square for stopping generation
              <Square className="size-5 fill-current" />
            ) : (
              // Show arrow for sending
              <ArrowUp className="size-5" />
            )}
          </Button>
        </PromptInputAction>
      </PromptInputActions>
      </PromptInput>
    </div>
  );
});
