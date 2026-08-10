// components/memory/mutations/add-memory-modal.tsx — Add memory (UI_SPEC
// §23-24). Human-friendly by default (free text + scope [own only] + domain
// + validity), with an Advanced toggle for structured fields. NO optimistic
// success — a policy rejection or error is surfaced honestly. Raw authority/
// confidence are NOT user-settable (the engine's policy engine decides).
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
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
import { useAddMemory } from "@/hooks/memory/use-memory-mutations";
import type { WriteBody } from "@/services/memory-engine-service";

const DOMAINS = ["profile", "preferences", "travel", "health", "work", "relationships", "other"];

interface AddMemoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: () => void;
}

export function AddMemoryModal({ open, onOpenChange, onAdded }: AddMemoryModalProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [domain, setDomain] = useState("profile");
  const [advanced, setAdvanced] = useState(false);
  const [predicate, setPredicate] = useState("");
  const [value, setValue] = useState("");
  const { phase, error, submit, reset } = useAddMemory();

  useEffect(() => {
    if (open) {
      setContent("");
      setDomain("profile");
      setAdvanced(false);
      setPredicate("");
      setValue("");
      reset();
    }
  }, [open, reset]);

  const busy = phase === "pending";
  const canSubmit = advanced ? predicate.trim() !== "" && value.trim() !== "" : content.trim() !== "";

  async function onRemember() {
    const body: WriteBody = advanced
      ? {
          candidate: {
            namespace: domain,
            predicate: predicate.trim(),
            value: value.trim(),
            text: value.trim(),
          },
        }
      : { content: content.trim(), namespace_hint: domain };
    const r = await submit(body);
    if (r) {
      onOpenChange(false);
      onAdded?.();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!busy ? onOpenChange(o) : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add memory</DialogTitle>
          <DialogDescription>What should this system remember?</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!advanced ? (
            <div className="space-y-1.5">
              <Label htmlFor="add-content">Memory</Label>
              <Input
                id="add-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="I prefer vegetarian meals on flights"
                disabled={busy}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="add-predicate">Predicate</Label>
                <Input id="add-predicate" value={predicate} onChange={(e) => setPredicate(e.target.value)} placeholder="meal_preference" disabled={busy} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-value">Value</Label>
                <Input id="add-value" value={value} onChange={(e) => setValue(e.target.value)} placeholder="vegetarian" disabled={busy} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-scope">Remember for</Label>
              {/* Scope is own-only (ADR-005): cross-user is not offered. */}
              <Input id="add-scope" value={user?.displayName || user?.email || "you"} readOnly disabled aria-describedby="add-scope-note" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-domain">Domain</Label>
              <select
                id="add-domain"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                disabled={busy}
              >
                {DOMAINS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
          <p id="add-scope-note" className="text-xs text-muted-foreground">
            Stored for your own memory only. Authority and confidence are set by the engine.
          </p>

          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setAdvanced((a) => !a)}>
            {advanced ? "Simple mode" : "Advanced"}
          </Button>

          {phase === "error" && (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={onRemember} disabled={busy || !canSubmit} data-testid="submit-add-memory">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Remember
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
