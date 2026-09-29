// E2 round 3, item A — the WEB entry point gets the core fix for free:
// `src/services/chat-service.ts::listenToChatStream` delegates to
// `listenToChatStreamCore`, so the server's `error` event must reach the web
// caller's onError too, not settle as an answered turn.
import { listenToChatStream } from '../chat-service';

const mockFetch = jest.fn();
(globalThis as any).fetch = mockFetch;

function body(lines: string[]) {
  const encoder = new TextEncoder();
  const queue = lines.map((l) => ({ done: false, value: encoder.encode(`data: ${l}\n\n`) }));
  return { getReader: () => ({ read: async () => queue.shift() ?? { done: true } }) };
}

describe('web listenToChatStream — the server error event', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('reports a failure after the partial text, and never completes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: body([
        JSON.stringify({ type: 'message_delta', delta: 'Partial ' }),
        JSON.stringify({ type: 'error', error: 'An error occurred while generating the response' }),
      ]),
    });
    const chunks: string[] = [];
    const onComplete = jest.fn();
    const onError = jest.fn();
    await listenToChatStream('jwt', 'chat_1', (c) => { if (c) chunks.push(c); }, onComplete, onError);
    expect(chunks).toEqual(['Partial ']);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
