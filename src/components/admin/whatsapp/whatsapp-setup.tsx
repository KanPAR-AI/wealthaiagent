// WhatsApp setup — guided pairing + testing for the whatsapp-web.js bridge.
//
// The path a builder walks: start the bridge → scan the QR from their phone's
// Linked Devices → pick a group → test a read → test a delayed send → one
// click maps whatsapp_read_group / whatsapp_send_message in Integrations.
//
// TESTING uses a personal account (this bridge is the unofficial WhatsApp Web
// transport). For anything ongoing, pair a DEDICATED number — the page says so.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Loader2, LogOut, MessageSquare, RefreshCw,
  Send, Smartphone,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { JarvisChip } from "@/components/admin/jarvis/jarvis-panel";
import { setIntegration } from "@/services/loops-service";
import {
  getWhatsAppQr, getWhatsAppStatus, listWhatsAppGroups, logoutWhatsApp,
  readWhatsAppGroup, sendWhatsAppMessage,
  BridgeState, WhatsAppGroup, WhatsAppStatus,
} from "@/services/whatsapp-service";

// The bridge's /hook, reachable from the chatservice container.
const HOOK_URL = "http://host.docker.internal:3010/hook";
const BRIDGE_SECRET = "dev-bridge-secret";

const STATE_LABEL: Record<BridgeState, string> = {
  initializing: "Starting the bridge…",
  qr_ready: "Waiting for you to scan the QR",
  authenticated: "Scanned — loading your chats…",
  ready: "Connected",
  disconnected: "Not connected",
};

