// components/admin/agent-management-view.tsx
//
// Sortable + filterable + multi-select agent list for the admin portal.
//   - Static agents are shown read-only (can't be deleted or status-changed).
//   - Dynamic agents support per-row actions (set status, delete) and bulk
//     actions over selected rows.
//   - Clicking a row's name opens that agent's detail tabs (handled by parent
//     via onSelectAgent).
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  MessageSquare,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { AgentStatusBadge } from "@/components/admin/agent-builder/agent-status-badge";
import { deleteAgent, type AgentInfo } from "@/services/admin-service";
import {
  updateAgentStatus,
  type AgentStatus,
} from "@/services/agent-builder-service";

type SortKey = "name" | "type" | "status" | "updated_at";
type SortDir = "asc" | "desc";
type TypeFilter = "all" | "static" | "dynamic";
type StatusFilter = "all" | AgentStatus;

interface PendingAction {
  kind: "delete" | "status";
  ids: string[];
  status?: AgentStatus;
}

interface Props {
  agents: AgentInfo[];
  onSelectAgent: (id: string) => void;
  onCreate: () => void;
  /** Re-fetch agents from the backend after a mutation (delete / status). */
  onRefresh: () => Promise<void> | void;
}

const TYPE_OF = (a: AgentInfo) => (a.is_dynamic ? "dynamic" : "static");

