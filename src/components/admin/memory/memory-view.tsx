// Admin → Memory. See everything the assistant remembers, and when it changed.
//
// The design problem this solves is SCOPE VISIBILITY. A fact stored per-chat
// dies in 24h; the same fact stored per-user follows the person across every
// conversation forever. In a reply those look identical and behave completely
// differently, so scope is a coloured badge on every single row rather than a
// detail you have to go looking for.

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, AlertTriangle, Clock, User, Bot, MessageSquare } from "lucide-react";
import {
  fetchMemory,
  type AuditRow,
  type FactStore,
  type MemoryScope,
  type MemoryView as MemoryData,
} from "@/services/memory-service";

const SCOPE_STYLE: Record<MemoryScope, string> = {
  chat: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  agent: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  user: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

const SCOPE_HINT: Record<MemoryScope, string> = {
  chat: "dies with this chat (slots expire in 24h)",
  agent: "follows the user, but only inside this one agent",
  user: "follows the user across every agent",
};

function ScopeBadge({ scope }: { scope: MemoryScope }) {
  return (
    <span
      title={SCOPE_HINT[scope]}
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${SCOPE_STYLE[scope]}`}
    >
      {scope}
    </span>
  );
}

function relativeTime(iso: string): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso.slice(0, 19);
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function FactStoreCard({ store }: { store: FactStore }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <ScopeBadge scope={store.scope} />
        <span className="font-medium text-sm">
          {store.agent_id || store.collection}
        </span>
        {store.cross_domain && (
          <span className="text-[11px] rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600 dark:text-emerald-400">
            cross-domain
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {store.fact_count} fact{store.fact_count === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-2 space-y-1">
        {store.facts.slice(0, 40).map((f, i) => (
          <div key={i} className="flex gap-2 text-xs">
            <span className="text-muted-foreground shrink-0">{f.category || "—"}</span>
            <span className="font-medium shrink-0">{f.key}</span>
            <span className="text-muted-foreground truncate">{String(f.value ?? "")}</span>
            {typeof f.confidence === "number" && (
              <span className="ml-auto shrink-0 text-muted-foreground">
                {Math.round(f.confidence * 100)}%
              </span>
            )}
          </div>
        ))}
        {store.fact_count > 40 && (
          <p className="text-xs text-muted-foreground">
            …and {store.fact_count - 40} more
          </p>
        )}
      </div>
    </div>
  );
}

function AuditTable({ rows }: { rows: AuditRow[] }) {
  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No recorded changes for this selection.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr className="border-b border-border">
            <th className="text-left py-1.5 pr-3 font-medium">When</th>
            <th className="text-left py-1.5 pr-3 font-medium">Scope</th>
            <th className="text-left py-1.5 pr-3 font-medium">Change</th>
            <th className="text-left py-1.5 pr-3 font-medium">What</th>
            <th className="text-left py-1.5 font-medium">Value / evidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/50 align-top">
              <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground"
                  title={r.at}>
                {relativeTime(r.at)}
              </td>
              <td className="py-1.5 pr-3"><ScopeBadge scope={r.scope} /></td>
              <td className="py-1.5 pr-3 whitespace-nowrap">
                {/* Retirement is the interesting case — it explains a
                    surprising answer far more often than a creation does. */}
                <span className={
                  r.action === "superseded" || r.action === "released" || r.action === "cleared"
                    ? "text-rose-600 dark:text-rose-400 font-medium"
                    : ""
                }>
                  {r.action}
                </span>
              </td>
              <td className="py-1.5 pr-3 font-medium">
                {r.what}
                {r.agent && (
                  <span className="ml-1 text-muted-foreground">({r.agent})</span>
                )}
              </td>
              <td className="py-1.5 text-muted-foreground">
                <span className="break-all">{r.detail}</span>
                {r.source && (
                  <span className="block opacity-60 break-all">↳ {r.source}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MemoryView() {
  const [identifier, setIdentifier] = useState("");
  const [chatId, setChatId] = useState("");
  const [data, setData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    if (!identifier.trim() && !chatId.trim()) {
      setError("Enter an email address or a chat ID.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setData(await fetchMemory({
        identifier: identifier.trim() || undefined,
        chatId: chatId.trim() || undefined,
        auditLimit: 50,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const um = data?.user_memory;
  const stores = [...(um?.user_scoped || []), ...(um?.agent_scoped || [])];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Memory explorer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              placeholder="Email address (e.g. someone@gmail.com)"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              className="flex-1 h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="text"
              placeholder="Chat ID (optional)"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              className="flex-1 h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button size="sm" onClick={load} disabled={loading}>
              <Search size={14} className="mr-1" />
              {loading ? "Loading…" : "Look up"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Search by email — you should never need to paste a Firebase UID. A
            chat ID on its own shows that conversation's state; both together
            interleave the timeline.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {/* A failed source renders identically to "nothing happened", so say so
          explicitly rather than showing a confident blank. */}
      {!!data?.errors?.length && (
        <Card className="border-amber-500/40">
          <CardContent className="pt-4 flex gap-2 text-sm">
            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Part of the timeline could not be read</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                The list below is incomplete — this is not "no changes".
              </p>
              <ul className="mt-1 text-xs text-muted-foreground">
                {data.errors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {data?.user?.uid && (
        <Card>
          <CardContent className="pt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="flex items-center gap-1.5">
              <User size={14} className="text-muted-foreground" />
              <span className="font-medium">{data.user.email || "(no email)"}</span>
            </span>
            <code className="text-xs text-muted-foreground">{data.user.uid}</code>
            <span className="text-xs text-muted-foreground">
              resolved via {data.user.source}
            </span>
            {um?.preferences?.personalization_enabled === false && (
              <span className="text-xs rounded bg-rose-500/15 px-1.5 py-0.5 text-rose-600 dark:text-rose-400">
                personalization OFF — nothing new is being stored
              </span>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {um?.total_facts ?? 0} fact{(um?.total_facts ?? 0) === 1 ? "" : "s"}
            </span>
          </CardContent>
        </Card>
      )}

      {!!stores.length && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot size={14} /> What it remembers about this person
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stores.map((s) => <FactStoreCard key={s.collection} store={s} />)}
          </CardContent>
        </Card>
      )}

      {data && !stores.length && data.user?.uid && (
        <Card>
          <CardContent className="pt-4 text-sm text-muted-foreground">
            No durable facts stored for this user yet.
          </CardContent>
        </Card>
      )}

      {!!data?.chat_memory && Object.keys(data.chat_memory).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare size={14} /> This chat's state
              <ScopeBadge scope="chat" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs overflow-x-auto max-h-80 overflow-y-auto bg-muted/40 rounded p-2">
              {JSON.stringify(data.chat_memory, null, 1)}
            </pre>
          </CardContent>
        </Card>
      )}

      {data && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock size={14} /> Last {data.audit_limit} changes
              <span className="text-xs font-normal text-muted-foreground">
                newest first
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AuditTable rows={data.audit} />
            <p className="mt-3 text-xs text-muted-foreground">
              Slots and constraints keep a full append-only history. User and
              agent facts only store their last write, so those rows show when a
              fact was last changed — not every time it changed.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
