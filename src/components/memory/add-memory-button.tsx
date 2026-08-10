// components/memory/add-memory-button.tsx — AddMemoryButton (§3, §23-24).
// Gated cosmetically by memory.create (PERMISSIONS.md); the real Add modal
// (human + advanced mode) is UI-2 (MUI-0024). This button exists so the
// header matches §3 but performs no fake mutation.
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/memory/permission-gate";

export function AddMemoryButton() {
  return (
    <PermissionGate perm="memory.create">
      <Button
        size="sm"
        className="gap-1.5"
        onClick={() => toast.info("Add memory arrives with the Inspector mutations (UI-2).")}
      >
        <Plus className="size-4" aria-hidden="true" />
        Add memory
      </Button>
    </PermissionGate>
  );
}
