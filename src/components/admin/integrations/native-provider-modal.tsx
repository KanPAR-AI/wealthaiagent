// Guided native-provider connection — a card + popup that replaces the
// error-prone "type a tool id, pick a transport" flow for native providers.
//
// Card: shows the provider (e.g. WhatsApp), its live connection status, and how
// many of its tools are wired. Button opens a modal that walks the whole thing:
// pair by QR → one click maps ALL the provider's tools → test read/send →
// unlink. Nothing is typed; there's nothing to get wrong.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2, Link2, Loader2, LogOut, MessageSquare, RefreshCw, Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { setIntegration } from "@/services/loops-service";
import {
  NativeProvider, callProviderMethod, getProviderConfig, saveProviderConfig,
} from "@/services/integrations-native-service";

const STATE_HELP: Record<string, string> = {
  initializing: "Starting the connection…",
  qr_ready: "Scan the QR to connect",
  authenticated: "Scanned — loading…",
  ready: "Connected",
  disconnected: "Not connected",
};

interface Status {
  state: string;
  me?: { name?: string; number?: string } | null;
  send_delay_ms?: number;
}

/** Card + modal. `mappedTools` = the provider tool ids already mapped. */
export function NativeProviderConnect({
  provider, mappedTools, onChanged,
}: {
  provider: NativeProvider;
  mappedTools: string[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  // Light one-shot status for the card (the modal does the live polling).
  const refreshCard = useCallback(() => {
    callProviderMethod(provider.id, "status").then(setStatus).catch(() => setStatus(null));
  }, [provider.id]);
  useEffect(() => { refreshCard(); }, [refreshCard]);

  const connected = status?.state === "ready";
  const mappedCount = provider.tools.filter((t) => mappedTools.includes(t)).length;

  return (
    <div className="border border-border rounded-lg p-3 bg-background flex items-center gap-3">
      <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
        <MessageSquare size={17} className="text-emerald-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{provider.label}</p>
        <p className="text-xs text-muted-foreground truncate">
          <span className={`inline-block h-2 w-2 rounded-full mr-1 align-middle ${
            connected ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
          {connected
            ? <>Connected{status?.me?.number ? ` · +${status.me.number}` : ""} · {mappedCount}/{provider.tools.length} tools wired</>
            : "Not connected"}
        </p>
      </div>
      <Button size="sm" variant={connected ? "outline" : "default"}
              onClick={() => setOpen(true)}>
        {connected ? "Manage" : <><Link2 size={14} className="mr-1" /> Connect</>}
      </Button>

      <NativeProviderModal
        provider={provider} open={open}
        mappedTools={mappedTools}
        onOpenChange={(v) => { setOpen(v); if (!v) { refreshCard(); onChanged(); } }}
        onChanged={onChanged}
      />
    </div>
  );
}

function NativeProviderModal({
  provider, open, onOpenChange, mappedTools, onChanged,
}: {
  provider: NativeProvider;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mappedTools: string[];
  onChanged: () => void;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [down, setDown] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const s = await callProviderMethod(provider.id, "status");
      setStatus(s); setDown(null);
      if (s.state === "qr_ready") {
        try { setQr((await callProviderMethod(provider.id, "qr")).qr_data_url); } catch { /* race */ }
      } else setQr(null);
    } catch (e: any) { setDown(e.message); }
  }, [provider.id]);

  useEffect(() => {
    if (!open) { if (timer.current) clearInterval(timer.current); return; }
    poll();
    timer.current = setInterval(poll, 2500);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [open, poll]);

  const ready = status?.state === "ready";
  const allMapped = provider.tools.every((t) => mappedTools.includes(t));

  const mapAll = async () => {
    setBusy("map");
    try {
      for (const t of provider.tools) await setIntegration(t, "", "", "", provider.id);
      onChanged();
    } finally { setBusy(null); }
  };

  const unlink = async () => {
    if (!confirm(`Unlink ${provider.label}? You'll need to scan the QR again to reconnect.`)) return;
    setBusy("unlink");
    try { await callProviderMethod(provider.id, "logout"); await poll(); }
    finally { setBusy(null); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare size={17} className="text-emerald-600" /> {provider.label}
          </DialogTitle>
          <DialogDescription>{provider.blurb}</DialogDescription>
        </DialogHeader>

        {down && (
          <div className="border border-amber-500/40 bg-amber-500/5 rounded-md p-2.5 text-xs">
            <p className="font-medium text-amber-700">Provider backend not reachable</p>
            <p className="text-muted-foreground mt-1">
              Start the bridge: <span className="font-mono">cd whatsappbridge &amp;&amp; npm start</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">{down}</p>
          </div>
        )}

        {/* Status line */}
        <div className="flex items-center gap-2 text-sm">
          <span className={`h-2.5 w-2.5 rounded-full ${
            ready ? "bg-emerald-500" : status?.state === "disconnected"
              ? "bg-red-500" : "bg-amber-500 animate-pulse"}`} />
          <span className="font-medium">
            {status ? (STATE_HELP[status.state] || status.state) : "Checking…"}
          </span>
          {ready && status?.me && (
            <span className="text-xs text-muted-foreground">— {status.me.name} (+{status.me.number})</span>
          )}
          <Button size="sm" variant="ghost" className="ml-auto h-7 px-2" onClick={poll}>
            <RefreshCw size={13} />
          </Button>
        </div>

        {/* Not connected → QR */}
        {!ready && qr && (
          <div className="flex flex-col items-center gap-2">
            <img src={qr} alt="Pairing QR" className="w-56 h-56 rounded-lg border border-border bg-white" />
            <ol className="text-xs text-muted-foreground list-decimal pl-5 space-y-0.5 self-start">
              <li>Open WhatsApp on your phone.</li>
              <li>Settings → Linked Devices → Link a Device.</li>
              <li>Point your phone at this QR (it refreshes automatically).</li>
            </ol>
          </div>
        )}

        {/* Connected → map tools + test + unlink */}
        {ready && (
          <div className="space-y-3">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs font-medium mb-1.5">Use {provider.label} for these tools</p>
              <div className="space-y-1 mb-2">
                {provider.tools.map((t) => (
                  <div key={t} className="flex items-center gap-2 text-xs">
                    {mappedTools.includes(t)
                      ? <CheckCircle2 size={13} className="text-emerald-600" />
                      : <span className="h-3 w-3 rounded-full border border-muted-foreground/40" />}
                    <span className="font-mono">{t}</span>
                    <span className="text-muted-foreground">
                      {mappedTools.includes(t) ? "wired" : "not wired"}
                    </span>
                  </div>
                ))}
              </div>
              {!allMapped && (
                <Button size="sm" disabled={busy !== null} onClick={mapAll}>
                  {busy === "map" ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Link2 size={14} className="mr-1" />}
                  Wire {provider.label} to these tools
                </Button>
              )}
              {allMapped && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 size={13} /> All wired — procedures can use these tools.
                </p>
              )}
            </div>

            <ProviderTester providerId={provider.id} />

            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Connection settings (advanced)</summary>
              <ConnectionSettings provider={provider} onSaved={poll} />
            </details>

            <div className="flex">
              <Button size="sm" variant="ghost" className="text-destructive ml-auto"
                      disabled={busy !== null} onClick={unlink}>
                {busy === "unlink" ? <Loader2 size={14} className="mr-1 animate-spin" /> : <LogOut size={14} className="mr-1" />}
                Unlink {provider.label}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConnectionSettings({ provider, onSaved }: { provider: NativeProvider; onSaved: () => void }) {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    getProviderConfig(provider.id).then((d) => setConfig(d.config || {})).catch(() => {});
  }, [provider.id]);
  return (
    <div className="mt-2 space-y-2">
      {provider.config_fields.map((f) => (
        <div key={f.key} className="flex items-center gap-2">
          <label className="w-28 shrink-0 text-muted-foreground">{f.label}</label>
          <input type={f.secret ? "password" : "text"} value={config[f.key] || ""}
                 placeholder={f.secret ? "••••" : ""}
                 onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
                 className="flex-1 rounded-md border border-border bg-background px-2 py-1 font-mono" />
        </div>
      ))}
      <Button size="sm" variant="outline" disabled={saving}
              onClick={async () => { setSaving(true); try { await saveProviderConfig(provider.id, config); onSaved(); } finally { setSaving(false); } }}>
        {saving ? <Loader2 size={13} className="mr-1 animate-spin" /> : null} Save connection settings
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Leave blank to use the shared platform bridge. Set these only to point this
        organization at its own bridge instance.
      </p>
    </div>
  );
}

function ProviderTester({ providerId }: { providerId: string }) {
  const [groups, setGroups] = useState<{ id: string; name: string; participants: number | null }[]>([]);
  const [group, setGroup] = useState("");
  const [readOut, setReadOut] = useState<any>(null);
  const [message, setMessage] = useState("Test from Verified Procedures ✅");
  const [sendOut, setSendOut] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadGroups = useCallback(() => {
    callProviderMethod(providerId, "groups").then((d) => {
      setGroups(d.groups || []);
      if (d.groups?.[0]) setGroup(d.groups[0].name);
    }).catch((e) => setErr(e.message));
  }, [providerId]);
  useEffect(() => { loadGroups(); }, [loadGroups]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setErr(null);
    try { await fn(); } catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  };

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium">Test with a group</label>
        <Button size="sm" variant="ghost" className="ml-auto h-6 px-2 text-[11px]" onClick={loadGroups}>
          <RefreshCw size={11} className="mr-1" /> refresh
        </Button>
      </div>
      <select value={group} onChange={(e) => setGroup(e.target.value)}
              className="w-full rounded-md border border-border bg-background p-2 text-sm">
        {groups.length === 0 && <option value="">No groups found</option>}
        {groups.map((g) => (
          <option key={g.id} value={g.name}>{g.name}{g.participants ? ` (${g.participants})` : ""}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={!group || busy !== null}
                onClick={() => run("read", async () => setReadOut(await callProviderMethod(providerId, "read", { group, limit: 10 })))}>
          {busy === "read" ? <Loader2 size={13} className="mr-1 animate-spin" /> : null} Test read
        </Button>
      </div>
      {readOut && (
        <div className="max-h-32 overflow-y-auto border border-border rounded-md divide-y divide-border text-xs">
          {(readOut.messages || []).map((m: any) => (
            <div key={m.id} className="px-2 py-1">
              <span className="text-muted-foreground">{m.from_me ? "you" : (m.from || "?").split("@")[0]}: </span>
              {m.body || <em className="text-muted-foreground">({m.type})</em>}
            </div>
          ))}
          {(readOut.messages || []).length === 0 && <p className="px-2 py-1.5 text-muted-foreground">No messages.</p>}
        </div>
      )}
      <div className="flex gap-2">
        <input value={message} onChange={(e) => setMessage(e.target.value)}
               className="flex-1 rounded-md border border-border bg-background p-2 text-sm" />
        <Button size="sm" disabled={!group || !message || busy !== null}
                onClick={() => run("send", async () => {
                  const r = await callProviderMethod(providerId, "send", { group, message });
                  setSendOut(`Sent after ${Math.round((r.delay_ms || 0) / 1000)}s.`);
                })}>
          {busy === "send" ? <Loader2 size={13} className="mr-1 animate-spin" /> : <Send size={13} className="mr-1" />} Send
        </Button>
      </div>
      {sendOut && <p className="text-xs text-emerald-600">{sendOut}</p>}
      {err && <p className="text-xs text-destructive whitespace-pre-wrap">{err}</p>}
    </div>
  );
}
