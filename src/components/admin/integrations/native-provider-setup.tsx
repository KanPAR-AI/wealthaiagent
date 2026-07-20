// Native-provider setup — the connect/test flow for ANY native transport,
// surfaced inside the Tool Integrator when a builder picks a native provider
// for a tool. Driven entirely by the provider's declaration (services/
// integrations/providers.py): config_fields render as inputs, setup:"qr"
// shows the QR pairing + a read/send tester. WhatsApp is just the first
// provider to use this — nothing here is WhatsApp-specific.

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, LogOut, RefreshCw, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  NativeProvider, callProviderMethod, getProviderConfig, saveProviderConfig,
} from "@/services/integrations-native-service";

interface Status {
  state: string;
  qr_available?: boolean;
  me?: { name?: string; number?: string } | null;
  send_delay_ms?: number;
}

const STATE_HELP: Record<string, string> = {
  initializing: "Starting the connection…",
  qr_ready: "Waiting for you to scan the QR",
  authenticated: "Scanned — loading…",
  ready: "Connected",
  disconnected: "Not connected",
};

export function NativeProviderSetup({ provider }: { provider: NativeProvider }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [down, setDown] = useState<string | null>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [savingCfg, setSavingCfg] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isQr = provider.setup === "qr";

  const poll = useCallback(async () => {
    if (!isQr) return;
    try {
      const s = await callProviderMethod(provider.id, "status");
      setStatus(s); setDown(null);
      if (s.state === "qr_ready") {
        try { setQr((await callProviderMethod(provider.id, "qr")).qr_data_url); } catch { /* race */ }
      } else setQr(null);
    } catch (e: any) { setDown(e.message); }
  }, [provider.id, isQr]);

  useEffect(() => {
    getProviderConfig(provider.id).then((d) => setConfig(d.config || {})).catch(() => {});
    poll();
    if (isQr) { timer.current = setInterval(poll, 2500); }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [provider.id, isQr, poll]);

  const ready = status?.state === "ready";

  return (
    <div className="border border-border rounded-lg p-3 mt-2 bg-muted/20 space-y-3">
      <p className="text-xs text-muted-foreground">{provider.blurb}</p>

      {/* Per-org connection config (bridge URL etc.) */}
      {provider.config_fields.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            Connection settings (per organization)
          </summary>
          <div className="mt-2 space-y-2">
            {provider.config_fields.map((f) => (
              <div key={f.key} className="flex items-center gap-2">
                <label className="w-28 shrink-0 text-muted-foreground">{f.label}</label>
                <input
                  type={f.secret ? "password" : "text"}
                  value={config[f.key] || ""}
                  placeholder={f.secret ? "••••" : ""}
                  onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1 font-mono" />
              </div>
            ))}
            <Button size="sm" variant="outline" disabled={savingCfg}
                    onClick={async () => {
                      setSavingCfg(true);
                      try { await saveProviderConfig(provider.id, config); poll(); }
                      finally { setSavingCfg(false); }
                    }}>
              {savingCfg ? <Loader2 size={13} className="mr-1 animate-spin" /> : null}
              Save connection settings
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Each organization points this provider at its own backend — that&apos;s the
              tenant isolation (e.g. its own WhatsApp bridge = its own paired session).
            </p>
          </div>
        </details>
      )}

      {down && (
        <div className="border border-amber-500/40 bg-amber-500/5 rounded-md p-2.5 text-xs">
          <p className="flex items-center gap-1.5 font-medium text-amber-700">
            <AlertTriangle size={13} /> Provider backend not reachable
          </p>
          <p className="text-muted-foreground mt-1">
            For the WhatsApp bridge: <span className="font-mono">cd whatsappbridge &amp;&amp; npm start</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">{down}</p>
        </div>
      )}

      {isQr && (
        <div>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${
              ready ? "bg-emerald-500" : status?.state === "disconnected"
                ? "bg-red-500" : "bg-amber-500 animate-pulse"}`} />
            <span className="text-sm font-medium">
              {status ? (STATE_HELP[status.state] || status.state) : "Checking…"}
            </span>
            {ready && status?.me && (
              <span className="text-xs text-muted-foreground">
                — {status.me.name} (+{status.me.number})
              </span>
            )}
            <Button size="sm" variant="ghost" className="ml-auto h-7 px-2" onClick={poll}>
              <RefreshCw size={13} />
            </Button>
          </div>

          {qr && (
            <div className="mt-3 flex flex-col items-center gap-2">
              <img src={qr} alt="Pairing QR" className="w-52 h-52 rounded-lg border border-border bg-white" />
              <ol className="text-xs text-muted-foreground list-decimal pl-5 space-y-0.5 self-start">
                <li>Open WhatsApp on your phone.</li>
                <li>Settings → Linked Devices → Link a Device.</li>
                <li>Point your phone at this QR (it refreshes automatically).</li>
              </ol>
            </div>
          )}

          {ready && (
            <div className="mt-2">
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <CheckCircle2 size={15} /> Connected.
                <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-destructive"
                        onClick={async () => { await callProviderMethod(provider.id, "logout").catch(() => {}); poll(); }}>
                  <LogOut size={13} className="mr-1" /> Unlink
                </Button>
              </div>
              <ProviderTester providerId={provider.id} />
            </div>
          )}
        </div>
      )}
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

  useEffect(() => {
    callProviderMethod(providerId, "groups").then((d) => {
      setGroups(d.groups || []);
      if (d.groups?.[0]) setGroup(d.groups[0].name);
    }).catch((e) => setErr(e.message));
  }, [providerId]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setErr(null);
    try { await fn(); } catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  };

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <div>
        <label className="text-xs font-medium">Group</label>
        <select value={group} onChange={(e) => setGroup(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm">
          {groups.length === 0 && <option value="">No groups found</option>}
          {groups.map((g) => (
            <option key={g.id} value={g.name}>
              {g.name}{g.participants ? ` (${g.participants})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Button size="sm" variant="outline" disabled={!group || busy !== null}
                onClick={() => run("read", async () =>
                  setReadOut(await callProviderMethod(providerId, "read", { group, limit: 10 })))}>
          {busy === "read" ? <Loader2 size={14} className="mr-1 animate-spin" /> : null}
          Test read (last 10)
        </Button>
        {readOut && (
          <div className="mt-2 max-h-40 overflow-y-auto border border-border rounded-md divide-y divide-border text-xs">
            {(readOut.messages || []).map((m: any) => (
              <div key={m.id} className="px-2 py-1.5">
                <span className="text-muted-foreground">{m.from_me ? "you" : (m.from || "?").split("@")[0]}: </span>
                {m.body || <em className="text-muted-foreground">({m.type})</em>}
              </div>
            ))}
            {(readOut.messages || []).length === 0 && (
              <p className="px-2 py-2 text-muted-foreground">No messages returned.</p>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-medium">Test message</label>
        <div className="mt-1 flex gap-2">
          <input value={message} onChange={(e) => setMessage(e.target.value)}
                 className="flex-1 rounded-md border border-border bg-background p-2 text-sm" />
          <Button size="sm" disabled={!group || !message || busy !== null}
                  onClick={() => run("send", async () => {
                    const r = await callProviderMethod(providerId, "send", { group, message });
                    setSendOut(`Sent after ${Math.round((r.delay_ms || 0) / 1000)}s to ${r.group}.`);
                  })}>
            {busy === "send" ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Send size={14} className="mr-1" />}
            Send (delayed)
          </Button>
        </div>
        {sendOut && <p className="mt-1.5 text-xs text-emerald-600">{sendOut}</p>}
        <p className="mt-1 text-[11px] text-muted-foreground">Sends wait ~5s + jitter to look human.</p>
      </div>

      {err && <p className="text-sm text-destructive whitespace-pre-wrap">{err}</p>}
    </div>
  );
}
