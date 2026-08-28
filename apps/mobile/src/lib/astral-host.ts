// This app's capabilities for `@wealthai/astral-native` (docs/49 ASTRAL-99).
//
// The binding used to import these three straight out of `@/lib/*`, which is
// what pinned it to this app: `@/*` maps to `./src/*` in the second app too,
// so the specifier would have RESOLVED there — to different modules — rather
// than failing (F22). They are injected now, and this file is the whole of
// what mobile has to say about it.

import { installAstralHost } from '@wealthai/astral-native';
import { uploadFileNative } from '@wealthai/chat-native';
import { getPlatform } from '@wealthai/core';

import { getToken } from './auth';
import { QUICK_REPLY_EVENT } from './events';

export function ensureAstralHostInstalled(): void {
  installAstralHost({
    // `Promise<string | null>` — the null case travels rather than being
    // cast away, and the photo slot refuses to upload without a token.
    getToken,
    upload: (token, asset) => uploadFileNative(token, asset),
    // The shipped quick-reply channel, which the chat screen already
    // listens on: no new send path is introduced (F18(a)).
    send: (text) => getPlatform().events.emit(QUICK_REPLY_EVENT, { text }),
  });
}
