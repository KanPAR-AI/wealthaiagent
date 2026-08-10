// components/memory/memory-page.tsx — MemoryPage layout shell (§55):
// header + sub-nav + content outlet + right-side inspector slot. Mounted
// once at the /memory route root (App.tsx); nested routes render into the
// Outlet. The inspector slot is reserved chrome — it renders only once a
// nested screen opens it via `memoryUiStore` (UI-2); in UI-0 nothing opens
// it, so it stays absent from the DOM rather than rendering an empty box.
import { Outlet } from "react-router-dom";
import { MemoryPageHeader } from "@/components/memory/memory-page-header";
import { MemorySubNav } from "@/components/memory/memory-sub-nav";
import { MemoryAssistantPanel } from "@/components/memory/memory-assistant-panel";
import { useMemoryUiStore } from "@/store/memory-ui";

export function MemoryPage() {
  const inspectorOpen = useMemoryUiStore((s) => s.inspectorOpen);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <MemoryPageHeader />
      <MemorySubNav />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4">
          <Outlet />
        </main>
        {inspectorOpen && (
          <aside
            data-testid="memory-inspector-slot"
            className="w-[520px] max-w-full shrink-0 overflow-y-auto border-l border-border/60"
          />
        )}
      </div>
      {/* Own-scope conversational surface for every Memory screen: ask what's
          remembered, debug retrieval, and propose (never perform) a forget/
          correct. Mounted once at the /memory root, floats above the outlet. */}
      <MemoryAssistantPanel />
    </div>
  );
}
