// This app's capabilities for `@wealthai/astral-native` (docs/49 ASTRAL-99).
//
// The React Native binding — the wheel, the scorecard, the muhurta windows
// and the input widget — is shared with `apps/mobile`. What differs per app
// is only what is below: how to get a token, how to upload a file, and how a
// composed message becomes a turn. The binding used to import those from
// `@/lib/*`, which is exactly why it could not be shared: `@/*` maps to
// `./src/*` in both apps, so the specifier would have resolved here to
// DIFFERENT modules rather than failing (docs/49 F22).

import { installAstralHost } from '@wealthai/astral-native';
import { CHAT_SEND_EVENT } from '@wealthai/chat-native';
import { getPlatform } from '@wealthai/core';

import { tokens } from '@/theme';

import { getToken } from './auth';
import { ensureCoreInitialized } from './core-adapter';

export function ensureAstralHostInstalled(): void {
  ensureCoreInitialized();
  installAstralHost({
    // `Promise<string>` here against the contract's `Promise<string | null>`.
    // Assignable, so no cast — and no null case invented for an app that is
    // anonymous-first and always has a token.
    getToken,

    // No `upload`. Stated rather than omitted: this app has no native
    // multipart upload path yet — `apps/mobile/src/lib/upload.ts` is the one
    // that exists, and moving it into a package is ASTRAL-110's job. Until
    // then the photo slot REFUSES VISIBLY here instead of looking like it
    // worked, which is the failure the role-labelled slot exists to prevent.

    // ONE channel, shared with apps/mobile (`CHAT_SEND_EVENT`). It used to
    // be this app's own name for the same hop, which is how a widget works on
    // one surface and quietly does nothing on the other.
    send: (text) => getPlatform().events.emit(CHAT_SEND_EVENT, { text }),

    // Brand copy for the widget's field hints (docs/49 ASTRAL-104). Keyed by
    // the engine's field `kind`, so one token covers every place field the
    // engine can ask for — in chat and on screen 2 alike — and neither the
    // shared component nor the shared binding carries a market's postal
    // conventions.
    fieldHints: { place: tokens.copy.fieldHints.placeBirthHint },
  });
}
