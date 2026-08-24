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
import { getPlatform } from '@wealthai/core';

import { getToken } from './auth';
import { ensureCoreInitialized } from './core-adapter';

/** The channel a widget answer travels on inside this app. The analogue of
 *  mobile's shipped quick-reply event: the chat screen listens, and the
 *  message goes out through the one send path it already owns. */
export const WIDGET_ANSWER_EVENT = 'astral-widget-answer';

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

    send: (text) => getPlatform().events.emit(WIDGET_ANSWER_EVENT, { text }),
  });
}