export function WhatsAppSetup() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [bridgeDown, setBridgeDown] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const s = await getWhatsAppStatus();
      setStatus(s);
      setBridgeDown(null);
      if (s.state === "qr_ready") {
        try { setQr((await getWhatsAppQr()).qr_data_url); } catch { /* race */ }
      } else {
        setQr(null);
      }
    } catch (e: any) {
      setBridgeDown(e.message);
    }
  }, []);

  useEffect(() => {
    poll();
    timer.current = setInterval(poll, 2500);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [poll]);

  const ready = status?.state === "ready";

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare size={18} className="text-emerald-600" />
        <h3 className="font-semibold">WhatsApp setup</h3>
        <JarvisChip
          question="How do I connect WhatsApp to read a group and send messages from a procedure?"
          context={{ page: "whatsapp", section: "ops", tab: "whatsapp" }}
        />
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Pair a WhatsApp account to let procedures read a group and send messages.
        This is the unofficial WhatsApp Web transport — great for testing on your
        personal number; use a <b>dedicated number</b> for anything ongoing (small
        ban risk on real accounts).
      </p>

      {bridgeDown && (
        <div className="mb-4 border border-amber-500/40 bg-amber-500/5 rounded-lg p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-amber-700">
            <AlertTriangle size={14} /> The bridge isn&apos;t running yet
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Start it once, then this page connects automatically:
          </p>
          <pre className="mt-2 text-[11px] bg-muted/40 border border-border rounded p-2 overflow-x-auto">cd whatsappbridge{"\n"}npm install   # first time only{"\n"}npm start</pre>
          <p className="text-[11px] text-muted-foreground mt-1.5">{bridgeDown}</p>
        </div>
      )}

      {/* Step 1 — connection state */}
      <div className="border border-border rounded-lg p-4 mb-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${
            ready ? "bg-emerald-500" : status?.state === "disconnected"
              ? "bg-red-500" : "bg-amber-500 animate-pulse"}`} />
          <span className="text-sm font-medium">
            {status ? STATE_LABEL[status.state] : "Checking…"}
          </span>
          {ready && status?.me && (
            <span className="text-xs text-muted-foreground">
              — {status.me.name} (+{status.me.number}), sends delayed ~{Math.round((status.send_delay_ms || 0) / 1000)}s
            </span>
          )}
          <Button size="sm" variant="ghost" className="ml-auto h-7 px-2" onClick={poll}>
            <RefreshCw size={13} />
          </Button>
        </div>

        {qr && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <img src={qr} alt="WhatsApp QR" className="w-56 h-56 rounded-lg border border-border bg-white" />
            <ol className="text-xs text-muted-foreground list-decimal pl-5 space-y-0.5 self-start">
              <li>Open WhatsApp on your phone.</li>
              <li>Tap <b>Settings → Linked Devices → Link a Device</b>.</li>
              <li>Point your phone at this QR. It refreshes on its own.</li>
            </ol>
          </div>
        )}

        {ready && (
          <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle2 size={15} /> Connected — test it below.
            <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-destructive"
                    onClick={async () => { await logoutWhatsApp().catch(() => {}); poll(); }}>
              <LogOut size={13} className="mr-1" /> Unlink
            </Button>
          </div>
        )}
      </div>

      {ready && <TestPanel />}
    </div>
  );
}

function TestPanel() {
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [group, setGroup] = useState("");
  const [readOut, setReadOut] = useState<any>(null);
  const [message, setMessage] = useState("Test from Verified Procedures ✅");
  const [sendOut, setSendOut] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mapped, setMapped] = useState(false);

  useEffect(() => {
    listWhatsAppGroups().then((d) => {
      setGroups(d.groups);
      if (d.groups[0]) setGroup(d.groups[0].name);
    }).catch((e) => setErr(e.message));
  }, []);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setErr(null);
    try { await fn(); } catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  };

  return (
    <div className="border border-border rounded-lg p-4 space-y-4">
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

      {/* Test read */}
      <div>
        <Button size="sm" variant="outline" disabled={!group || busy !== null}
                onClick={() => run("read", async () => setReadOut(await readWhatsAppGroup(group, 10)))}>
          {busy === "read" ? <Loader2 size={14} className="mr-1 animate-spin" /> : <MessageSquare size={14} className="mr-1" />}
          Test read (last 10)
        </Button>
        {readOut && (
          <div className="mt-2 max-h-48 overflow-y-auto border border-border rounded-md divide-y divide-border text-xs">
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

      {/* Test send */}
      <div>
        <label className="text-xs font-medium">Test message</label>
        <div className="mt-1 flex gap-2">
          <input value={message} onChange={(e) => setMessage(e.target.value)}
                 className="flex-1 rounded-md border border-border bg-background p-2 text-sm" />
          <Button size="sm" disabled={!group || !message || busy !== null}
                  onClick={() => run("send", async () => {
                    const r = await sendWhatsAppMessage(group, message);
                    setSendOut(`Sent after ${Math.round((r.delay_ms || 0) / 1000)}s delay to ${r.group}.`);
                  })}>
            {busy === "send" ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Send size={14} className="mr-1" />}
            Send (delayed)
          </Button>
        </div>
        {sendOut && <p className="mt-1.5 text-xs text-emerald-600">{sendOut}</p>}
        <p className="mt-1 text-[11px] text-muted-foreground">
          Sends wait ~5s + jitter on purpose, to look human.
        </p>
      </div>

      {/* One-click map into loops */}
      <div className="border-t border-border pt-3">
        <p className="text-xs text-muted-foreground mb-2">
          Once a test works, map these tool ids so procedures can use them:
          <span className="font-mono"> whatsapp_read_group</span>,
          <span className="font-mono"> whatsapp_send_message</span> → the bridge&apos;s hook.
        </p>
        <Button size="sm" variant="outline" disabled={busy !== null || mapped}
                onClick={() => run("map", async () => {
                  await setIntegration("whatsapp_read_group", HOOK_URL, BRIDGE_SECRET, "");
                  await setIntegration("whatsapp_send_message", HOOK_URL, BRIDGE_SECRET, "");
                  setMapped(true);
                })}>
          {busy === "map" ? <Loader2 size={14} className="mr-1 animate-spin" />
            : mapped ? <CheckCircle2 size={14} className="mr-1 text-emerald-600" />
            : <Smartphone size={14} className="mr-1" />}
          {mapped ? "Mapped — usable in procedures" : "Map both tools to this bridge"}
        </Button>
      </div>

      {err && <p className="text-sm text-destructive whitespace-pre-wrap">{err}</p>}
    </div>
  );
}
