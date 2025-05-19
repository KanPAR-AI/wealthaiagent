import React, { useRef, useState, useEffect } from "react"; // Added useEffect
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input"; // Adjust path
import { Button } from "@/components/ui/button"; // Adjust path
import { ArrowUp, Paperclip, Square, X } from "lucide-react";

interface PromptInputWithActionsProps {
  onSubmit: (text: string, files: File[]) => void;
  isLoading?: boolean;
}

export function PromptInputWithActions({ onSubmit, isLoading = false }: PromptInputWithActionsProps) {
  const [input, setInput] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { // Changed React.useEffect to useEffect
    if (!isLoading) {
      setInput("");
      setFiles([]);
      if (uploadInputRef.current) {
        uploadInputRef.current.value = "";
      }
    }
  }, [isLoading]);

  const handleSubmitInternal = (): void => { // Renamed to avoid confusion with potential prop name
    if (input.trim() || files.length > 0) {
      onSubmit(input.trim(), files);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey && !isLoading) {
      event.preventDefault();
      handleSubmitInternal(); // Call renamed internal handler
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

  return (
    <PromptInput
      value={input}
      onValueChange={setInput}
      // onSubmit={handleSubmitInternal} // <-- REMOVE OR COMMENT OUT THIS LINE
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
      <PromptInputTextarea
        placeholder="Ask me anything..."
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        className="dark:text-white text-zinc-950"
      />
      <PromptInputActions className="flex items-center justify-between gap-2 pt-2">
        <PromptInputAction tooltip="Attach files">
          <label
            htmlFor="file-upload"
            className={`hover:bg-secondary-foreground/10 flex h-8 w-8 items-center justify-center rounded-2xl ${isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
          >
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
              ref={uploadInputRef}
              disabled={isLoading}
            />
            <Paperclip className="text-primary size-5" />
          </label>
        </PromptInputAction>
        <PromptInputAction
          tooltip={isLoading ? "Stop generation" : "Send message"}
        >
          <Button
            type="button"
            variant="default"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={handleSubmitInternal} // Call renamed internal handler
            disabled={isLoading && (!input.trim() && files.length === 0)} // Corrected disable logic slightly
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