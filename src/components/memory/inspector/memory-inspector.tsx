// components/memory/inspector/memory-inspector.tsx — the Memory Inspector
// drawer (UI_SPEC §12-13). A right-side Sheet (radix dialog → focus trap,
// Esc-to-close, focus restored to the trigger for free) 480-560px wide,
// opened by the /memory/memories/:id route param and closed by navigating
// back to the list (filters preserved). Tabs: Details · History (this slice);
// Evidence · Usage · Raw arrive in later slices and show as disabled tabs so
// the information architecture is honest, not faked.
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/memory/status-badge";
import { LoadingSkeleton } from "@/components/memory/loading-skeleton";
import { ErrorState } from "@/components/memory/error-state";
import { EmptyState } from "@/components/memory/empty-state";
import { PermissionGate } from "@/components/memory/permission-gate";
import { InspectorDetailsTab } from "./inspector-details-tab";
import { InspectorHistoryTab } from "./inspector-history-tab";
import { CorrectMemoryModal } from "@/components/memory/mutations/correct-memory-modal";
import { ForgetMemoryDialog } from "@/components/memory/mutations/forget-memory-dialog";
import { useMemoryInspector } from "@/hooks/memory/use-memory-inspector";
import { trackMemoryEvent } from "@/lib/memory-telemetry";

const TABS = [
  { key: "details", label: "Details", ready: true },
  { key: "history", label: "History", ready: true },
  { key: "evidence", label: "Evidence", ready: false }, // UI-3
  { key: "usage", label: "Usage", ready: false }, // UI-6
  { key: "raw", label: "Raw", ready: false }, // later
] as const;
type TabKey = (typeof TABS)[number]["key"];

interface MemoryInspectorProps {
  memoryId: string | undefined;
  open: boolean;
  onClose: () => void;
  onMutated?: () => void;
}

export function MemoryInspector({ memoryId, open, onClose, onMutated }: MemoryInspectorProps) {
  const [tab, setTab] = useState<TabKey>("details");
  const [editing, setEditing] = useState(false);
  const [forgetting, setForgetting] = useState(false);
  const { status, memory, history, error, refetch } = useMemoryInspector(open ? memoryId : undefined);

  const label = memory?.predicate?.replace(/[._]/g, " ") ?? "Memory";
  const valueStr = memory?.value == null ? (memory?.text ?? "") : String(memory.value);

  return (
    <Sheet open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-[520px]"
        aria-label="Memory Inspector"
      >
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="flex items-center gap-2">
            <span className="capitalize">{label}</span>
            {memory && <StatusBadge status={memory.status} />}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Inspect this memory's details, evidence, history, and usage; edit
            or forget it.
          </SheetDescription>
        </SheetHeader>

        {/* Tab strip */}
        <div role="tablist" aria-label="Inspector tabs" className="flex gap-1 border-b px-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              disabled={!t.ready}
              onClick={() => {
                setTab(t.key);
                if (t.key === "history") trackMemoryEvent("memory_history_opened", { memory_id: memoryId });
              }}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground",
                t.ready ? "hover:text-foreground" : "cursor-not-allowed opacity-40",
              )}
              title={t.ready ? undefined : "Coming in a later slice"}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {status === "loading" || status === "idle" ? (
            <LoadingSkeleton rows={8} />
          ) : status === "notfound" ? (
            <EmptyState title="Memory not found" description="This memory does not exist, or you don't have access to it." />
          ) : status === "error" ? (
            <ErrorState message={error ?? "Could not load this memory."} onRetry={refetch} />
          ) : memory ? (
            tab === "details" ? (
              <InspectorDetailsTab memory={memory} />
            ) : tab === "history" ? (
              <InspectorHistoryTab history={history} />
            ) : null
          ) : null}
        </div>

        {/* Actions */}
        {status === "success" && memory && (
          <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
            <PermissionGate perm="memory.correct">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            </PermissionGate>
            <PermissionGate perm="memory.forget">
              <Button variant="destructive" size="sm" onClick={() => setForgetting(true)}>
                Forget
              </Button>
            </PermissionGate>
          </div>
        )}

        {memory && (
          <>
            <CorrectMemoryModal
              open={editing}
              onOpenChange={setEditing}
              memory={memory}
              onCorrected={() => {
                refetch();
                onMutated?.();
              }}
            />
            <ForgetMemoryDialog
              open={forgetting}
              onOpenChange={setForgetting}
              memoryId={memory.id}
              label={label}
              value={valueStr}
              onForgotten={() => {
                onMutated?.();
                onClose();
              }}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
