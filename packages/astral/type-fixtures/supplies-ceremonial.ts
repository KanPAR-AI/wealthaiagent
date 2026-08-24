/** The control for `omits-ceremonial.ts`: the same host WITH the token, which
 *  must compile clean. Without this pair, "it failed to compile" would prove
 *  nothing about which error it failed on. */
import type { AstralTheme } from '../src/primitives';

export const hostThatChose: AstralTheme = {
  text: '#1a1523',
  textMuted: '#6b6577',
  textPending: '#8a8494',
  line: '#3b3548',
  surface: '#ffffff',
  surfaceAlt: '#f5f3f8',
  accent: '#5a378e',
  ceremonial: '#c9a227',
  warn: '#b45309',
  border: '#e3dfea',
};
