import { Button } from "@/components/ui/button";
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input";
import { ArrowUp, Mic, MicOff, Paperclip, Square, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

interface PromptInputWithActionsProps {
  onSubmit: (text: string, files: File[]) => void;
  isLoading?: boolean;
}

export function PromptInputWithActions({ onSubmit, isLoading = false }: PromptInputWithActionsProps) {
  const [input, setInput] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!isLoading) {
      setInput("");
      setFiles([]);
      if (uploadInputRef.current) {
        uploadInputRef.current.value = "";
      }
    }
  }, [isLoading]);

  const handleSubmitInternal = (): void => {
    if (input.trim() || files.length > 0) {
      onSubmit(input.trim(), files);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey && !isLoading) {
      event.preventDefault();
      handleSubmitInternal();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (index: number): void => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (uploadInputRef?.current) {
      uploadInputRef.current.value = "";
    }
  };

  const startRecording = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Unable to access microphone. Please check your permissions.');
    }
  };

  const stopRecording = (): void => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob): Promise<void> => {
    setIsTranscribing(true);
    try {
      // This is a placeholder for actual speech-to-text integration
      // You would replace this with your preferred speech-to-text service
      // Examples: OpenAI Whisper API, Google Speech-to-Text, etc.
      
      // Simulating transcription for demo purposes
      await new Promise(resolve => setTimeout(resolve, 1500));
      const mockTranscription = "This is a mock transcription of your voice input.";
      
      setInput(prev => prev + (prev ? " " : "") + mockTranscription);
    } catch (error) {
      console.error('Transcription error:', error);
      alert('Error transcribing audio. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleVoiceToggle = (): void => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <PromptInput
      value={input}
      onValueChange={setInput}
      className="w-full relative"
    >
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-2 px-3">
          {files.map((file, index) => (
            <div
              key={index}
              className="bg-secondary flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
            >
              <Paperclip className="size-4 flex-shrink-0" />
              <span className="max-w-[120px] truncate" title={file.name}>{file.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveFile(index)}
                className="hover:bg-secondary/50 rounded-full p-1 disabled:opacity-50"
                disabled={isLoading}
                aria-label={`Remove ${file.name}`}
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Voice Recording Indicator */}
      {(isRecording || isTranscribing) && (
        <div className="flex items-center gap-2 px-3 pb-2">
          <div className={`flex items-center gap-2 text-sm ${isRecording ? 'text-red-500' : 'text-blue-500'}`}>
            {isRecording ? (
              <>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span>Recording...</span>
                </div>
                <div className="flex gap-1 justify-center items-center">
                  <div className="w-1 h-4 bg-red-400 rounded-full animate-caret-blink" style={{ animationDelay: '0ms' }} />
                  <div className="w-1 h-6 bg-red-500 rounded-full animate-caret-blink" style={{ animationDelay: '150ms' }} />
                  <div className="w-1 h-8 bg-red-600 rounded-full animate-caret-blink" style={{ animationDelay: '300ms' }} />
                  <div className="w-1 h-6 bg-red-400 rounded-full animate-caret-blink" style={{ animationDelay: '450ms' }} />
                  <div className="w-1 h-4 bg-red-400 rounded-full animate-caret-blink" style={{ animationDelay: '600ms' }} />
                </div>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-spin" />
                <span>Transcribing...</span>
              </>
            )}
          </div>
        </div>
      )}

      <PromptInputTextarea
        placeholder="Ask me anything..."
        onKeyDown={handleKeyDown}
        disabled={isLoading || isTranscribing}
        className="dark:text-white text-zinc-950"
      />
      <PromptInputActions className="flex items-center justify-between gap-2 pt-2">
        <div className="flex items-center gap-1">
          <PromptInputAction tooltip="Attach files">
            <label
              htmlFor="file-upload"
              className={`hover:bg-secondary-foreground/10 flex h-8 w-8 items-center justify-center ${isLoading || isRecording ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            >
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                ref={uploadInputRef}
                disabled={isLoading || isRecording}
              />
              <Paperclip className="text-primary size-5" />
            </label>
          </PromptInputAction>
          
          <PromptInputAction tooltip={isRecording ? "Stop recording" : "Start voice input"}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`h-8 w-8 rounded-full transition-all duration-200 ${
                isRecording 
                  ? 'bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400' 
                  : 'hover:bg-secondary-foreground/10'
              } ${isTranscribing ? 'animate-pulse' : ''}`}
              onClick={handleVoiceToggle}
              disabled={isLoading || isTranscribing}
            >
              {isRecording ? (
                <MicOff className="size-5" />
              ) : (
                <Mic className={`size-5 ${isTranscribing ? 'text-blue-500' : 'text-primary'}`} />
              )}
            </Button>
          </PromptInputAction>
        </div>
        
        <PromptInputAction
          tooltip={isLoading ? "Stop generation" : "Send message"}
        >
          <Button
            type="button"
            variant="default"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={handleSubmitInternal}
            disabled={isLoading && (!input.trim() && files.length === 0)}
          >
            {isLoading ? (
              <Square className="size-5 fill-current animate-pulse" />
            ) : (
              <ArrowUp className="size-5" />
            )}
          </Button>
        </PromptInputAction>
      </PromptInputActions>
    </PromptInput>
  );
}