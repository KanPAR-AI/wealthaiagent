// components/memory/mutations/broad-forget-dialog.tsx — Broad forget
// (UI_SPEC §21). "Forget all <domain> preferences?" — the affected COUNT is
// the ENGINE's dry-run count (Q8 resolved), fetched BEFORE the user can
// confirm, never a client-side approximation. Completion follows the same
// honest rules as single forget: success ONLY when the engine's ForgetResult
// says cleanup is complete; an honest "incomplete" state otherwise; never
// optimistic.
import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useForgetPreview,
  useForgetMemory,
} from "@/hooks/memory/use-memory-mutations";
import type { ForgetBody } from "@/services/memory-engine-service";

interface BroadForgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** the filter to forget — e.g. { namespace: "travel" }. */
  filter: ForgetBody;
  /** human label for the confirmation, e.g. "travel". */
  scopeLabel: string;
  onForgotten?: () => void;
}

export function BroadForgetDialog({
  open,
  onOpenChange,
  filter,
  scopeLabel,
  onForgotten,
}: BroadForgetDialogProps) {
  const preview = useForgetPreview();
  const forget = useForgetMemory();

  // Fetch the engine's affected count as soon as the dialog opens — BEFORE
  // the user can confirm (§21). This mutates nothing.
  useEffect(() => {
    if (open) {
      preview.load(filter);
    } else {
      preview.reset();
      forget.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const count = preview.preview?.affected_count ?? null;
  const nothing = preview.phase === "success" && count === 0;
  const busy = forget.phase === "pending";
  const complete = forget.phase === "success" && forget.outcome === "complete";
  const incomplete = forget.phase === "success" && forget.outcome === "incomplete";

  async function confirm() {
    const r = await forget.forgetBroad(filter);
    if (r && r.projection_purges.pending.length === 0 && r.forgotten_count > 0) {
      // complete — let the success state show, caller refreshes on close
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!busy ? onOpenChange(o) : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" aria-hidden="true" />
            Forget all {scopeLabel} memories?
          </DialogTitle>
          <DialogDescription>
            {preview.phase === "pending" && "Counting affected memories…"}
            {preview.phase === "error" && (preview.error ?? "Could not count affected memories.")}
            {preview.phase === "success" && count != null && count > 0 && (
              <>
                <span className="font-medium text-foreground">{count}</span>{" "}
                {count === 1 ? "memory" : "memories"} will be forgotten (including
                superseded history). The system will stop using them in future
                retrieval and derived behavior.
              </>
            )}
            {nothing && "No matching memories to forget."}
          </DialogDescription>
        </DialogHeader>

        {forget.phase === "error" && (
          <p role="alert" className="text-sm text-destructive">{forget.error}</p>
        )}

        {complete ? (
          <div role="status" className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 className="size-8 text-emerald-500" aria-hidden="true" />
            <p className="font-medium">
              {forget.result?.forgotten_count ?? 0} memories forgotten
            </p>
            <p className="text-sm text-muted-foreground">They will no longer be used by agents.</p>
            <Button className="mt-2" onClick={() => { onOpenChange(false); onForgotten?.(); }}>Done</Button>
          </div>
        ) : incomplete ? (
          <div role="alert" className="flex flex-col gap-2 py-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" aria-hidden="true" />
              <p className="font-medium">Forgetting is incomplete</p>
            </div>
            <p className="text-sm text-muted-foreground">
              These memories are disabled from canonical retrieval, but derived-index
              cleanup is still incomplete
              {forget.result ? ` (${forget.result.projection_purges.pending.length} pending).` : "."}
            </p>
            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              <Button variant="secondary" onClick={confirm}>Retry cleanup</Button>
            </DialogFooter>
          </div>
        ) : (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={confirm}
              disabled={busy || nothing || count == null || count === 0}
              data-testid="confirm-broad-forget"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {count != null && count > 0 ? `Forget ${count} ${count === 1 ? "memory" : "memories"}` : "Forget"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
