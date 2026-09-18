// The chat's TOTAL message count, from the server.
//
// A resumed chat loads only its latest page (20 messages), so the bubbles in
// the store undercount a long conversation — found on the simulator walk of
// the long-chat nudge (2026-09-18): a 62-message chat showed 20. The server's
// chat document carries `messageCount`; this reads it.
import { getToken } from './auth';
import { apiUrl } from './core-adapter';

export async function fetchChatMessageCount(chatId: string): Promise<number | null> {
  try {
    const token = await getToken();
    const res = await fetch(apiUrl(`chats/${chatId}?limit=1`), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { chat?: { messageCount?: number }; messageCount?: number };
    const n = body.chat?.messageCount ?? body.messageCount;
    return typeof n === 'number' ? n : null;
  } catch {
    return null;
  }
}