export function AgentManagementView({
  agents,
  onSelectAgent,
  onCreate,
  onRefresh,
}: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -------------------------------------------------------------------
  // Filter + sort
  // -------------------------------------------------------------------
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agents.filter((a) => {
      if (typeFilter !== "all" && TYPE_OF(a) !== typeFilter) return false;
      if (statusFilter !== "all") {
        if (!a.is_dynamic) return false;
        if (a.status !== statusFilter) return false;
      }
      if (q) {
        const hay = `${a.name} ${a.id} ${a.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [agents, search, typeFilter, statusFilter]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortKey) {
        case "name":
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
          break;
        case "type":
          av = TYPE_OF(a);
          bv = TYPE_OF(b);
          break;
        case "status":
          av = a.status || "—";
          bv = b.status || "—";
          break;
        case "updated_at":
          av = a.updated_at || "";
          bv = b.updated_at || "";
          break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  // -------------------------------------------------------------------
  // Selection (only dynamic agents are selectable)
  // -------------------------------------------------------------------
  const selectableIds = sorted.filter((a) => a.is_dynamic).map((a) => a.id);
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selectedIds);
      selectableIds.forEach((id) => next.delete(id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      selectableIds.forEach((id) => next.add(id));
      setSelectedIds(next);
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const clearSelection = () => setSelectedIds(new Set());

  // -------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------
  const requestDelete = (ids: string[]) =>
    setPending({ kind: "delete", ids });
  const requestStatus = (ids: string[], status: AgentStatus) =>
    setPending({ kind: "status", ids, status });

  const runPending = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      if (pending.kind === "delete") {
        for (const id of pending.ids) {
          await deleteAgent(id);
        }
      } else if (pending.kind === "status" && pending.status) {
        for (const id of pending.ids) {
          await updateAgentStatus(id, pending.status);
        }
      }
      clearSelection();
      await onRefresh();
      setPending(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => {
        if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
        else {
          setSortKey(k);
          setSortDir("asc");
        }
      }}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      {label}
      {sortKey === k ? (
        sortDir === "asc" ? (
          <ArrowUp size={12} />
        ) : (
          <ArrowDown size={12} />
        )
      ) : (
        <ArrowUpDown size={12} className="opacity-40" />
      )}
    </button>
  );

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Top bar: search + filters + create */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, id, or description…"
            className="pl-8 h-9"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="all">All types</option>
          <option value="static">Static</option>
          <option value="dynamic">Dynamic</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <div className="ml-auto" />
        <Button size="sm" onClick={onCreate}>
          <Plus size={14} className="mr-1" /> Create Agent
        </Button>
      </div>

      {/* Bulk actions bar */}
      {someSelected && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">
            {selectedIds.size} selected
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                requestStatus(Array.from(selectedIds), "active" as AgentStatus)
              }
            >
              Activate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                requestStatus(Array.from(selectedIds), "draft" as AgentStatus)
              }
            >
              Set Draft
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                requestStatus(Array.from(selectedIds), "archived" as AgentStatus)
              }
            >
              Archive
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => requestDelete(Array.from(selectedIds))}
            >
              <Trash2 size={14} className="mr-1" /> Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={selectableIds.length === 0}
                />
              </th>
              <th className="px-3 py-2"><SortHeader k="name" label="Name" /></th>
              <th className="px-3 py-2"><SortHeader k="type" label="Type" /></th>
              <th className="px-3 py-2"><SortHeader k="status" label="Status" /></th>
              <th className="px-3 py-2">Capabilities</th>
              <th className="px-3 py-2"><SortHeader k="updated_at" label="Updated" /></th>
              <th className="px-3 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-12 text-center text-muted-foreground"
                >
                  No agents match these filters.
                </td>
              </tr>
            )}
            {sorted.map((a) => {
              const checked = selectedIds.has(a.id);
              return (
                <tr
                  key={a.id}
                  className="border-t border-border hover:bg-muted/20"
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(a.id)}
                      disabled={!a.is_dynamic}
                      title={
                        a.is_dynamic
                          ? "Select"
                          : "Static agents can't be modified"
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => onSelectAgent(a.id)}
                      className="text-left"
                    >
                      <div className="font-medium hover:underline">{a.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1 max-w-md">
                        {a.description}
                      </div>
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${
                        a.is_dynamic
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300"
                      }`}
                    >
                      {a.is_dynamic ? "Dynamic" : "Static"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {a.is_dynamic && a.status ? (
                      <AgentStatusBadge status={a.status} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <CapabilityChips caps={a.capabilities} />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {fmtDate(a.updated_at)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <RowActions
                      agent={a}
                      onSelect={() => onSelectAgent(a.id)}
                      onSetStatus={(s) => requestStatus([a.id], s)}
                      onDelete={() => requestDelete([a.id])}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {/* Confirmation dialog */}
      <Dialog
        open={!!pending}
        onOpenChange={(open) => !open && !busy && setPending(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.kind === "delete"
                ? `Delete ${pending?.ids.length} agent${pending?.ids.length === 1 ? "" : "s"}?`
                : `Set ${pending?.ids.length} agent${pending?.ids.length === 1 ? "" : "s"} to ${pending?.status}?`}
            </DialogTitle>
            <DialogDescription>
              {pending?.kind === "delete"
                ? "This permanently removes the agent and its prompt-version history. This action cannot be undone."
                : "Status changes apply immediately. Active agents are reachable by users; archived agents are hidden."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPending(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant={pending?.kind === "delete" ? "destructive" : "default"}
              onClick={runPending}
              disabled={busy}
            >
              {busy ? "Working…" : pending?.kind === "delete" ? "Delete" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------

function CapabilityChips({ caps }: { caps: string[] }) {
  const visible = caps.slice(0, 3);
  const extra = caps.length - visible.length;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((c) => (
        <span
          key={c}
          className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
        >
          {c}
        </span>
      ))}
      {extra > 0 && (
        <span className="text-[10px] text-muted-foreground">+{extra}</span>
      )}
    </div>
  );
}

function RowActions({
  agent,
  onSelect,
  onSetStatus,
  onDelete,
}: {
  agent: AgentInfo;
  onSelect: () => void;
  onSetStatus: (s: AgentStatus) => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <ChevronDown size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onSelect}>Edit / View</DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/admin/test/${agent.id}`}>
            <MessageSquare size={14} className="mr-2" />
            Test Chat
          </Link>
        </DropdownMenuItem>
        {agent.is_dynamic && (
          <>
            <DropdownMenuSeparator />
            {agent.status !== "active" && (
              <DropdownMenuItem onClick={() => onSetStatus("active" as AgentStatus)}>
                Set Active
              </DropdownMenuItem>
            )}
            {agent.status !== "draft" && (
              <DropdownMenuItem onClick={() => onSetStatus("draft" as AgentStatus)}>
                Set Draft
              </DropdownMenuItem>
            )}
            {agent.status !== "archived" && (
              <DropdownMenuItem onClick={() => onSetStatus("archived" as AgentStatus)}>
                Archive
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 size={14} className="mr-2" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}
