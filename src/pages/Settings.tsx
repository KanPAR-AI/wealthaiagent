import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getTelegramStatus,
  initTelegramLink,
  unlinkTelegram,
  type TelegramLinkInit,
  type TelegramStatus,
} from "@/services/telegram-service";

export default function SettingsPage() {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [link, setLink] = useState<TelegramLinkInit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await getTelegramStatus());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  // Poll every 3s while a link is pending so UI flips to "Connected" automatically.
  useEffect(() => {
    if (!link || status?.linked) return;
    const id = setInterval(refreshStatus, 3000);
    return () => clearInterval(id);
  }, [link, status?.linked, refreshStatus]);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      setLink(await initTelegramLink());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect your Telegram account?")) return;
    setLoading(true);
    try {
      await unlinkTelegram();
      setLink(null);
      await refreshStatus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.deep_link);
    } catch {
      /* ignore — button still shows link on screen */
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Telegram</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.linked ? (
            <div className="space-y-3">
              <div className="text-sm">
                Connected
                {status.telegram_username ? (
                  <> as <span className="font-mono">@{status.telegram_username}</span></>
                ) : null}
                . Current agent:{" "}
                <span className="font-mono">{status.current_agent || "generic"}</span>.
              </div>
              <div className="text-sm text-muted-foreground">
                In Telegram, send <span className="font-mono">/agents</span> to switch, or just
                start chatting.
              </div>
              <Button variant="destructive" disabled={loading} onClick={handleDisconnect}>
                Disconnect
              </Button>
            </div>
          ) : link ? (
            <div className="space-y-4">
              <div className="text-sm">
                Open this link in Telegram, or scan the QR code from your phone. Tap{" "}
                <span className="font-mono">Start</span> inside Telegram to finish connecting.
              </div>

              <div className="flex flex-col items-center gap-3 p-4 bg-muted rounded-lg">
                <QRCodeSVG value={link.deep_link} size={220} includeMargin />
                <a
                  href={link.deep_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline break-all text-center"
                >
                  {link.deep_link}
                </a>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => window.open(link.deep_link, "_blank", "noopener,noreferrer")}
                >
                  Open in Telegram
                </Button>
                <Button variant="outline" onClick={copyLink}>
                  Copy link
                </Button>
              </div>

              <div className="text-xs text-muted-foreground">
                Link expires in {Math.round(link.expires_in_seconds / 60)} minutes. Waiting for
                you to tap <span className="font-mono">Start</span>…
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Connect your Telegram account to chat with your agents from Telegram.
              </div>
              <Button onClick={handleConnect} disabled={loading}>
                {loading ? "Generating link…" : "Connect Telegram"}
              </Button>
            </div>
          )}

          {error ? <div className="text-sm text-red-500">{error}</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}
