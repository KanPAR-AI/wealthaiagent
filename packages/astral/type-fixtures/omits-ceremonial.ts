/**
 * NOT compiled by the package's own tsconfig (`include: ["src"]`) and not a
 * jest test — this file exists to FAIL type-checking.
 *
 * docs/49 ASTRAL-98: "the token is required, so a host that omits it fails to
 * compile; a test asserts that". `theme-contract.test.ts` compiles this file
 * with the package's own compiler options and asserts the error is real and
 * is about `ceremonial`. If the token ever becomes optional, this file starts
 * compiling and that test fails.
 */
import type { AstralTheme } from '../src/primitives';

export const hostThatForgot: AstralTheme = {
  text: '#1a1523',
  textMuted: '#6b6577',
  textPending: '#8a8494',
  line: '#3b3548',
  surface: '#ffffff',
  surfaceAlt: '#f5f3f8',
  accent: '#5a378e',
  warn: '#b45309',
  border: '#e3dfea',
};
