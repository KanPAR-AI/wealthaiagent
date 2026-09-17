// Very basic engagement telemetry (owner-asked: "not much"). One fire-and-
// forget event per meaningful moment → POST /knee/event. It NEVER throws and
// NEVER blocks a screen: a dropped event is fine, a broken telemetry call that
// interrupted a workout would not be. Keep the event vocabulary small and
// stable so the funnels stay legible.

import { fetch as expoFetch } from 'expo/fetch';
import { Platform } from 'react-native';
import * as Updates from 'expo-updates';

import { getToken } from './auth';
import { apiUrl } from './core-adapter';

/** The events we track — a closed set so a typo can't fragment a funnel. */
export type KneeEvent =
  | 'app_open'
  | 'coach_open'
  | 'phase_open'
  | 'find_phase_result'
  | 'session_start'
  | 'session_complete'
  | 'session_saved_partial'
  | 'session_discarded'
  | 'nudge_link_shown'
  | 'nudge_link_tapped'
  | 'video_error';

export function track(event: KneeEvent, meta: Record<string, unknown> = {}): void {
  void (async () => {
    try {
      const token = await getToken();
      await expoFetch(apiUrl('/knee/event'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        // Platform + runtime version ride every event (owner ask 2026-09-17:
        // events carried no platform/app-version, so funnels couldn't be split
        // by build). Caller meta wins on a key collision. Updates.runtimeVersion
        // is what the installed binary truly runs — expo-updates is this app's
        // live update mechanism (_layout.tsx), so its constant is the version
        // OTA targeting actually uses; it is null only in dev, named honestly.
        //
        // ⚠ CAP: the server keeps only the FIRST 10 meta keys
        // (knee_program.py: `items()[:10]`, values truncated to 120 chars).
        // platform/rt sit in slots 1–2, so a caller gets 8 keys — pass more
        // and the tail is silently dropped. Current callers max at 6.
        body: JSON.stringify({
          event,
          meta: { platform: Platform.OS, rt: Updates.runtimeVersion ?? 'dev', ...meta },
        }),
      });
    } catch {
      // best-effort — telemetry must never surface to the user
    }
  })();
}
