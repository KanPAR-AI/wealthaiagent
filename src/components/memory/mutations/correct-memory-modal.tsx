// components/memory/mutations/correct-memory-modal.tsx — Correct a memory
// (UI_SPEC §20). The button reads "Save correction" (not "Save") when the
// value changes, because a correction creates lifecycle events server-side
// (supersede old → active new) rather than a silent rewrite. NO optimistic
// update; a 409 (stale) surfaces a refetch+retry. Authority/confidence are
// never client-set.
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCorrectMemory } from "@/hooks/memory/use-memory-mutations";
import type { MemoryRecord } from "@/services/memory-engine-service";

interface CorrectMemoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memory: MemoryRecord;
  onCorrected?: () => void;
}

export function CorrectMemoryModal({ open, onOpenChange, memory, onCorrected }: CorrectMemoryModalProps) {
  const initial = memory.value == null ? memory.text : String(memory.value);
  const [value, setValue] = useState(initial);
  const [reason, setReason] = useState("");
  const { phase, error, conflict, submit, reset } = useCorrectMemory();

  useEffect(() => {
    if (open) {
      setValue(initial);
      setReason("");
      reset();
    }
  }, [open, initial, reset]);

  const changed = value.trim() !== String(initial).trim();
  const busy = phase === "pending";

  async function onSave() {
    const r = await submit(memory.id, { value, text: value });
    if (r) {
      onOpenChange(false);
      onCorrected?.();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!busy ? onOpenChange(o) : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit memory</DialogTitle>
          <DialogDescription>
            {changed
              ? "Changing the value creates a correction — the old value is superseded and kept in history, never silently overwritten."
              : "Update this memory. Authority and confidence are set by the engine, not editable here."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="correct-value">Memory</Label>
            <Input
              id="correct-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="correct-reason">Reason for correction (optional)</Label>
            <Input
              id="correct-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this changing?"
              disabled={busy}
            />
          </div>
          {phase === "error" && (
            <p role="alert" className="text-sm text-destructive">
              {error}
              {conflict && (
                <Button variant="link" size="sm" className="ml-1 h-auto p-0" onClick={() => reset()}>
                  Refetch & retry
                </Button>
              )}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={busy || value.trim() === ""} data-testid="save-correction">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {changed ? "Save correction" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
