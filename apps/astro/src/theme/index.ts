/** Brand selection (AMB-20(a)): the app's own config names its brand, and
 *  the token module resolves it once. There is deliberately no runtime
 *  switch — a brand is an app identity, not a setting.
 */
import Constants from 'expo-constants';

import { BRANDS } from './brands';
import type { BrandId, BrandTokens } from './contract';

const declared = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.brand;
const brandId: BrandId = declared === 'jyotish' ? 'jyotish' : 'astro';

export const tokens: BrandTokens = BRANDS[brandId];
export type { BrandTokens } from './contract';
