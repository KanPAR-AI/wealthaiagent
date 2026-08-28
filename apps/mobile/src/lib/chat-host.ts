// This app's capabilities for `@wealthai/chat-native` (docs/49 ASTRAL-105).
//
// The message lifecycle, the transcript and the composer are SHARED with
// `apps/astro` now — the owner's ruling is that the two chat pages are one
// surface, differing only in brand tokens, the widget set, and whether the
// router runs. What differs per app is exactly what is below.
//
// The lifecycle used to import `getToken` from `@/lib/auth` directly, which
// is what pinned it here: `@/*` maps to `./src/*` in the second app too, so
// the specifier would have RESOLVED there — to a different module — rather
// than failing (docs/49 F22). It is injected now.

import { installChatHost, uploadFileNative } from '@wealthai/chat-native';

import { getToken } from './auth';
import { transcribeAudioFile } from './voice';

export function ensureChatHostInstalled(): void {
  installChatHost({
    // `Promise<string | null>` — the null case travels rather than being
    // cast away, and the lifecycle refuses to send without a token.
    getToken,

    // THE ROUTER RUNS HERE. This is the general-purpose app: sixteen agents,
    // smart routing, an agent picker and a model-tier picker. `apps/astro` is
    // the opposite (routing: false, pinned) — see docs/49 D3.
    routing: true,

    upload: (token, asset, onProgress) => uploadFileNative(token, asset, onProgress),
    transcribe: (token, uri) => transcribeAudioFile(token, uri),

    // No `track`. Stated rather than omitted: this app counts its own events
    // in its screens and has never counted §12's reading funnel, so the move
    // gives it no new events and its GA4 stream is unchanged.
  });
}
