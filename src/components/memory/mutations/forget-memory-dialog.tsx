// components/memory/mutations/forget-memory-dialog.tsx — Forget confirmation
// (UI_SPEC §21-22, §47-48). The strict rules:
//   • NO optimistic update — nothing changes until the backend responds.
//   • "✓ Memory forgotten" is shown ONLY when the engine's ForgetResult says
//     cleanup is complete (projection_purges.pending empty). A non-empty
//     pending renders the honest "cleanup incomplete + Retry cleanup" state,
//     NEVER success (MUI-0023, security-boundaries deletion honesty).
//   • The destructive confirm is a focused button that cannot be triggered by
//     an accidental Enter on the dialog — it requires explicit activation.
import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useForgetMemory } from "@/hooks/memory/use-memory-mutations";

interface ForgetMemoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memoryId: string;
  label: string;
  value: string;
  /** called only after an authoritative COMPLETE forget so the caller can
   *  refresh lists / close the inspector. Not called on incomplete/error. */
  onForgotten?: () => void;
}

export function ForgetMemoryDialog({
  open,
  onOpenChange,
  memoryId,
  label,
  value,
  onForgotten,
}: ForgetMemoryDialogProps) {
  const { phase, outcome, result, error, forgetById, reset } = useForgetMemory();

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const busy = phase === "pending";
  const complete = phase === "success" && outcome === "complete";
  const incomplete = phase === "success" && outcome === "incomplete";
  const notFound = phase === "success" && outcome === "not_found";

  return (
    <Dialog open={open} onOpenChange={(o) => (!busy ? onOpenChange(o) : undefined)}>
      <DialogContent
        // Prevent an accidental Enter from confirming: the dialog's default
        // action is Cancel/Close, never Forget.
        onOpenAutoFocus={(e) => {
          // focus the dialog container, not the destructive button
          e.preventDefault();
          (e.currentTarget as HTMLElement)?.focus?.();
        }}
      >
        {phase !== "success" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" aria-hidden="true" />
                Forget this memory?
              </DialogTitle>
              <DialogDescription>
                <span className="font-medium text-foreground">{label}</span>
                {value ? <> — {value}</> : null}
                <br />
                The system will stop using this memory in future retrieval and
                derived behavior.
              </DialogDescription>
            </DialogHeader>
            {phase === "error" && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => forgetById(memoryId)}
                disabled={busy}
                data-testid="confirm-forget"
              >
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                Forget memory
              </Button>
            </DialogFooter>
          </>
        )}

        {complete && (
          <div role="status" className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 className="size-8 text-emerald-500" aria-hidden="true" />
            <p className="font-medium">Memory forgotten</p>
            <p className="text-sm text-muted-foreground">
              It will no longer be used by agents.
            </p>
            <Button className="mt-2" onClick={() => { onOpenChange(false); onForgotten?.(); }}>
              Done
            </Button>
          </div>
        )}

        {notFound && (
          <div role="status" className="flex flex-col items-center gap-2 py-4 text-center">
            <XCircle className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">Nothing to forget</p>
            <p className="text-sm text-muted-foreground">
              This memory was already forgotten or no longer exists.
            </p>
            <Button className="mt-2" variant="outline" onClick={() => { onOpenChange(false); onForgotten?.(); }}>
              Close
            </Button>
          </div>
        )}

        {incomplete && (
          // HONEST partial-forget state — NOT success (§47). Admin/dev copy.
          <div role="alert" className="flex flex-col gap-2 py-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" aria-hidden="true" />
              <p className="font-medium">Memory forgetting is incomplete</p>
            </div>
            <p className="text-sm text-muted-foreground">
              The memory has been disabled from canonical retrieval, but
              derived-index cleanup is still incomplete
              {result ? ` (${result.projection_purges.pending.length} pending).` : "."}
              {" "}It is not fully forgotten yet.
            </p>
            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button variant="secondary" onClick={() => forgetById(memoryId)}>
                Retry cleanup
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
