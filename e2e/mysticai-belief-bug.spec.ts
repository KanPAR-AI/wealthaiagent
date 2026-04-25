/**
 * Regression test for the "Saharsa Bihar" intent-loss bug + the
 * delivery-disclaimer-on-marriage-muhurta bug.
 *
 * Original transcript (April 2026):
 *   T1 USER: "Marriage muhurta in next 15 days"
 *   T1 BOT:  asks for location + (BUG) shows delivery medical disclaimer
 *   T2 USER: "Saharsa Bihar"
 *   T2 BOT:  (BUG) "I see you mentioned Saharsa, Bihar. How can I help with astrology today?"
 *           — completely lost the muhurta intent + the date range.
 *
 * After the belief-tracker rewrite (extractor.py + belief.py + holistic.py +
 * panchang/transits/event_type plumbing), the EXPECTED behaviour is:
 *   T1 BOT:  asks for location + shows CULTURAL disclaimer (no doctor talk).
 *   T2 BOT:  immediately computes muhurta windows for Saharsa, Bihar in
 *           the requested 15-day window — intent + slots preserved.
 */

import { expect, request, test, type APIRequestContext } from '@playwright/test';

const BASE_API = 'http://localhost:8080/api/v1';

async function createChat(api: APIRequestContext, firstMessage: string): Promise<string> {
  const r = await api.post(`${BASE_API}/chats`, {
    data: {
      title: 'Belief regression', agentType: 'astrology_ai',
      firstMessage: { content: firstMessage, attachments: [] },
    },
  });
  expect(r.status()).toBeLessThan(400);
  return (await r.json()).chat.id as string;
}

async function sendMessage(api: APIRequestContext, chatId: string, content: string) {
  const r = await api.post(`${BASE_API}/chats/${chatId}/messages`, {
    data: { content, attachments: [] },
  });
  expect(r.status()).toBeLessThan(400);
}

async function drainStream(api: APIRequestContext, chatId: string): Promise<string> {
  const r = await api.get(`${BASE_API}/chats/${chatId}/stream`, { timeout: 240_000 });
  const txt = await r.text();
  let out = '';
  for (const line of txt.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    try {
      const evt = JSON.parse(line.slice(6));
      if (evt.type === 'message_delta') out += evt.delta || '';
    } catch { /* ignore */ }
  }
  return out;
}

test.describe('MysticAI Belief Tracker regression', () => {
  test.describe.configure({ timeout: 240_000 });

  test('Marriage muhurta + bare-location follow-up keeps intent and computes', async () => {
    const api = await request.newContext();

    // ----- T1: open chat with the original first message -----
    const cid = await createChat(api, 'Marriage muhurta in next 15 days');
    const t1 = await drainStream(api, cid);

    // T1 must ask for location and use the cultural (not medical) disclaimer.
    expect(t1.toLowerCase(), 'mentions marriage').toMatch(/marriage|wedding|vivah/);
    expect(t1.toLowerCase(), 'asks for location').toMatch(/city|location|place|where/);
    expect(t1, 'has cultural disclaimer').toContain('family pandit');
    expect(t1, 'NO medical/delivery disclaimer leak').not.toMatch(
      /doctor's recommendation for delivery/i,
    );

    // ----- T2: bare slot value — THE BUG TURN -----
    await sendMessage(api, cid, 'Saharsa Bihar');
    const t2 = await drainStream(api, cid);

    // T2 must NOT show the generic "How can I help with astrology" reset.
    expect(t2.toLowerCase(), 'no generic reset').not.toMatch(/how can i help.*astrology/);
    expect(t2.toLowerCase(), 'no "are you looking for a birth chart" reset').not.toMatch(
      /looking for a birth chart|reading.*event/,
    );

    // T2 must proceed to compute muhurta — widget block + content.
    expect(t2, 'computed muhurta_results widget present').toContain('```muhurta_results');
    expect(t2, 'cites Saharsa').toMatch(/Saharsa/i);
    expect(t2, 'includes Panchang elements').toMatch(/Nakshatra|Tithi|Lagna|Pada/);

    // T2 must NOT recompute or ask again for things we already know.
    expect(t2, 'no repeat ask for date').not.toMatch(/what.*date|provide.*date.*range/i);
    expect(t2, 'no repeat ask for location').not.toMatch(/which.*city|where.*event.*place/i);

    // Disclaimer on T2 (if present) is cultural, not delivery.
    expect(t2, 'no delivery disclaimer leak on T2').not.toMatch(
      /doctor's recommendation for delivery/i,
    );

    await api.dispose();
  });

  test('Re-asserting "need marriage muhurta" mid-conversation does NOT restart slot collection', async () => {
    const api = await request.newContext();

    const cid = await createChat(api, 'Marriage muhurta in next 15 days');
    await drainStream(api, cid);

    // T2: location
    await sendMessage(api, cid, 'Saharsa Bihar');
    await drainStream(api, cid);

    // T3: redundant restate — must not ask for date/location again.
    await sendMessage(api, cid, 'Need marriage muhurta');
    const t3 = await drainStream(api, cid);

    // The agent should either (a) confirm/recompute the same muhurta, or
    // (b) acknowledge it's already done — but NOT ask for the date or
    // location again.
    expect(t3, 'no repeat ask for date').not.toMatch(/what.*date|provide.*date.*range/i);
    expect(t3, 'no repeat ask for location').not.toMatch(/which.*city|where.*event.*place/i);
    // It should still mention marriage / muhurta context.
    expect(t3.toLowerCase()).toMatch(/marriage|muhurta|auspicious|already/);

    await api.dispose();
  });

  test('Switching from muhurta to natal mid-stream is honored when explicit', async () => {
    const api = await request.newContext();
    const cid = await createChat(api, 'Marriage muhurta in next 15 days');
    await drainStream(api, cid);

    // Explicit topic switch with new-intent slots present.
    await sendMessage(
      api, cid,
      "Actually let me first do my Kundli — born 24 June 1990 at 3:15 AM in Bangalore.",
    );
    const t = await drainStream(api, cid);

    // Should pivot to natal (cast chart with the provided birth data).
    expect(t).toMatch(/Lagna|Mahadasha|Janam Kundli/);
    expect(t.toLowerCase(), 'no longer asks for marriage location').not.toMatch(
      /city.*marriage|where.*marriage/,
    );

    await api.dispose();
  });
});
