/**
 * @wealthai/astral-native — the React Native binding for `@wealthai/astral`
 * (docs/49 ASTRAL-99, from F22).
 *
 * `packages/astral` is platform-neutral source that must not import DOM or
 * React Native APIs. This package is its RN host binding: the primitives
 * adapter and the block dispatcher, in a PACKAGE rather than inside one app,
 * so `apps/mobile` and `apps/astro` render one wheel, one scorecard and one
 * input widget between them.
 *
 * Install the host's capabilities once at app start — see `host.ts` for why
 * the seam is an init function rather than a context, and for the `getToken`
 * type difference between the two apps, which is resolved here rather than
 * cast away.
 */

export { AstralBlock, astralBlockRegistry } from './astral-block';
export { rnPrimitives } from './rn-primitives';
export {
  getAstralHost,
  installAstralHost,
  isAstralHostInstalled,
  resetAstralHost,
} from './host';
export type { AstralHost, AstralUploadAsset, AstralUploadResult } from './host';
