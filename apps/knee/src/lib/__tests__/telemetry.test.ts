// Very basic telemetry: track() must POST the event and NEVER throw.
//
// DELIBERATE PIN UPDATE 2026-09-17: every event now carries
// { platform, rt } merged under the caller's meta (caller wins on collision) —
// the assertions here pin that merged shape.

const mockFetch = jest.fn();
const mockUpdates = { runtimeVersion: '1.1.0' as string | null };
jest.mock('expo/fetch', () => ({ fetch: (...a: unknown[]) => mockFetch(...a) }));
jest.mock('../auth', () => ({ getToken: async () => 'tok-abc' }));
jest.mock('../core-adapter', () => ({ apiUrl: (p: string) => `https://api${p}` }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-updates', () => mockUpdates);

import { track } from '../telemetry';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('track', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockUpdates.runtimeVersion = '1.1.0';
  });

  it('POSTs the event to /knee/event with the bearer token', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    track('phase_open', { phase: '2' });
    await flush();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api/knee/event');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe('Bearer tok-abc');
    expect(JSON.parse(opts.body)).toEqual({
      event: 'phase_open',
      meta: { phase: '2', platform: 'ios', rt: '1.1.0' },
    });
  });

  it('never throws when the network fails', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));
    expect(() => track('app_open')).not.toThrow();
    await flush();               // the rejection is swallowed inside
    expect(mockFetch).toHaveBeenCalled();
  });

  it('meta defaults to just the platform stamp', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    track('coach_open');
    await flush();
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).meta)
      .toEqual({ platform: 'ios', rt: '1.1.0' });
  });

  it('caller meta WINS on a key collision', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    track('session_start', { platform: 'web-sim', rt: 'override', phase: '1' });
    await flush();
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).meta)
      .toEqual({ platform: 'web-sim', rt: 'override', phase: '1' });
  });

  it('a dev build (null runtimeVersion) says so honestly', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    mockUpdates.runtimeVersion = null;
    track('session_complete', { done: 5, total: 5 });
    await flush();
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).meta)
      .toEqual({ done: 5, total: 5, platform: 'ios', rt: 'dev' });
  });
});
