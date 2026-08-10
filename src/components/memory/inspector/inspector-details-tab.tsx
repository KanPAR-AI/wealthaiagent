// components/memory/inspector/inspector-details-tab.tsx — Inspector Details
// (UI_SPEC §14). Every canonical field, rendered straight from the engine's
// record — the client computes NO memory semantics (status/authority/
// confidence/validity are displayed, never derived).
import type { MemoryRecord } from "@/services/memory-engine-service";
import { StatusBadge } from "@/components/memory/status-badge";
import { SourceBadge } from "@/components/memory/source-badge";
import { ConfidenceIndicator } from "@/components/memory/confidence-indicator";
import { ExpandableValue } from "@/components/memory/expandable-value";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function fmt(ts: string | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? String(ts) : d.toLocaleString();
}

export function InspectorDetailsTab({ memory }: { memory: MemoryRecord }) {
  const qualifiers = Object.entries(memory.qualifiers ?? {});
  return (
    <dl className="divide-y divide-border/50" data-testid="inspector-details">
      <Row label="Value">
        <ExpandableValue value={memory.value ?? memory.text} />
      </Row>
      <Row label="Status">
        <StatusBadge status={memory.status} />
      </Row>
      <Row label="Type">{memory.type}</Row>
      <Row label="Subject">{memory.subject?.text ?? "user"}</Row>
      <Row label="Predicate">
        <span className="font-mono text-xs">{memory.predicate ?? "—"}</span>
      </Row>
      <Row label="Qualifiers">
        {qualifiers.length === 0 ? (
          "—"
        ) : (
          <ul className="space-y-0.5">
            {qualifiers.map(([k, v]) => (
              <li key={k} className="font-mono text-xs">
                {k} = {String(v)}
              </li>
            ))}
          </ul>
        )}
      </Row>
      <Row label="Namespace">{memory.namespace}</Row>
      <Row label="Scope">
        {memory.owner_key ?? `${memory.owner_type}:${memory.owner_id}`}
      </Row>
      <Row label="Source">
        <SourceBadge source={memory.source_type} />
      </Row>
      <Row label="Confidence">
        <ConfidenceIndicator confidence={memory.confidence} devMode />
      </Row>
      <Row label="Authority">
        <span title="Engine authority ladder (§12) — display only">
          {memory.authority.toFixed(2)}
        </span>
      </Row>
      <Row label="Importance">{memory.importance.toFixed(2)}</Row>
      <Row label="Valid from">{fmt(memory.valid_from)}</Row>
      <Row label="Valid until">{memory.valid_until ? fmt(memory.valid_until) : "current"}</Row>
      <Row label="Created">{fmt(memory.created_at)}</Row>
      <Row label="Updated">{fmt(memory.updated_at)}</Row>
      <Row label="Last accessed">{fmt(memory.last_accessed_at)}</Row>
      <Row label="Access count">{memory.access_count}</Row>
      <Row label="Tags">
        {memory.tags.length === 0 ? "—" : memory.tags.join(", ")}
      </Row>
    </dl>
  );
}
