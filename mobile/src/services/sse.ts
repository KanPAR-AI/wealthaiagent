import { useAuthStore } from '../store/auth';

export type SSECallback = (event: string, data: string) => void;

/**
 * Opens an SSE connection and calls onEvent for each server-sent event.
 * Returns an abort function to close the connection.
 */
export function connectSSE(
  url: string,
  onEvent: SSECallback,
  onError?: (error: Error) => void,
  onComplete?: () => void
): () => void {
  const controller = new AbortController();
  const token = useAuthStore.getState().token;

  (async () => {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`SSE connection failed: ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = 'message';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            currentData += line.slice(6);
          } else if (line === '') {
            if (currentData) {
              onEvent(currentEvent, currentData);
              currentEvent = 'message';
              currentData = '';
            }
          }
        }
      }

      onComplete?.();
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        onError?.(err as Error);
      }
    }
  })();

  return () => controller.abort();
}
