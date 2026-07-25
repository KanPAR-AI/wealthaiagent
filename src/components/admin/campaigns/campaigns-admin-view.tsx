// Admin → Campaigns: server-configured home suggestion tiles.
//
// Edit the tiles a new user sees on the chat empty state, run a seasonal
// campaign, or open one for testing (audience=test + tester emails) — all with
// NO app release. Highest-priority enabled + in-window + visible campaign wins;
// if none match, apps fall back to their bundled default tiles.
//
// Backed by chatservice /admin/home/campaigns/*.

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Trash2, X, GripVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Campaign, HomeTile,
  listCampaigns, saveCampaign, deleteCampaign, reloadCampaigns,
} from "@/services/home-service";

const AGENT_IDS = [
  "", "generic", "real_estate", "insurance", "financial", "mental_health",
  "dietician", "knee_arthritis", "astrology",
];

function blankFromTemplate(t: Campaign): Campaign {
  return { ...t, campaign_id: "", tiles: t.tiles.map((x) => ({ ...x })) };
}

export function CampaignsAdminView() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [template, setTemplate] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [idInput, setIdInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listCampaigns()
      .then((d) => { setCampaigns(d.campaigns); setTemplate(d.default_template); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const startNew = () => {
    if (!template) return;
    setEditing(blankFromTemplate(template));
    setIdInput("");
    setNotice(null);
  };
  const startEdit = (c: Campaign) => {
    setEditing({ ...c, tiles: c.tiles.map((t) => ({ ...t })), test_emails: [...(c.test_emails || [])] });
    setIdInput(c.campaign_id);
    setNotice(null);
  };

  const patch = (p: Partial<Campaign>) => setEditing((e) => (e ? { ...e, ...p } : e));
  const setTile = (i: number, t: Partial<HomeTile>) =>
    setEditing((e) => e ? { ...e, tiles: e.tiles.map((x, j) => (j === i ? { ...x, ...t } : x)) } : e);
  const addTile = () => setEditing((e) => e ? { ...e, tiles: [...e.tiles, { text: "", agent: null }] } : e);
  const removeTile = (i: number) =>
    setEditing((e) => e ? { ...e, tiles: e.tiles.filter((_, j) => j !== i) } : e);
  const moveTile = (i: number, dir: -1 | 1) =>
    setEditing((e) => {
      if (!e) return e;
      const j = i + dir;
      if (j < 0 || j >= e.tiles.length) return e;
      const tiles = [...e.tiles];
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
      return { ...e, tiles };
    });

  const save = async () => {
    if (!editing) return;
    const id = (idInput || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    if (!id) { setError("Give the campaign an id (e.g. newyear2026)."); return; }
    setSaving(true); setError(null);
    try {
      await saveCampaign(id, {
        name: editing.name,
        enabled: editing.enabled,
        priority: editing.priority,
        audience: editing.audience,
        test_emails: editing.test_emails,
        starts_at: editing.starts_at || null,
        ends_at: editing.ends_at || null,
        tiles: editing.tiles.filter((t) => t.text.trim()),
      });
      setNotice(`Saved "${id}". Apps pick it up within ~60s (or hit Reload).`);
      setEditing(null);
      load();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const remove = async (c: Campaign) => {
    if (!window.confirm(`Delete campaign "${c.campaign_id}"? This can't be undone.`)) return;
    try { await deleteCampaign(c.campaign_id); load(); } catch (e: any) { setError(e.message); }
  };

  const reload = async () => {
    try { const r = await reloadCampaigns(); setNotice(`Cache cleared (${r.cleared}). Live now.`); }
    catch (e: any) { setError(e.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Home tile campaigns</h2>
          <p className="text-sm text-muted-foreground">
            Server-configured suggestion tiles for the chat home screen — no app release needed.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reload} title="Clear the 60s cache so edits go live immediately">
            <RefreshCw size={14} /> Reload
          </Button>
          <Button size="sm" onClick={startNew} disabled={!template}>
            <Plus size={14} /> New campaign
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive mb-3">{error}</p>}
      {notice && <p className="text-sm text-green-600 mb-3">{notice}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="animate-spin" size={16} /> Loading…</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* List */}
          <div className="space-y-2">
            {campaigns.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No campaigns yet — apps show the bundled default tiles. Click “New campaign” to override them.
              </p>
            )}
            {campaigns
              .slice()
              .sort((a, b) => b.priority - a.priority)
              .map((c) => (
                <div
                  key={c.campaign_id}
                  className={`rounded-lg border p-3 cursor-pointer hover:bg-muted/40 ${editing?.campaign_id === c.campaign_id ? "border-primary" : ""}`}
                  onClick={() => startEdit(c)}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{c.name} <span className="text-xs text-muted-foreground">({c.campaign_id})</span></div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.enabled ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground"}`}>
                        {c.enabled ? "live" : "off"}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.audience === "test" ? "bg-amber-500/15 text-amber-600" : "bg-blue-500/15 text-blue-600"}`}>
                        {c.audience === "test" ? "testing" : "everyone"}
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); remove(c); }} className="text-muted-foreground hover:text-destructive">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    priority {c.priority} · {c.tiles.length} tile{c.tiles.length === 1 ? "" : "s"}
                    {c.audience === "test" && c.test_emails.length > 0 && ` · ${c.test_emails.length} tester(s)`}
                  </div>
                </div>
              ))}
          </div>

          {/* Editor */}
          {editing && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{idInput ? "Edit campaign" : "New campaign"}</h3>
                <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
              </div>

              <label className="block text-xs font-medium">Campaign id
                <input
                  className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm disabled:opacity-60"
                  value={idInput}
                  disabled={!!editing.campaign_id}
                  placeholder="e.g. newyear2026"
                  onChange={(e) => setIdInput(e.target.value)}
                />
              </label>
              <label className="block text-xs font-medium">Name
                <input className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm"
                  value={editing.name} onChange={(e) => patch({ name: e.target.value })} />
              </label>

              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editing.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
                  Live
                </label>
                <label className="block text-xs font-medium">Priority
                  <input type="number" className="mt-1 w-20 rounded border bg-background px-2 py-1 text-sm"
                    value={editing.priority} onChange={(e) => patch({ priority: Number(e.target.value) || 0 })} />
                </label>
              </div>

              <label className="block text-xs font-medium">Audience
                <select className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm"
                  value={editing.audience} onChange={(e) => patch({ audience: e.target.value as "all" | "test" })}>
                  <option value="test">Testing — admins + tester emails only</option>
                  <option value="all">Everyone</option>
                </select>
              </label>

              {editing.audience === "test" && (
                <label className="block text-xs font-medium">Tester emails (comma-separated)
                  <input className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm"
                    value={editing.test_emails.join(", ")}
                    placeholder="friend@example.com, tester2@example.com"
                    onChange={(e) => patch({ test_emails: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                </label>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-medium">Starts (optional)
                  <input type="datetime-local" className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm"
                    value={toLocal(editing.starts_at)} onChange={(e) => patch({ starts_at: fromLocal(e.target.value) })} />
                </label>
                <label className="block text-xs font-medium">Ends (optional)
                  <input type="datetime-local" className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm"
                    value={toLocal(editing.ends_at)} onChange={(e) => patch({ ends_at: fromLocal(e.target.value) })} />
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">Tiles (shown top to bottom)</span>
                  <Button variant="outline" size="sm" onClick={addTile}><Plus size={12} /> Add</Button>
                </div>
                <div className="space-y-2">
                  {editing.tiles.map((t, i) => (
                    <div key={i} className="flex items-start gap-2 rounded border p-2">
                      <div className="flex flex-col pt-1 text-muted-foreground">
                        <button onClick={() => moveTile(i, -1)} disabled={i === 0} className="disabled:opacity-30 text-xs">▲</button>
                        <GripVertical size={12} />
                        <button onClick={() => moveTile(i, 1)} disabled={i === editing.tiles.length - 1} className="disabled:opacity-30 text-xs">▼</button>
                      </div>
                      <div className="flex-1 space-y-1">
                        <input className="w-full rounded border bg-background px-2 py-1 text-sm"
                          placeholder="Tile text (this is also the message that gets sent) — emojis welcome"
                          value={t.text} onChange={(e) => setTile(i, { text: e.target.value })} />
                        <select className="w-full rounded border bg-background px-2 py-1 text-xs text-muted-foreground"
                          value={t.agent || ""} onChange={(e) => setTile(i, { agent: e.target.value || null })}>
                          {AGENT_IDS.map((a) => (
                            <option key={a} value={a}>{a === "" ? "Smart routing (recommended)" : `Lock to: ${a}`}</option>
                          ))}
                        </select>
                      </div>
                      <button onClick={() => removeTile(i)} className="text-muted-foreground hover:text-destructive pt-1"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" size={14} /> : null} Save
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Tip: keep a campaign on <b>Testing</b> with your email in testers to preview it live, then switch to
                <b> Everyone</b> to launch. Highest <b>priority</b> live campaign wins.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// datetime-local <-> ISO helpers (the input has no timezone; treat as local).
function toLocal(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 16);
  } catch { return ""; }
}
function fromLocal(local: string): string | null {
  if (!local) return null;
  try { return new Date(local).toISOString(); } catch { return null; }
}
