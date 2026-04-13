import { getApiUrl } from "@/config/environment";
import { auth } from "@/config/firebase";

export interface TelegramStatus {
  linked: boolean;
  telegram_username?: string | null;
  telegram_chat_id?: number;
  current_agent?: string;
  linked_at?: number;
}

export interface TelegramLinkInit {
  bot_username: string;
  deep_link: string;
  token: string;
  expires_in_seconds: number;
}

async function tgFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(getApiUrl(`/telegram${endpoint}`), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body?.error?.message || body.detail || `Telegram API error: ${res.status}`);
  }
  return res.json();
}

export function getTelegramStatus() {
  return tgFetch<TelegramStatus>("/status");
}

export function initTelegramLink() {
  return tgFetch<TelegramLinkInit>("/link/init", { method: "POST" });
}

export function unlinkTelegram() {
  return tgFetch<{ ok: boolean; was_linked: boolean }>("/unlink", { method: "POST" });
}
