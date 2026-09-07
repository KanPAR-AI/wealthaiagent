// This app's capabilities for `@wealthai/chat-native` — the astro pattern
// (its chat-host.ts states the ruling: the chat page IS the yourfinadvisor
// chat, with routing off and the agent pinned).
//
// `routing: false` + `pinnedAgent` means every turn carries
// `force_agent=knee_arthritis`: no agent picker, no model picker, and no way
// to route a turn elsewhere even if somebody added one.
//
// `upload` is wired so the coach composer shows the attach button and a user
// can send an X-ray for KL-grading (capabilities.ts `xrayUpload: true`). The
// path is the SHARED one — `uploadFileNative` (expo-file-system multipart), the
// same call apps/mobile uses — not a per-app reimplementation. It pulls in
// expo-image-picker (a native module) + the photo-library permission declared
// in app.json, so it ships only on a NATIVE BUILD (runtimeVersion bumped to
// 1.1.0 in the same change, per the app's CLAUDE.md rule) — never an OTA to an
// older binary. Still no `transcribe`: no mic path, so no dead mic affordance.

import { installChatHost, uploadFileNative } from '@wealthai/chat-native';

import { getToken } from './auth';
import { ensureCoreInitialized } from './core-adapter';
import { PINNED_AGENT } from './env';

export function ensureChatHostInstalled(): void {
  ensureCoreInitialized();
  installChatHost({
    getToken,
    routing: false,
    pinnedAgent: PINNED_AGENT,
    upload: (token, asset, onProgress) => uploadFileNative(token, asset, onProgress),
    // No analytics package in this build; the funnel counter is a no-op so
    // the shared surface's contract is satisfied without inventing events.
    track: () => {},
  });
}
