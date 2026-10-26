import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchAgents,
  lookupUser,
  pinAgentForUser,
  unpinAgentForUser,
  type AgentInfo,
  type UserLookup,
} from "@/services/admin-service";

/**
 * Pin an agent for one user, remotely (owner, 2026-10-26). Look the person
 * up by email, phone or uid, pick the agent and the mode, pin. The pin rides
 * on /auth/me, so it takes effect on their next app start on every device.
 * The invite link `/a/<slug>?pin=1` does the same without this panel.
 */
export function PinnedAgentPanel() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<UserLookup | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [agentId, setAgentId] = useState("");
  const [mode, setMode] = useState<"default" | "locked">("default");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!open || agents.length) return;
    fetchAgents().then((r) => setAgents(r.agents || [])).catch(() => {});
  }, [open, agents.length]);

  const find = async () => {
    setBusy(true); setNote(null); setUser(null);
    try {
      const q = query.trim();
      const u = await lookupUser(q.includes("@") ? { email: q } : q.startsWith("+") ? { phone: q } : { uid: q });
      setUser(u);
      if (u.pinnedAgent) { setAgentId(u.pinnedAgent.agent_id); setMode(u.pinnedAgent.mode); }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "No such user");
    } finally { setBusy(false); }
  };

  const pin = async () => {
    if (!user || !agentId) return;
    setBusy(true); setNote(null);
    try {
      const r = await pinAgentForUser(user.uid, agentId, mode);
      setUser({ ...user, pinnedAgent: r.pinnedAgent });
      setNote(`Pinned ${agentId} (${mode}) for ${user.email || user.phoneNumber || user.uid}. Takes effect on their next app start.`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Pin failed");
    } finally { setBusy(false); }
  };

  const unpin = async () => {
    if (!user) return;
    setBusy(true); setNote(null);
    try {
      await unpinAgentForUser(user.uid);
      setUser({ ...user, pinnedAgent: null });
      setNote("Unpinned.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Unpin failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-lg border border-border/60 p-3 text-sm">
      <button type="button" className="w-full text-left font-medium" onClick={() => setOpen(!open)} data-testid="pin-panel-toggle">
        {open ? "▾" : "▸"} Pin an agent for a user
      </button>
      {open ? (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="email, +91 phone, or uid"
              className="h-9"
              onKeyDown={(e) => { if (e.key === "Enter") void find(); }}
            />
            <Button size="sm" onClick={find} disabled={busy || !query.trim()}>Find</Button>
          </div>
          {user ? (
            <div className="flex flex-col gap-2">
              <div className="text-muted-foreground">
                {user.displayName || "(no name)"} · {user.email || user.phoneNumber || user.uid} · {user.providers.join(", ") || "anonymous"}
                {user.pinnedAgent ? ` · pinned: ${user.pinnedAgent.agent_id} (${user.pinnedAgent.mode})` : " · nothing pinned"}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="h-9 rounded-md border bg-background px-2">
                  <option value="">— agent —</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name || a.id}</option>
                  ))}
                </select>
                <select value={mode} onChange={(e) => setMode(e.target.value as "default" | "locked")} className="h-9 rounded-md border bg-background px-2">
                  <option value="default">default (preselected, picker stays)</option>
                  <option value="locked">locked (picker hidden)</option>
                </select>
                <Button size="sm" onClick={pin} disabled={busy || !agentId}>Pin</Button>
                {user.pinnedAgent ? <Button size="sm" variant="outline" onClick={unpin} disabled={busy}>Unpin</Button> : null}
              </div>
            </div>
          ) : null}
          {note ? <div className="text-xs text-muted-foreground">{note}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
