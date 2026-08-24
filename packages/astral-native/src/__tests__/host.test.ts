/**
 * The host capability seam (docs/49 ASTRAL-99, from F22).
 *
 * These cover the part of the binding that can be tested from the root jest
 * project: `host.ts` imports nothing from `react-native`, deliberately, so
 * the seam that decides whether the binding is portable is under test even
 * though the components it feeds are not (see the note at the bottom).
 */

import {
  getAstralHost,
  installAstralHost,
  isAstralHostInstalled,
  resetAstralHost,
  type AstralHost,
} from '../host';

const noopHost: AstralHost = {
  getToken: async () => 'token',
  send: () => {},
};

describe('installAstralHost', () => {
  beforeEach(() => resetAstralHost());
  afterAll(() => resetAstralHost());

  it('starts uninstalled, so a test cannot pass on a neighbour’s host', () => {
    expect(isAstralHostInstalled()).toBe(false);
  });

  it('hands back exactly what the app installed', () => {
    installAstralHost(noopHost);
    expect(getAstralHost()).toBe(noopHost);
  });

  it('THROWS when nothing was installed, naming the fix', () => {
    // The alternative — a plausible default — would render a block whose
    // answer has nowhere to go, which is the dead card ASTRAL-91 exists to
    // prevent. Loud beats convenient here.
    expect(() => getAstralHost()).toThrow(/installAstralHost/);
    expect(() => getAstralHost()).toThrow(/ASTRAL-99/);
  });

  it('lets the last installer win, so a re-install is not a silent no-op', () => {
    const second: AstralHost = { getToken: async () => null, send: () => {} };
    installAstralHost(noopHost);
    installAstralHost(second);
    expect(getAstralHost()).toBe(second);
  });
});

describe('F22 — the getToken type seam, resolved rather than cast away', () => {
  beforeEach(() => resetAstralHost());
  afterAll(() => resetAstralHost());

  it('accepts mobile’s Promise<string | null> with its null case intact', async () => {
    // `apps/mobile/src/lib/auth.ts` — a signed-out user really does get null,
    // and the one consumer must be able to see it.
    const mobileGetToken: () => Promise<string | null> = async () => null;
    installAstralHost({ getToken: mobileGetToken, send: () => {} });
    await expect(getAstralHost().getToken()).resolves.toBeNull();
  });

  it('accepts astro’s narrower Promise<string> without a cast', async () => {
    // `apps/astro/src/lib/auth.ts` is anonymous-first and always resolves a
    // token. A function returning `Promise<string>` satisfies the wider
    // contract by assignability — this compiles, which IS the assertion, and
    // the runtime check below keeps it from being deleted as dead code.
    const astroGetToken: () => Promise<string> = async () => 'astro-token';
    installAstralHost({ getToken: astroGetToken, send: () => {} });
    await expect(getAstralHost().getToken()).resolves.toBe('astro-token');
  });
});

describe('the upload capability is optional, and its absence is a real state', () => {
  beforeEach(() => resetAstralHost());
  afterAll(() => resetAstralHost());

  it('a host may declare no upload', () => {
    // `apps/astro` has no native upload path yet. The photo slot refuses
    // VISIBLY in that case (rn-primitives.tsx) rather than looking the same
    // before and after a tap.
    installAstralHost({ getToken: async () => 'token', send: () => {} });
    expect(getAstralHost().upload).toBeUndefined();
  });

  it('a host that has one gets the token it was handed', async () => {
    const seen: string[] = [];
    installAstralHost({
      getToken: async () => 'token',
      upload: async (token) => {
        seen.push(token);
        return { url: 'https://example.test/api/v1/files/abc123/download' };
      },
      send: () => {},
    });
    const host = getAstralHost();
    const token = await host.getToken();
    await host.upload!(token!, { uri: 'file:///x.jpg', name: 'x.jpg', type: 'image/jpeg' });
    expect(seen).toEqual(['token']);
  });
});

describe('send is the one way an answer leaves a block', () => {
  beforeEach(() => resetAstralHost());
  afterAll(() => resetAstralHost());

  it('carries the message verbatim — the host does not reshape it', () => {
    // The carrier is built once, in `@wealthai/astral`. A host that edited
    // the string on its way out would be the F18 flatten-then-send pattern
    // wearing a different coat.
    const sent: string[] = [];
    installAstralHost({ getToken: async () => null, send: (t) => sent.push(t) });
    getAstralHost().send('Birth time: 11:45 pm\n\n```input_response\n{}\n```');
    expect(sent).toEqual(['Birth time: 11:45 pm\n\n```input_response\n{}\n```']);
  });
});

/**
 * NOT COVERED HERE, and stated rather than implied: `rn-primitives.tsx` and
 * `astral-block.tsx` have no render tests, because the root jest project runs
 * `testEnvironment: 'jsdom'` with no React Native preset — importing
 * `react-native` from a test fails outright (F21 #4). That is the same reason
 * `apps/mobile/src/components/astral/` shipped with zero tests. Closing it is
 * ASTRAL-101's job (a gate that can actually fail), not a thing to fake here
 * with a mock of the renderer under test.
 */
