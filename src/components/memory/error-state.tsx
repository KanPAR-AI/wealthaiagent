// components/memory/error-state.tsx — §45 error state.
//
// STATE_MODEL "Error state": a load failure must show an error surface +
// Retry — it must NEVER render as a confident blank ("0 memories"/"nothing
// here"). Callers must not fall through to EmptyState on a failed read.
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  message = "Something went wrong loading this data.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-12 text-center",
        className,
      )}
      role="alert"
      data-testid="error-state"
    >
      <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
      <p className="text-sm font-medium text-destructive">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
