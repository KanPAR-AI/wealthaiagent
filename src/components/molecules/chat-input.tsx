import React, { useRef, useState } from "react";
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input"; // Adjust path
import { Button } from "@/components/ui/button"; // Adjust path
import { ArrowUp, Paperclip, Square, X } from "lucide-react";

interface PromptInputWithActionsProps {
  // Updated onSubmit to include files
  onSubmit: (text: string, files: File[]) => void;
  isLoading?: boolean; // Receive isLoading state from parent
}

export function PromptInputWithActions({ onSubmit, isLoading = false }: PromptInputWithActionsProps) {
  const [input, setInput] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Clear state when isLoading becomes false (means submission finished)
  React.useEffect(() => {
    if (!isLoading) {
      setInput("");
      setFiles([]);
       if (uploadInputRef.current) {
         uploadInputRef.current.value = ""; // Attempt to reset file input visually
       }
    }
  }, [isLoading]);

  const handleSubmit = (): void => {
    // Submit if there is text OR files
    if (input.trim() || files.length > 0) {
      // Call the parent's onSubmit callback with text and files
      onSubmit(input.trim(), files);
      // Parent component now controls clearing and loading state
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey && !isLoading) {
      event.preventDefault(); // Prevent default newline insertion
      handleSubmit();
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
    // Resetting file input value is important if user wants to re-add the *same* file
    if (uploadInputRef?.current) {
      uploadInputRef.current.value = "";
    }
  };

  return (
    <PromptInput
      value={input}
      onValueChange={setInput}
      onSubmit={handleSubmit} // PromptInput might use this, but we primarily use the button's onClick
      className="w-full" // Removed max-w-3xl here, let parent control max-width
    >
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-2 px-3"> {/* Added padding */}
          {files.map((file, index) => (
            <div
              key={index}
              className="bg-secondary flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
            >
              <Paperclip className="size-4 flex-shrink-0" />
              <span className="max-w-[120px] truncate" title={file.name}>{file.name}</span>
              <button
                type="button" // Important for forms
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
      {/* Added onKeyDown handler */}
      <PromptInputTextarea
         placeholder="Ask me anything..."
         onKeyDown={handleKeyDown}
         disabled={isLoading}
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
            type="button" // Change from submit if PromptInput wraps a form
            variant="default"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={handleSubmit}
            disabled={isLoading && !input.trim() && files.length === 0} // Disable if loading or no content
          >
            {isLoading ? (
              <Square className="size-5 fill-current animate-pulse" /> // Added pulse animation
            ) : (
              <ArrowUp className="size-5" />
            )}
          </Button>
        </PromptInputAction>
      </PromptInputActions>
    </PromptInput>
  );
}