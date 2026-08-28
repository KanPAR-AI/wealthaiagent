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
import { CHAT_SEND_EVENT, uploadFileNative } from '@wealthai/chat-native';
import { getPlatform } from '@wealthai/core';

import { FIELD_ICONS } from '@/components/field-icons';
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

    // The native multipart upload, ASTRAL-110's move having happened: it
    // used to live at `apps/mobile/src/lib/upload.ts` and this file used to
    // say so, with the honest consequence — "the photo slot REFUSES VISIBLY
    // here instead of looking like it worked". That refusal was correct, and
    // it was the one thing standing between this app and a palm reading,
    // which is two role-labelled photo slots and nothing else.
    //
    // MOVED, not copied. A second copy here would have COMPILED (`@/*` maps
    // to `./src/*` in both apps — F22) and drifted the first time somebody
    // fixed one of the three Expo-SDK-57 traps its header documents.
    upload: (token, asset) => uploadFileNative(token, asset),

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

    // …and the board's three row glyphs, keyed the same way. Supplied HERE
    // rather than by screen 2 alone, so the birth-time ask that arrives mid
    // chat draws the same field rows the full-screen form does.
    fieldIcons: FIELD_ICONS,
  });
}
