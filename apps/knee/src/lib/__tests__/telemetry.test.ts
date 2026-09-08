// Very basic telemetry: track() must POST the event and NEVER throw.

const mockFetch = jest.fn();
jest.mock('expo/fetch', () => ({ fetch: (...a: unknown[]) => mockFetch(...a) }));
jest.mock('../auth', () => ({ getToken: async () => 'tok-abc' }));
jest.mock('../core-adapter', () => ({ apiUrl: (p: string) => `https://api${p}` }));

import { track } from '../telemetry';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('track', () => {
  beforeEach(() => mockFetch.mockReset());

  it('POSTs the event to /knee/event with the bearer token', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    track('phase_open', { phase: '2' });
    await flush();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api/knee/event');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe('Bearer tok-abc');
    expect(JSON.parse(opts.body)).toEqual({ event: 'phase_open', meta: { phase: '2' } });
  });

  it('never throws when the network fails', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));
    expect(() => track('app_open')).not.toThrow();
    await flush();               // the rejection is swallowed inside
    expect(mockFetch).toHaveBeenCalled();
  });

  it('defaults meta to an empty object', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    track('coach_open');
    await flush();
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).meta).toEqual({});
  });
});
