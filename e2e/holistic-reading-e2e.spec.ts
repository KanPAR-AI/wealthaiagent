/**
 * Holistic Palmistry + Jyotish E2E test.
 *
 * Hybrid strategy: API-seed the chat state (palm + chart already analyzed and
 * persisted in Redis), then open the actual MysticAI UI and verify that a
 * problem-oriented follow-up question produces the 6-section "Verification
 * Method" answer (Kundli says / palm confirms / why / how long / what to do
 * / bio-feedback). API seeding skips Playwright's flaky file-upload mechanic
 * — we already cover palm vision in palm-reading-e2e.spec.ts — and lets us
 * assert what we actually care about: that holistic.run_holistic_reading
 * fires and renders cleanly through SSE in the cosmic UI.
 *
 * Prereqs:
 *   - chatservice + Vite + Redis running (./start-all.sh)
 *   - Real palm photo at /tmp/real_palm.png (~4 MB)
 */

import * as fs from 'fs';
import { expect, request, test, type APIRequestContext, type Page } from '@playwright/test';

const BASE_API = 'http://localhost:8080/api/v1';
const BASE_UI = 'http://localhost:5173/chataiagent';
const PALM_IMAGE = '/tmp/real_palm.png';

// ---------- API helpers (seed chat state quickly + reliably) ----------

async function uploadPalm(api: APIRequestContext): Promise<string> {
  const buf = fs.readFileSync(PALM_IMAGE);
  const resp = await api.post(`${BASE_API}/files/upload`, {
    multipart: {
      files: { name: 'palm.png', mimeType: 'image/png', buffer: buf },
    },
  });
  expect(resp.status()).toBe(201);
  const body = await resp.json();
  return body.files[0].id as string;
}

async function createChat(
  api: APIRequestContext,
  firstMessage: string,
  attachments: string[] = [],
): Promise<string> {
  const resp = await api.post(`${BASE_API}/chats`, {
    data: {
      title: 'Holistic E2E',
      agentType: 'astrology_ai',
      firstMessage: { content: firstMessage, attachments },
    },
  });
  expect(resp.status()).toBeLessThan(400);
  const body = await resp.json();
  return body.chat.id as string;
}

async function sendMessage(
  api: APIRequestContext,
  chatId: string,
  content: string,
): Promise<void> {
  const resp = await api.post(`${BASE_API}/chats/${chatId}/messages`, {
    data: { content, attachments: [] },
  });
  expect(resp.status()).toBeLessThan(400);
}

/** Stream and drain SSE for a chat until message_complete arrives. */
async function drainStream(api: APIRequestContext, chatId: string): Promise<string> {
  const resp = await api.get(`${BASE_API}/chats/${chatId}/stream`, { timeout: 240_000 });
  const text = await resp.text();
  // Concatenate all message_delta deltas in order.
  let assembled = '';
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    try {
      const evt = JSON.parse(line.slice(6));
      if (evt.type === 'message_delta') assembled += evt.delta || '';
    } catch {
      // skip non-JSON heartbeats
    }
  }
  return assembled;
}

/**
 * Wait for a streaming holistic answer to actually arrive AND settle.
 *
 * Naive "DOM unchanged for N seconds" triggers prematurely while Gemini
 * 3.1 Pro is in its thinking phase (the spinner shows but no chars are
 * written for 10-25s). So we require BOTH:
 *   1. `minNewChars` characters have appeared past `baselineLen`
 *   2. AND the DOM has been quiet for `quietMs`
 */
