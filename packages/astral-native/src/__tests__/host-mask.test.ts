/**
 * The JOIN between a host's lock and what a block draws (Role-3's measured
 * gap: an always-false read in `astral-block.tsx` left the whole suite
 * green, because that module imports React Native and no jest project here
 * can mount it).
 *
 * The two reads now live in `host.ts`, which imports nothing but React's
 * types — so these cases drive the real functions the block dispatcher
 * calls, and the dispatcher is pinned to call them by the source assertions
 * at the bottom.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  hostMaskBirth,
  hostMaskRequest,
  installAstralHost,
  resetAstralHost,
} from '../host';

const BASE = {
  getToken: async () => null,
  send: () => undefined,
};

afterEach(() => resetAstralHost());

describe('a host that locks birth details', () => {
  it('asks at PAINT time, so an expiry between two cards is seen', () => {
    let locked = true;
    installAstralHost({ ...BASE, maskBirthDetails: () => locked });
    expect(hostMaskBirth()).toBe(true);
    locked = false;
    expect(hostMaskBirth()).toBe(false);
  });

  it('transforms a request through the host, which owns the key list', () => {
    installAstralHost({
      ...BASE,
      maskInputRequest: ((r: { fields: Array<{ key: string; value?: unknown }> }) => ({
        ...r,
        fields: r.fields.map(({ value: _drop, ...rest }) => rest),
      })) as <T>(r: T) => T,
    });
    const request = { fields: [{ key: 'tob', value: '15:20' }] };
    const masked = hostMaskRequest(request);
    expect(JSON.stringify(masked)).not.toContain('15:20');
    expect(masked.fields[0].key).toBe('tob');
  });
});

describe('a host that does not — and no host at all', () => {
  it('draws today’s card when the hooks are absent', () => {
    installAstralHost({ ...BASE });
    expect(hostMaskBirth()).toBe(false);
    const request = { fields: [{ key: 'tob', value: '15:20' }] };
    expect(hostMaskRequest(request)).toBe(request);
  });

  it('never throws when nothing is installed — a card must still draw', () => {
    expect(hostMaskBirth()).toBe(false);
    const request = { fields: [{ key: 'tob', value: '15:20' }] };
    expect(hostMaskRequest(request)).toBe(request);
  });
});

describe('the block dispatcher calls them rather than deciding', () => {
  const SRC = readFileSync(join(__dirname, '..', 'astral-block.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('passes the host’s answers into every block it renders', () => {
    expect(SRC).toContain('maskBirth: hostMaskBirth()');
    expect(SRC).toContain('maskRequest: hostMaskRequest');
    // …and no second copy of the decision anywhere in the dispatcher
    expect(SRC).not.toContain('maskBirthDetails?.()');
  });

  it('hands the natal card the flag and the form the transform', () => {
    expect(SRC).toMatch(/natal_chart:[\s\S]{0,400}maskBirth=\{maskBirth\}/);
    expect(SRC).toMatch(/input_request:[\s\S]{0,600}maskRequest\s*\?\s*maskRequest\(parsed\)\s*:\s*parsed/);
  });
});
