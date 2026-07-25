// Admin → Credits: approve/deny credit requests + look up a user's balance and
// grant/deduct credits. Backed by chatservice /admin/credits/*.

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, RefreshCw, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CreditRequest, ResolvedUser, grantCredits, lookupUser,
  listCreditRequests, resolveCreditRequest,
} from "@/services/credits-admin-service";

function when(ts: number) {
  if (!ts) return "";
  try { return new Date(ts * 1000).toLocaleString(); } catch { return ""; }
}

export function CreditsAdminView() {
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listCreditRequests("pending")
      .then((d) => { setRequests(d.requests); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const resolve = async (r: CreditRequest, approve: boolean, credits: number) => {
    setBusyId(r.id);
    try {
      await resolveCreditRequest(r.id, approve, credits);
      setRequests((prev) => prev.filter((x) => x.id !== r.id));
    } catch (e: any) { setError(e.message); } finally { setBusyId(null); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Credits</h2>
          <p className="text-sm text-muted-foreground">
            Approve requests, or look up a user and grant/deduct credits.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {error && <p className="text-sm text-destructive mb-3">{error}</p>}

      {/* ── Pending requests ─────────────────────────────────────────── */}
      <p className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">
        Pending requests {requests.length > 0 && `(${requests.length})`}
      </p>
      <div className="border border-border rounded-lg divide-y divide-border mb-6">
        {loading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No pending requests.</p>
        ) : (
          requests.map((r) => (
            <RequestRow key={r.id} req={r} busy={busyId === r.id} onResolve={resolve} />
          ))
        )}
      </div>

      {/* ── User lookup + grant ──────────────────────────────────────── */}
      <UserGrantPanel />
    </div>
  );
}

function RequestRow({
  req, busy, onResolve,
}: {
  req: CreditRequest;
  busy: boolean;
  onResolve: (r: CreditRequest, approve: boolean, credits: number) => void;
}) {
  const [amount, setAmount] = useState(String(req.amount_requested || 5000));
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{req.email || req.uid}</div>
        <div className="text-xs text-muted-foreground truncate">
          asked {req.amount_requested?.toLocaleString() || "—"} · {when(req.created_at)}
          {req.note ? ` · "${req.note}"` : ""}
        </div>
      </div>
      <input
        type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)}
        className="w-28 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        title="Credits to grant"
      />
      <Button size="sm" disabled={busy} onClick={() => onResolve(req, true, Number(amount))}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} className="mr-1" />}
        Approve
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => onResolve(req, false, 0)}>
        <X size={14} className="mr-1" /> Deny
      </Button>
    </div>
  );
}

function UserGrantPanel() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<ResolvedUser | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const lookup = async () => {
    if (!query.trim()) return;
    setBusy(true); setErr(null);
    try { setData(await lookupUser(query.trim())); }
    catch (e: any) { setErr(e.message); setData(null); } finally { setBusy(false); }
  };

  const grant = async () => {
    const n = Number(amount);
    if (!data?.uid || !n) return;
    setBusy(true); setErr(null);
    try {
      await grantCredits(data.uid, n, reason || "admin adjustment");
      setAmount(""); setReason("");
      setData(await lookupUser(query.trim()));
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">
        Look up a user (email · phone · uid) &amp; grant/deduct
      </p>
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") lookup(); }}
            placeholder="email, +phone, or uid"
            className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-2 text-sm"
          />
        </div>
        <Button size="sm" variant="outline" onClick={lookup} disabled={busy || !query.trim()}>Look up</Button>
      </div>
      {err && <p className="text-sm text-destructive mb-2">{err}</p>}

      {data && (
        <div className="border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="min-w-0">
              <div className="text-sm truncate">{data.email || data.phone || data.uid}</div>
              <div className="text-xs text-muted-foreground font-mono truncate">{data.uid}</div>
            </div>
            <span className="text-sm shrink-0">Balance: <b>{data.balance.toLocaleString()}</b> credits</span>
          </div>
          <div className="flex gap-2 mb-3">
            <input
              type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="+ award / − remove"
              className="w-40 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
            <input
              value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="reason (optional)"
              className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
            <Button size="sm" onClick={grant} disabled={busy || !Number(amount)}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : "Apply"}
            </Button>
          </div>
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Recent ledger</p>
          <div className="max-h-56 overflow-y-auto text-xs divide-y divide-border">
            {(data.ledger || []).slice(0, 30).map((e, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">{when(e.ts)} · {e.type}</span>
                <span className={e.credits >= 0 ? "text-emerald-600" : "text-red-600"}>
                  {e.credits >= 0 ? "+" : ""}{e.credits.toLocaleString()} → {e.balance_after.toLocaleString()}
                </span>
              </div>
            ))}
            {(!data.ledger || data.ledger.length === 0) && (
              <p className="py-2 text-muted-foreground">No ledger entries.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
