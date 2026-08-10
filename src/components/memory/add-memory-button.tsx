// components/memory/add-memory-button.tsx — AddMemoryButton (§3, §23-24).
// Gated cosmetically by memory.create (PERMISSIONS.md); opens the real Add
// modal (human + advanced mode, UI-2). On success it re-runs the current
// list via a same-URL navigate so the new memory appears without a fake
// optimistic insert.
import { useState } from "react";
import { Plus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/memory/permission-gate";
import { AddMemoryModal } from "@/components/memory/mutations/add-memory-modal";
import { trackMemoryEvent } from "@/lib/memory-telemetry";

export function AddMemoryButton() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <PermissionGate perm="memory.create">
      <Button
        size="sm"
        className="gap-1.5"
        onClick={() => {
          trackMemoryEvent("memory_added", { phase: "started" });
          setOpen(true);
        }}
      >
        <Plus className="size-4" aria-hidden="true" />
        Add memory
      </Button>
      <AddMemoryModal
        open={open}
        onOpenChange={setOpen}
        onAdded={() => {
          trackMemoryEvent("memory_added", { phase: "completed" });
          // Re-run the browser hook by re-navigating to the same URL.
          navigate(`${location.pathname}${location.search}`, { replace: true });
        }}
      />
    </PermissionGate>
  );
}
