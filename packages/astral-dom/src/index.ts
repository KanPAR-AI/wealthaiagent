/**
 * @wealthai/astral-dom — the React-DOM binding for `@wealthai/astral`
 * (docs/73 ASTRAL-321, from F153).
 *
 * `packages/astral` is platform-neutral source that must not import DOM or
 * React Native APIs. This package is its DOM host binding: the primitives
 * adapter and the block dispatcher, in a PACKAGE rather than inside the web
 * app, so the web chat and the AstroMatch extension's 380 px side panel
 * render one wheel, one scorecard and one input widget between them.
 *
 * Install the host's capabilities once at app start — see `host.ts` for why
 * the seam is an init function rather than a context, and for why this
 * package performs no network of its own.
 */

export { AstralBlock } from './astral-block';
export { Narration, resetNarrationWarnings } from './narration';
export type { NarrationProps } from './narration';
export { domPrimitives } from './dom-primitives';
export {
  getAstralDomHost,
  installAstralDomHost,
  isAstralDomHostInstalled,
  resetAstralDomHost,
} from './host';
export type { AstralDomHost, AstralDomUploadResult } from './host';
