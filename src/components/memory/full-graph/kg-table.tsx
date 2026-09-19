// components/memory/full-graph/kg-table.tsx — the raw table tab (§5 of the
// page spec: "a debugger needs to read rows, not only look at dots").
// Renders the SAME filtered record set the graph shows, sortable by
// column, with a per-row "copy as JSON" (same pattern as
// inspector/inspector-raw-tab.tsx). Memory text/value is untrusted input —
// rendered via UntrustedText, never innerHTML.
import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { StatusBadge } from "@/components/memory/status-badge";
import { ValidityRange } from "@/components/memory/validity-range";
import { UntrustedText } from "@/components/memory/untrusted-text";
import type { MemoryRecord } from "@/services/memory-engine-service";
import type { ProblemSets } from "@/lib/knowledge-graph-assembly";

type SortKey = "namespace" | "predicate" | "status" | "confidence" | "authority" | "created_at";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "namespace", label: "Namespace" },
  { key: "predicate", label: "Predicate" },
  { key: "status", label: "Status" },
  { key: "confidence", label: "Confidence" },
  { key: "authority", label: "Authority" },
  { key: "created_at", label: "Created" },
];

function sortValue(record: MemoryRecord, key: SortKey): string | number {
  switch (key) {
    case "namespace":
      return record.namespace;
    case "predicate":
      return record.predicate ?? "";
    case "status":
      return record.status;
    case "confidence":
      return record.confidence;
    case "authority":
      return record.authority;
    case "created_at":
      return record.created_at ?? "";
  }
}

export interface KgTableProps {
  records: MemoryRecord[];
  problems: ProblemSets;
  selectedId?: string | null;
  onSelectRecord: (record: MemoryRecord) => void;
}

export function KgTable({ records, problems, selectedId, onSelectRecord }: KgTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const copy = [...records];
    copy.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [records, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function copyJson(record: MemoryRecord) {
    void navigator.clipboard?.writeText(JSON.stringify(record, null, 2));
    setCopiedId(record.id);
    setTimeout(() => setCopiedId((id) => (id === record.id ? null : id)), 1500);
  }

  function problemLabel(record: MemoryRecord): string | null {
    const reasons: string[] = [];
    if (problems.duplicateRecordIds.has(record.id)) reasons.push("duplicate");
    if (problems.orphanRecordIds.has(record.id)) reasons.push("orphan");
    if (problems.suspiciousRecordIds.has(record.id)) reasons.push("suspicious");
    return reasons.length ? reasons.join(", ") : null;
  }

  if (records.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-muted-foreground" data-testid="kg-table-empty">
        No records match the current filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border/60" data-testid="kg-table">
      <table className="w-full text-sm">
        <caption className="sr-only">All memory records matching the current filters</caption>
        <thead className="bg-muted/30 text-left text-xs text-muted-foreground">
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.key} scope="col" className="px-3 py-2 font-medium">
                <button
                  type="button"
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort(c.key)}
                  aria-sort={sortKey === c.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  {c.label}
                  {sortKey === c.key && (sortDir === "asc" ? "▲" : "▼")}
                </button>
              </th>
            ))}
            <th scope="col" className="px-3 py-2 font-medium">
              Value
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Valid
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Flags
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {sorted.map((record) => {
            const flag = problemLabel(record);
            return (
              <tr
                key={record.id}
                className={record.id === selectedId ? "bg-primary/5" : undefined}
                data-testid="kg-table-row"
              >
                <td className="px-3 py-2">{record.namespace}</td>
                <td className="px-3 py-2">
                  <button type="button" className="text-primary hover:underline" onClick={() => onSelectRecord(record)}>
                    {record.predicate ?? "—"}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={record.status} />
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{Math.round(record.confidence * 100)}%</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{Math.round(record.authority * 100)}%</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{record.created_at ?? "—"}</td>
                <td className="px-3 py-2 max-w-[220px]">
                  <UntrustedText inline>{String(record.value ?? record.text ?? "")}</UntrustedText>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  <ValidityRange validFrom={record.valid_from} validUntil={record.valid_until} />
                </td>
                <td className="px-3 py-2 text-xs">
                  {flag ? <span className="text-amber-600 dark:text-amber-400">{flag}</span> : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => copyJson(record)}
                    aria-label={`Copy ${record.predicate ?? record.id} as JSON`}
                  >
                    {copiedId === record.id ? (
                      <Check className="size-3" aria-hidden="true" />
                    ) : (
                      <Copy className="size-3" aria-hidden="true" />
                    )}
                    Copy JSON
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
