/**
 * `completeFirst` (chatservice 2026-10-26): `message_complete` arrives before
 * the suggestion tiles. The consumer must report completion once, keep
 * reading, hand the late tiles on as a widget chunk, and stop at `stream_end`
 * — and, without the option, behave exactly as before (stop at completion).
 */
import { initCore, type PlatformAdapter } from '../../platform';
import { listenToChatStreamCore } from '../chat-service';

function streamOf(lines: string[], thenHang = false) {
  const encoder = new TextEncoder();
  const queue = lines.map((l) => ({ done: false, value: encoder.encode(`data: ${l}\n\n`) }));
  return {
    getReader: () => ({
      async read() {
        const next = queue.shift();
        if (next) return next;
        if (thenHang) return new Promise<never>(() => undefined);
        return { done: true };
      },
    }),
  };
}

let lastUrl = '';
function install(body: unknown) {
  const adapter: PlatformAdapter = {
    fetch: (async (url: string) => { lastUrl = url; return { ok: true, body }; }) as never,
    getApiUrl: (e: string) => `https://api.test/api/v1${e}`,
    storage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
    events: { emit: () => {}, on: () => () => {} },
  };
  initCore(adapter);
}

async function run(lines: string[], completeFirst: boolean, thenHang = false) {
  install(streamOf(lines, thenHang));
  const chunks: Array<[string, string]> = [];
  const onComplete = jest.fn();
  const onError = jest.fn();
  await listenToChatStreamCore('jwt', 'chat_1',
    (c: string, t: string) => { chunks.push([c, t]); }, onComplete, onError,
    { completeFirst });
  return { chunks, onComplete, onError };
}

const COMPLETE = JSON.stringify({ type: 'message_complete', message: { content: 'Hi', finish_reason: 'stop' }, message_id: 'm1', request_id: 'r1' });
const TILES = JSON.stringify({ type: 'widget_action_tiles', content: JSON.stringify({ id: 'suggestion_tiles', data: { actions: [] } }) });
const END = JSON.stringify({ type: 'stream_end' });

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('completeFirst', () => {
  it('asks the server for complete_first=1', async () => {
    await run([COMPLETE, END], true);
    expect(lastUrl).toContain('complete_first=1');
  });

  it('completes once, keeps reading, hands the late tiles on, stops at stream_end', async () => {
    const r = await run([
      JSON.stringify({ type: 'message_delta', delta: 'Hi' }),
      COMPLETE, TILES, END,
    ], true, true);
    expect(r.onComplete).toHaveBeenCalledTimes(1);
    expect(r.onError).not.toHaveBeenCalled();
    expect(r.chunks.map(([, t]) => t)).toEqual(['text_chunk', 'widget_action_tiles']);
  });

  it('an older server that closes without stream_end still ends cleanly, completion reported once', async () => {
    const r = await run([COMPLETE, TILES], true);
    expect(r.onComplete).toHaveBeenCalledTimes(1);
    expect(r.onError).not.toHaveBeenCalled();
  });

  it('without the option the consumer stops at message_complete as before', async () => {
    const r = await run([COMPLETE, TILES, END], false, true);
    expect(r.onComplete).toHaveBeenCalledTimes(1);
    expect(r.chunks).toEqual([]);
    expect(lastUrl).not.toContain('complete_first');
  });
});
