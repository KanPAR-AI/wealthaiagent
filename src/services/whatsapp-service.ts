// services/whatsapp-service.ts — WhatsApp bridge setup API client
// (chatservice api/v1/endpoints/whatsapp_bridge.py → whatsappbridge/)

import { getApiUrl } from "@/config/environment";
import { auth } from "@/config/firebase";

async function waFetch(endpoint: string, options: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(getApiUrl(`/admin/whatsapp${endpoint}`), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({ detail: res.statusText }));
  if (!res.ok) throw new Error(body.detail || `WhatsApp API error: ${res.status}`);
  return body;
}

export type BridgeState =
  | "initializing" | "qr_ready" | "authenticated" | "ready" | "disconnected";

export interface WhatsAppStatus {
  state: BridgeState;
  qr_available: boolean;
  me: { name?: string; number?: string } | null;
  send_delay_ms: number;
  last_error: string | null;
}

export interface WhatsAppGroup {
  id: string;
  name: string;
  participants: number | null;
}

export const getWhatsAppStatus = (): Promise<WhatsAppStatus> => waFetch(`/status`);

export const getWhatsAppQr = (): Promise<{ qr_data_url: string }> => waFetch(`/qr`);

export const listWhatsAppGroups = (): Promise<{ groups: WhatsAppGroup[] }> =>
  waFetch(`/groups`);

export const readWhatsAppGroup = (group: string, limit = 20): Promise<any> =>
  waFetch(`/read`, { method: "POST", body: JSON.stringify({ group, limit }) });

export const sendWhatsAppMessage = (
  group: string, message: string, delayMs?: number,
): Promise<any> =>
  waFetch(`/send`, {
    method: "POST",
    body: JSON.stringify({ group, message, delay_ms: delayMs }),
  });

export const logoutWhatsApp = (): Promise<any> =>
  waFetch(`/logout`, { method: "POST" });
