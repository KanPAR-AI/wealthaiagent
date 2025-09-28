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
import { MessageFile } from "@/types"; // Import MessageFile
import { ArrowUp, Mic, MicOff, Paperclip, Square, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

// Props for the PromptInputWithActions component
interface PromptInputWithActionsProps {
  onSubmit: (text: string, attachments: MessageFile[]) => void; // Changed to MessageFile[]
  isLoading?: boolean;
}

export function PromptInputWithActions({
  onSubmit,
  isLoading = false,
}: PromptInputWithActionsProps) {
  const [input, setInput] = useState<string>("");
  const [uploadedFiles, setUploadedFiles] = useState<MessageFile[]>([]); // Use MessageFile[]
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const { token } = useJwtToken();

  // Effect to clear input and uploaded files when not busy
  useEffect(() => {
    // only wipe the inputs once the AI is done loading
    if (!isLoading) {
      setInput("");
      setUploadedFiles([]);
      if (uploadInputRef.current) {
        uploadInputRef.current.value = "";
      }
    }
  }, [isLoading]);
  

  // Handles submitting the message (text and/or files)
  const handleSubmitInternal = (): void => {
    // Ensure there's either text or at least one file before submitting
    if (input.trim() || uploadedFiles.length > 0) {
      onSubmit(input.trim(), uploadedFiles); // Pass uploadedFiles directly
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

  // Determine if the input area is busy (loading, uploading, recording, transcribing)
  const isBusy = isLoading || isUploading || isTranscribing || isRecording;

  return (
    <PromptInput
      value={input}
      onValueChange={setInput}
      className="w-full relative"
    >
      {/* Display uploaded files */}
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-2 px-3">
          {uploadedFiles.map((file, index) => (
            <div key={index} className="bg-secondary flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
              <Paperclip className="size-4 flex-shrink-0" />
              <span className="max-w-[120px] truncate" title={file.name}>{file.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveFile(index)}
                className="hover:bg-secondary/50 rounded-full p-1 disabled:opacity-50"
                disabled={isBusy}
                aria-label={`Remove ${file.name}`}
              >
                <X className="size-4" />
              </button>
            </div>
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
        disabled={isBusy}
        className="dark:text-white text-zinc-950"
      />

      {/* Action buttons (attach, mic, send) */}
      <PromptInputActions className="flex items-center justify-between gap-2 pt-2">
        <div className="flex items-center gap-1">
          {/* Attach files button */}
          <PromptInputAction tooltip="Attach files">
            <label
              htmlFor="file-upload"
              className={`hover:bg-secondary-foreground/10 flex h-8 w-8 items-center justify-center rounded-full ${isBusy ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            >
              <input
                type="file"
                multiple // Allow multiple file selection
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                ref={uploadInputRef}
                disabled={isBusy}
              />
              <Paperclip className="text-primary size-5" />
            </label>
          </PromptInputAction>

          {/* Microphone button */}
          <PromptInputAction tooltip={isRecording ? "Stop recording" : "Use microphone"}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`h-8 w-8 rounded-full ${isRecording ? 'text-red-500 bg-red-500/10' : 'text-primary'}`}
              onClick={handleVoiceToggle}
              disabled={isLoading || isUploading || isTranscribing}
            >
              {isRecording ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </Button>
          </PromptInputAction>
        </div>

        {/* Send/Stop button */}
        <PromptInputAction tooltip={isLoading ? "Stop generation" : "Send message"}>
          <Button
            type="button"
            variant="default"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={handleSubmitInternal}
            // Disable if busy OR if there's no text and no uploaded files
            disabled={isBusy || (!input.trim() && uploadedFiles.length === 0)}
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
  );
}
