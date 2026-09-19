/**
 * The one place the build-time mode is read.
 *
 * `__ASTROMATCH_MODE__` is replaced by Vite at build time (see
 * `vite.config.ts`). A dev build talks to `http://localhost:8080` and says
 * "(dev)" in Chrome's own extension list; a production build talks to
 * `https://chatbackend.yourfinadvisor.com` and has ONE host permission.
 *
 * Declared here rather than sprinkled through the app so there is exactly one
 * answer to "which backend is this?" — the question docs/51 §3 exists about.
 */
import type { BuildMode } from './manifest';

declare const __ASTROMATCH_MODE__: BuildMode;

/** `production` under jest, where the define is absent — the safe default is
 *  the real backend's URL shape, and no test makes a network call. */
export const BUILD_MODE: BuildMode =
  typeof __ASTROMATCH_MODE__ === 'undefined' ? 'production' : __ASTROMATCH_MODE__;
