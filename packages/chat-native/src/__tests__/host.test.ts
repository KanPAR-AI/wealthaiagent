/**
 * The host seam (docs/49 ASTRAL-105).
 *
 * Same shape as `packages/astral-native/src/__tests__/host.test.ts`, and for
 * the same reason: the capabilities are the contract between one shared
 * surface and two brands, so what happens when one is MISSING is part of the
 * contract rather than an accident.
 */

import {
  CHAT_RETRY_EVENT,
  CHAT_SEND_EVENT,
  getChatHost,
  installChatHost,
  isChatHostInstalled,
  resetChatHost,
  type ChatHost,
} from '../host';

const MOBILE: ChatHost = { getToken: async () => 'token', routing: true };
const ASTRO: ChatHost = {
  getToken: async () => 'token',
  routing: false,
  pinnedAgent: 'astrology_ai',
};

afterEach(resetChatHost);

describe('a missing host is loud, not plausible', () => {
  it('reports honestly that nothing is installed', () => {
    expect(isChatHostInstalled()).toBe(false);
  });

  it('throws with the fix in the message rather than falling back', () => {
    // The alternative — a default host with a no-op getToken — is a chat
    // that appears to send and never does. That failure class is exactly
    // what the astral binding's host note is about.
    expect(() => getChatHost()).toThrow(/installChatHost/);
    expect(() => getChatHost()).toThrow(/ASTRAL-105/);
  });
});

describe('(c) routing disabled — the pin has to point somewhere', () => {
  it('refuses to install "routing off" with nothing to force to', () => {
    // Silently accepting this is routing back ON without anybody deciding
    // it: no force_agent on the wire means the platform router runs.
    expect(() =>
      installChatHost({ getToken: async () => 't', routing: false }),
    ).toThrow(/pinnedAgent/);
    expect(isChatHostInstalled()).toBe(false);
  });

  it('accepts astro: routing off, agent pinned', () => {
    installChatHost(ASTRO);
    expect(getChatHost().pinnedAgent).toBe('astrology_ai');
  });

  it('accepts mobile: routing on, no pin needed', () => {
    installChatHost(MOBILE);
    expect(getChatHost().routing).toBe(true);
  });
});

describe('the optional capabilities are absences, not oversights', () => {
  it('a host with no upload and no transcribe still installs', () => {
    // apps/astro today: no native multipart upload path (that move is
    // ASTRAL-110). The composer must therefore SHOW no attach button rather
    // than show one that does nothing.
    installChatHost(ASTRO);
    expect(getChatHost().upload).toBeUndefined();
    expect(getChatHost().transcribe).toBeUndefined();
  });

  it('a host with no counter still installs, and gains no events', () => {
    installChatHost(MOBILE);
    expect(getChatHost().track).toBeUndefined();
  });
});

describe('one channel name for both apps', () => {
  it('keeps the shipped value, so the live app does not change', () => {
    // It was two names — mobile's `chat-quick-reply` and astro's
    // `astral-widget-answer` — for the same hop. The survivor is the one
    // already on TestFlight.
    expect(CHAT_SEND_EVENT).toBe('chat-quick-reply');
    expect(CHAT_RETRY_EVENT).toBe('chat-retry');
  });
});
