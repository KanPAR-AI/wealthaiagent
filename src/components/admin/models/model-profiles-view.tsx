// Model Gateway admin — the task→model map. See which model runs each task and
// hot-swap it (e.g. point "loops.compile" at a newly-released model) with no
// redeploy. Backed by chatservice /admin/model-profiles.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Save, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ModelProfile, listModelProfiles, reloadModelProfiles, saveModelProfile,
} from "@/services/model-profiles-service";

const KIND_COLORS: Record<string, string> = {
  text: "bg-zinc-500/15 text-zinc-500",
  json: "bg-blue-500/15 text-blue-600",
  vision: "bg-violet-500/15 text-violet-600",
  audio: "bg-amber-500/15 text-amber-600",
  embedding: "bg-emerald-500/15 text-emerald-600",
  stream: "bg-cyan-500/15 text-cyan-600",
};

function KindBadge({ kind }: { kind: string }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${KIND_COLORS[kind] || "bg-zinc-500/15"}`}>
      {kind}
    </span>
  );
}

export function ModelProfilesView() {
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [knownModels, setKnownModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listModelProfiles()
      .then((d) => { setProfiles(d.profiles); setKnownModels(d.known_models || []); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Group by the task_key prefix (before the first dot) for readability.
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = profiles.filter((p) =>
      !needle || p.task_key.toLowerCase().includes(needle) ||
      p.primary.toLowerCase().includes(needle) || p.description.toLowerCase().includes(needle));
    const g: Record<string, ModelProfile[]> = {};
    for (const p of filtered) {
      const key = p.task_key.split(".")[0];
      (g[key] ||= []).push(p);
    }
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [profiles, q]);

  const overrides = profiles.filter((p) => p.is_override).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Models</h2>
          <p className="text-sm text-muted-foreground">
            Which model runs each task. Edit a row to hot-swap it — no redeploy.
            {" "}
            <span className="text-foreground font-medium">{profiles.length}</span> tasks
            {overrides > 0 && <> · <span className="text-amber-600 font-medium">{overrides} overridden</span></>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      <div className="relative mb-3">
        <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by task, model, or description…"
          className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-destructive mb-3">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div className="space-y-4">
        {groups.map(([group, rows]) => (
          <div key={group}>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">{group}</p>
            <div className="border border-border rounded-lg divide-y divide-border">
              {rows.map((p) => (
                <ProfileRow
                  key={p.task_key}
                  profile={p}
                  knownModels={knownModels}
                  isEditing={editing === p.task_key}
                  onEdit={() => setEditing(p.task_key)}
                  onCancel={() => setEditing(null)}
                  onSaved={(updated) => {
                    setProfiles((prev) => prev.map((x) => x.task_key === updated.task_key
                      ? { ...updated, is_override: true } : x));
                    setEditing(null);
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileRow({
  profile, knownModels, isEditing, onEdit, onCancel, onSaved,
}: {
  profile: ModelProfile;
  knownModels: string[];
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: (p: ModelProfile) => void;
}) {
  const [primary, setPrimary] = useState(profile.primary);
  const [temperature, setTemperature] = useState(String(profile.temperature));
  const [maxTokens, setMaxTokens] = useState(String(profile.max_tokens));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Options = known models + the current one (so a bespoke model stays selectable).
  const options = useMemo(() => {
    const s = new Set([profile.primary, ...knownModels]);
    return Array.from(s);
  }, [knownModels, profile.primary]);

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const updated = await saveModelProfile(profile.task_key, {
        primary,
        temperature: Number(temperature),
        max_tokens: Number(maxTokens),
      });
      onSaved(updated);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!isEditing) {
    return (
      <button onClick={onEdit} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 text-left">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-medium truncate">{profile.task_key}</span>
            <KindBadge kind={profile.kind} />
            {profile.is_override && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-600">override</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate">{profile.description}</div>
        </div>
        <span className="font-mono text-xs text-foreground shrink-0">{profile.primary}</span>
      </button>
    );
  }

  return (
    <div className="px-4 py-3 bg-muted/30">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-xs font-medium">{profile.task_key}</span>
        <KindBadge kind={profile.kind} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
        <label className="text-xs">
          <span className="text-muted-foreground">Model</span>
          <select
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
            className="w-full mt-0.5 rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono"
          >
            {options.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="text-xs">
          <span className="text-muted-foreground">Temp</span>
          <input
            type="number" step="0.1" min="0" max="2" value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            className="w-20 mt-0.5 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="text-muted-foreground">Max tokens</span>
          <input
            type="number" min="1" value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value)}
            className="w-28 mt-0.5 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      {err && <p className="text-xs text-destructive mt-2">{err}</p>}
      <div className="flex gap-2 mt-2">
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Save size={14} className="mr-1" />}
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </div>
  );
}
