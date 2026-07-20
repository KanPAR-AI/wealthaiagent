// services/integrations-native-service.ts — native provider setup/testing API
// (chatservice api/v1/endpoints/integrations_native.py). Generic across every
// native provider; the provider id (e.g. "whatsapp_web") is a path param.

import { getApiUrl } from "@/config/environment";
import { auth } from "@/config/firebase";

async function niFetch(endpoint: string, options: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(getApiUrl(`/admin/integrations${endpoint}`), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({ detail: res.statusText }));
  if (!res.ok) throw new Error(body.detail || `Integrations API error: ${res.status}`);
  return body;
}

export interface NativeProvider {
  id: string;
  label: string;
  blurb: string;
  tools: string[];
  setup: "qr" | "token" | "none";
  config_fields: { key: string; label: string; secret: boolean }[];
}

export const listNativeProviders = (): Promise<{ providers: NativeProvider[] }> =>
  niFetch(`/providers`);

export const getProviderConfig = (id: string): Promise<{ provider: string; config: Record<string, string> }> =>
  niFetch(`/providers/${id}/config`);

export const saveProviderConfig = (id: string, config: Record<string, string>) =>
  niFetch(`/providers/${id}/config`, { method: "PUT", body: JSON.stringify({ config }) });

// Generic setup/testing method call: status | qr | groups | read | send | logout
export const callProviderMethod = (id: string, method: string, params?: Record<string, any>) =>
  niFetch(`/providers/${id}/${method}`, {
    method: "POST",
    body: JSON.stringify({ params: params ?? null }),
  });
