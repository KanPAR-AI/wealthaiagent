// pages/memory/MemoryMemoriesPage.tsx — the canonical Memories screen
// (COMPONENT_MODEL) + the Inspector deep-link target (ROUTES.md).
//
// `/memory/memories`      → browser.
// `/memory/memories/:id`  → browser + Inspector drawer open on :id
//                           (deep-linkable, UI-26). Closing the drawer
//                           navigates back to the list, PRESERVING the URL
//                           filters (STATE_MODEL) — the drawer is a route,
//                           not local state, so refresh/deep-link work.
import { useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MemoryBrowser } from "@/components/memory/memory-browser";
import { MemoryInspector } from "@/components/memory/inspector/memory-inspector";

export default function MemoryMemoriesPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Closing the inspector returns to the list with the SAME filters.
  const closeInspector = useCallback(() => {
    const qs = searchParams.toString();
    navigate(`/memory/memories${qs ? `?${qs}` : ""}`);
  }, [navigate, searchParams]);

  // A correct/forget refreshes the list by re-running the browser hook
  // (navigating to the same list URL re-triggers its effect).
  const onMutated = useCallback(() => {
    const qs = searchParams.toString();
    navigate(`/memory/memories${qs ? `?${qs}` : ""}`, { replace: true });
  }, [navigate, searchParams]);

  return (
    <div className="flex h-full flex-col gap-4">
      <MemoryBrowser />
      <MemoryInspector
        memoryId={id}
        open={Boolean(id)}
        onClose={closeInspector}
        onMutated={onMutated}
      />
    </div>
  );
}
