// components/memory/inspector/inspector-history-tab.tsx — Inspector History
// (UI_SPEC §17). A visual lifecycle timeline of the engine's events,
// newest-first. Lifecycle is NOT computed here — these are the engine's
// MemoryEvent rows (Created/Reinforced/Updated/Corrected/Disputed/
// Superseded/Expired/Forgotten/Restored) displayed with their value
// transitions from previous_state/new_state.
import type { MemoryEvent } from "@/services/memory-engine-service";
import { EmptyState } from "@/components/memory/empty-state";

const EVENT_LABEL: Record<string, string> = {
  created: "Created",
  reinforced: "Reinforced",
  updated: "Updated",
  superseded: "Superseded",
  disputed: "Disputed",
  expired: "Expired",
  forgotten: "Forgotten",
  restored: "Restored",
};

function fmt(ts: string): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleString();
}

function valueOf(state: Record<string, unknown> | null): string | null {
  if (!state) return null;
  const v = state.value ?? state.text;
  return v == null ? null : String(v);
}

export function InspectorHistoryTab({ history }: { history: MemoryEvent[] }) {
  if (history.length === 0) {
    return <EmptyState title="No history yet" description="Lifecycle events appear as this memory is reinforced, corrected, or superseded." />;
  }
  return (
    <ol className="relative space-y-4 pl-4" data-testid="inspector-history">
      {history.map((ev, i) => {
        const prev = valueOf(ev.previous_state);
        const next = valueOf(ev.new_state);
        const changed = prev != null && next != null && prev !== next;
        return (
          <li key={ev.id} className="relative border-l border-border pl-4">
            <span
              className="absolute -left-[5px] top-1 size-2 rounded-full bg-primary"
              aria-hidden="true"
            />
            <div className="flex items-center gap-2 text-sm font-medium">
              <span>{EVENT_LABEL[ev.event] ?? ev.event}</span>
              {i === 0 && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                  Latest
                </span>
              )}
            </div>
            {changed && (
              <div className="mt-0.5 text-sm">
                <span className="text-muted-foreground line-through">{prev}</span>
                <span aria-hidden="true"> → </span>
                <span className="font-medium">{next}</span>
                <span className="sr-only"> changed from {prev} to {next}</span>
              </div>
            )}
            {ev.reason && (
              <p className="mt-0.5 text-xs text-muted-foreground">{ev.reason}</p>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground">
              {fmt(ev.created_at)} · {ev.actor_type}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