async function waitForHolisticAnswer(
  page: Page,
  baselineLen: number,
  opts: { minNewChars?: number; quietMs?: number; maxMs?: number } = {},
): Promise<string> {
  const minNewChars = opts.minNewChars ?? 800;
  const quietMs = opts.quietMs ?? 6000;
  const maxMs = opts.maxMs ?? 180_000;

  const start = Date.now();
  let lastLen = -1;
  let lastChange = Date.now();
  let crossedThreshold = false;

  while (Date.now() - start < maxMs) {
    const len = await page.evaluate(() => (document.body.textContent || '').length);
    if (len - baselineLen >= minNewChars) crossedThreshold = true;
    if (len !== lastLen) {
      lastLen = len;
      lastChange = Date.now();
    } else if (crossedThreshold && Date.now() - lastChange >= quietMs) {
      return (await page.textContent('body')) || '';
    }
    await page.waitForTimeout(700);
  }
  return (await page.textContent('body')) || '';
}

// ---------- Tests ----------

test.describe('MysticAI Holistic Reading E2E', () => {
  // Holistic synthesis (palm vision + natal compute + Gemini 3.1 Pro reasoning
  // with 4096 thinking budget) blows past the 3-min default.
  test.describe.configure({ timeout: 300_000 });

  test('Palm + Kundli → problem question renders the 6-section verification answer', async ({
    page,
  }) => {
    const api = await request.newContext();

    // Turn 1 (API): upload palm + create chat with palm attached.
    console.log('[seed] Uploading palm...');
    const fileId = await uploadPalm(api);
    console.log(`[seed] file_id=${fileId}`);

    console.log('[seed] Creating chat with palm reading request...');
    const chatId = await createChat(api, 'Please read my palm', [fileId]);
    console.log(`[seed] chat_id=${chatId}`);

    console.log('[seed] Draining palm-vision stream...');
    const palmText = await drainStream(api, chatId);
    expect(palmText.length).toBeGreaterThan(1000);
    expect(palmText).toMatch(/Hand Shape|Heart Line|Hriday Rekha|Mount of/);

    // Turn 2 (API): cast Kundli on the same chat.
    console.log('[seed] Casting Kundli...');
    await sendMessage(api, chatId, 'Now also cast my Janam Kundli. Born 15 August 1985, 9:30 AM, Chennai.');
    const natalText = await drainStream(api, chatId);
    expect(natalText.length).toBeGreaterThan(1500);
    expect(natalText).toMatch(/Lagna|Mahadasha/);

    // ---- UI assertion: open the cosmic UI on this seeded chat and ask the
    // holistic problem question. This is the meaningful integration check.
    console.log('[ui] Opening seeded chat in browser...');
    await page.goto(`${BASE_UI}/chat/${chatId}?mystic=1`);
    await page.waitForLoadState('networkidle');
    // .first() — once chat history is loaded, "MysticAI" may appear in
    // multiple places (logo + assistant prose), which trips Playwright
    // strict-mode. We only care that the cosmic chrome rendered at least once.
    await expect(page.locator('text=MysticAI').first()).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/holistic-01-loaded.png', fullPage: true });

    // Confirm the prior turns rendered.
    const initial = (await page.textContent('body')) || '';
    expect(initial).toMatch(/Heart Line|Hriday Rekha|Mount of/);
    expect(initial).toMatch(/Lagna|Mahadasha/);
    const baselineLen = initial.length;

    // Send the holistic problem question through the UI.
    console.log('[ui] Sending problem question...');
    const input = page.getByPlaceholder(/ask me anything/i);
    const problemQ =
      'I have been facing career stagnation and financial stress for the last 2 years. ' +
      'Using BOTH my palm and my Kundli, why is this happening, how long will it last, ' +
      'and what concrete remedies should I follow?';
    await input.fill(problemQ);
    await page.keyboard.press('Enter');

    // Wait for stream to fully settle (DOM length quiet for 4s).
    console.log('[ui] Waiting for holistic stream to settle...');
    const finalDom = await waitForHolisticAnswer(page, baselineLen, {
      minNewChars: 1500,
      quietMs: 6000,
      maxMs: 200_000,
    });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.screenshot({ path: 'e2e/screenshots/holistic-02-answer.png', fullPage: true });

    // Slice out only the new content (the holistic answer + question echo).
    const newContent = finalDom.slice(baselineLen);
    console.log(`[ui] new content chars: ${newContent.length}`);
    expect(newContent.length).toBeGreaterThan(1500);

    // ---- 10 quality checks on the holistic answer ----
    expect(newContent, 'cites Kundli specifics').toMatch(/Mahadasha|Antardasha|Lagna/);
    expect(newContent.toLowerCase(), 'cites palm specifics').toMatch(
      /fate line|bhagya rekha|life line|mount of|sun line|surya rekha/,
    );
    expect(newContent, 'specific planet').toMatch(/Saturn|Rahu|Jupiter|Mercury|Venus|Mars|Ketu/);
    expect(newContent, 'concrete timing').toMatch(/20\d{2}|Antardasha|Mahadasha|months/i);
    expect(newContent.toLowerCase(), 'remedy mentioned').toMatch(
      /mantra|donate|chant|hanuman|peepal|moong|silver|saffron/,
    );
    expect(newContent, 'Hindi term').toMatch(/Bhava|Rekha|Dhana|Karma|Budh|Guru|Shukra|Shani/);
    expect(newContent.toLowerCase(), 'bio-feedback or observation window').toMatch(
      /bio-feedback|photograph|45|90 days|months|watch for|3.{0,5}6 months/,
    );
    expect(newContent, 'no chart recast').not.toContain('```natal_chart');
    expect(newContent, 'no palm re-analysis').not.toContain('```palm_analysis');
    expect(newContent.toLowerCase(), 'no fallback error').not.toMatch(
      /i apologize|couldn't complete the full holistic/,
    );

    console.log('✅ Palm + Kundli holistic E2E passed all 10 quality checks');
    await api.dispose();
  });

  test('Kundli only (no palm) → holistic gracefully flags missing palm', async ({ page }) => {
    const api = await request.newContext();

    // Seed: create a Kundli-only chat via API.
    console.log('[seed] Creating Kundli-only chat...');
    const chatId = await createChat(
      api,
      'Cast my Kundli. Born 24 June 1990, 3:15 AM, in Bangalore.',
    );
    const natalText = await drainStream(api, chatId);
    expect(natalText).toMatch(/Lagna|Mahadasha/);
    expect(natalText.length).toBeGreaterThan(1500);

    // Open UI and ask the problem question.
    console.log('[ui] Opening seeded chat...');
    await page.goto(`${BASE_UI}/chat/${chatId}?mystic=1`);
    await page.waitForLoadState('networkidle');
    const baselineLen = ((await page.textContent('body')) || '').length;

    const input = page.getByPlaceholder(/ask me anything/i);
    await input.fill(
      'I am facing health issues since last year. Why is this happening and how long will it last?',
    );
    await page.keyboard.press('Enter');

    const finalDom = await waitForHolisticAnswer(page, baselineLen, {
      minNewChars: 1000,
      quietMs: 6000,
      maxMs: 200_000,
    });
    await page.screenshot({ path: 'e2e/screenshots/holistic-03-kundli-only.png', fullPage: true });

    const answer = finalDom.slice(baselineLen);
    console.log(`[ui] answer chars: ${answer.length}`);
    expect(answer.length).toBeGreaterThan(1000);

    // Should still produce a Kundli-grounded answer.
    expect(answer, 'Kundli reference').toMatch(/Mahadasha|Antardasha|Lagna|house|Bhava/);

    // Should explicitly note the palm is missing OR invite the user to upload one.
    expect(answer.toLowerCase(), 'flags missing palm').toMatch(
      /palm|hand|upload|samudrika|fuller|complete reading/,
    );

    // Did NOT recast the chart on the follow-up.
    expect(answer, 'no chart recast').not.toContain('```natal_chart');
    expect(answer, 'no recast template').not.toMatch(/Casting your Janam Kundli/i);

    console.log('✅ Kundli-only graceful path verified');
    await api.dispose();
  });
});
