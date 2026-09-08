// Very basic engagement telemetry (owner-asked: "not much"). One fire-and-
// forget event per meaningful moment → POST /knee/event. It NEVER throws and
// NEVER blocks a screen: a dropped event is fine, a broken telemetry call that
// interrupted a workout would not be. Keep the event vocabulary small and
// stable so the funnels stay legible.

import { fetch as expoFetch } from 'expo/fetch';

import { getToken } from './auth';
import { apiUrl } from './core-adapter';

/** The events we track — a closed set so a typo can't fragment a funnel. */
export type KneeEvent =
  | 'app_open'
  | 'coach_open'
  | 'phase_open'
  | 'find_phase_result'
  | 'session_start';

export function track(event: KneeEvent, meta: Record<string, unknown> = {}): void {
  void (async () => {
    try {
      const token = await getToken();
      await expoFetch(apiUrl('/knee/event'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, meta }),
      });
    } catch {
      // best-effort — telemetry must never surface to the user
    }
  })();
}
