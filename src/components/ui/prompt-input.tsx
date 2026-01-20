import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

type PromptInputContextType = {
  isLoading: boolean
  value: string
  setValue: (value: string) => void
  maxHeight: number | string
  onSubmit?: () => void
  disabled?: boolean
}

const PromptInputContext = createContext<PromptInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 240,
  onSubmit: undefined,
  disabled: false,
})

function usePromptInput() {
  const context = useContext(PromptInputContext)
  if (!context) {
    throw new Error("usePromptInput must be used within a PromptInput")
  }
  return context
}

type PromptInputProps = {
  isLoading?: boolean
  value?: string
  onValueChange?: (value: string) => void
  maxHeight?: number | string
  onSubmit?: () => void
  children: React.ReactNode
  className?: string
  isInEmptyState?: boolean
}

function PromptInput({
  className,
  isLoading = false,
  maxHeight = 240,
  value,
  onValueChange,
  onSubmit,
  children,
  isInEmptyState = false,
}: PromptInputProps) {
  const [internalValue, setInternalValue] = useState(value || "")

  const handleChange = (newValue: string) => {
    setInternalValue(newValue)
    onValueChange?.(newValue)
  }

  return (
    <TooltipProvider>
      <PromptInputContext.Provider
        value={{
          isLoading,
          value: value ?? internalValue,
          setValue: onValueChange ?? handleChange,
          maxHeight,
          onSubmit,
        }}
      >
        <div
          className={cn(
            "border border-border/60 bg-card sm:rounded-2xl p-2 shadow-sm",
            // Conditional border radius based on empty state
            isInEmptyState ? "rounded-2xl" : "rounded-b-none rounded-t-2xl",
            // Safari-specific container fixes
            "overflow-hidden", // Prevent content from expanding beyond container
            "max-w-full", // Ensure container doesn't exceed viewport
            // Focus state enhancement
            "focus-within:border-primary/40 focus-within:shadow-md transition-all duration-200",
            className
          )}
        >
          {children}
        </div>
      </PromptInputContext.Provider>
    </TooltipProvider>
  )
}

export type PromptInputTextareaProps = {
  disableAutosize?: boolean
} & React.ComponentProps<typeof Textarea>

function PromptInputTextarea({
  className,
  onKeyDown,
  disableAutosize = false,
  ...props
}: PromptInputTextareaProps) {
  const { value, setValue, maxHeight, onSubmit, disabled } = usePromptInput()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (disableAutosize) return

    if (!textareaRef.current) return
    
    // Safari-specific fix: Reset height and use a more controlled approach
    const textarea = textareaRef.current
    textarea.style.height = "auto"
    
    // Calculate the desired height with proper constraints
    const scrollHeight = textarea.scrollHeight
    const maxHeightPx = typeof maxHeight === "number" ? maxHeight : 240
    
    // Ensure height doesn't exceed maxHeight and has a minimum
    const newHeight = Math.max(44, Math.min(scrollHeight, maxHeightPx))
    textarea.style.height = `${newHeight}px`
    
    // Safari-specific: Set overflow to auto when content exceeds maxHeight
    if (scrollHeight > maxHeightPx) {
      textarea.style.overflowY = "auto"
    } else {
      textarea.style.overflowY = "hidden"
    }
  }, [value, maxHeight, disableAutosize])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSubmit?.()
    }
    onKeyDown?.(e)
  }

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className={cn(
        "text-foreground min-h-[44px] w-full resize-none border-none bg-transparent shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60",
        // Safari-specific fixes
        "overflow-hidden", // Prevent Safari from expanding beyond container
        "box-border", // Ensure proper box model
        "max-h-[240px]", // Set maximum height constraint
        "text-base", // Ensure 16px font size to prevent iOS Safari auto-zoom
        className
      )}
      rows={1}
      disabled={disabled}
      style={{
        // Additional Safari-specific styles
        WebkitAppearance: "none",
        WebkitBorderRadius: "0",
        fontSize: "16px", // Explicit 16px to prevent iOS Safari auto-zoom
        WebkitTextSizeAdjust: "100%", // Prevent text size adjustment on iOS
        ...props.style
      }}
      {...props}
    />
  )
}

type PromptInputActionsProps = React.HTMLAttributes<HTMLDivElement>

function PromptInputActions({
  children,
  className,
  ...props
}: PromptInputActionsProps) {
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      {children}
    </div>
  )
}

type PromptInputActionProps = {
  className?: string
  tooltip: React.ReactNode
  children: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
} & React.ComponentProps<typeof Tooltip>

function PromptInputAction({
  tooltip,
  children,
  className,
  side = "top",
  ...props
}: PromptInputActionProps) {
  const { disabled } = usePromptInput()

  return (
    <Tooltip {...props}>
      <TooltipTrigger asChild disabled={disabled}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

export {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
}
