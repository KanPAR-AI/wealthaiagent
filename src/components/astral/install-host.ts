/**
 * The web app's half of the DOM binding (docs/73 ASTRAL-321, from F153).
 *
 * `@wealthai/astral-dom` renders the wheel, the scorecard and the input
 * widget for BOTH DOM surfaces — this app and the AstroMatch extension's
 * 380 px side panel. The two things that are genuinely app-local live here
 * rather than inside the package:
 *
 *   - `send`   — the shipped `chat-quick-reply` CustomEvent that
 *                `chat-window.tsx` already listens for. The extension has no
 *                window event bus; it sends through its service worker.
 *   - `upload` — `/files/upload` with this app's API base and this app's
 *                token store. The extension may not fetch from its panel at
 *                all (docs/73 F154), so the package performs no network and
 *                asks the host for the result instead.
 *
 * Installed as a module side effect, imported by both shims next door, which
 * is the same "install once, at module load" moment both native apps use for
 * `installAstralHost` and `initCore`.
 */

import { installAstralDomHost } from '@wealthai/astral-dom';

import { getApiUrl } from '@/config/environment';
import { useAuthStore } from '@/store/auth';

installAstralDomHost({
  send: (text: string) => {
    window.dispatchEvent(new CustomEvent('chat-quick-reply', { detail: { text } }));
  },
  upload: async (file: File) => {
    // `dev_token` is this app's long-standing local convention and moved here
    // verbatim with the code — the package must not carry one app's dev
    // fallback.
    const token = useAuthStore.getState().idToken || 'dev_token';
    const form = new FormData();
    form.append('files', file, file.name);
    const res = await fetch(getApiUrl('/files/upload'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      body: form,
    });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    const body = await res.json();
    return { url: String(body?.files?.[0]?.url ?? '') };
  },
});
