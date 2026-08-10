// pages/memory/MemoryMemoriesPage.tsx — UI-1 SCOPE.
//
// Mounts the full MemoryBrowser (MemoryFilters left rail, MemoryToolbar,
// MemoryList/MemoryCard) — COMPONENT_MODEL's canonical Memories screen.
// Also serves as the deep-link target for `/memory/memories/:id`
// (ROUTES.md) — the id is acknowledged here; the Inspector drawer that
// actually opens on it ships in UI-2.
import { useParams } from "react-router-dom";
import { MemoryBrowser } from "@/components/memory/memory-browser";

export default function MemoryMemoriesPage() {
  const { id } = useParams<{ id?: string }>();

  return (
    <div className="flex h-full flex-col gap-4">
      {id && (
        <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Deep link to memory <code className="font-mono">{id}</code> — the Inspector drawer ships in UI-2
          (ROUTES.md deep-link contract).
        </div>
      )}
      <MemoryBrowser />
    </div>
  );
}
