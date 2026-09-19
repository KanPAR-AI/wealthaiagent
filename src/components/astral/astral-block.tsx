/**
 * MOVED (docs/73 ASTRAL-321). The dispatcher now lives in
 * `@wealthai/astral-dom`; see `dom-primitives.tsx` next door for why.
 *
 * Importing this module installs this app's host capabilities — the
 * `chat-quick-reply` send channel and the `/files/upload` path — which is
 * what `AstralBlock` reaches for when a user answers an ask.
 */

import '@/components/astral/install-host';

export { AstralBlock } from '@wealthai/astral-dom';
