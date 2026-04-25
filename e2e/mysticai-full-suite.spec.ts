/**
 * MysticAI full E2E suite — 11 tests covering the cosmic UI, palm scanning
 * + reading widgets, viral predictions, natal Kundli, muhurta, and the
 * holistic verification follow-up flow.
 *
 * Run:   ./node_modules/.bin/playwright test e2e/mysticai-full-suite.spec.ts
 *
 * Prereqs: chatservice + Vite + Redis up (./start-all.sh) and a real palm
 * photo at /tmp/real_palm.png (~4 MB).
 */

import * as fs from 'fs';
import { expect, request, test, type APIRequestContext, type Page } from '@playwright/test';

const BASE_API = 'http://localhost:8080/api/v1';
const BASE_UI = 'http://localhost:5173/chataiagent';
const PALM_IMAGE = '/tmp/real_palm.png';

// ---------- Shared API helpers (seed chat state) ----------

async function uploadPalm(api: APIRequestContext): Promise<string> {
  const buf = fs.readFileSync(PALM_IMAGE);
  const r = await api.post(`${BASE_API}/files/upload`, {
    multipart: { files: { name: 'palm.png', mimeType: 'image/png', buffer: buf } },
  });
  expect(r.status()).toBe(201);
  return (await r.json()).files[0].id as string;
}

async function createChat(
  api: APIRequestContext,
  firstMessage: string,
  attachments: string[] = [],
): Promise<string> {
  const r = await api.post(`${BASE_API}/chats`, {
    data: {
      title: 'MysticAI suite',
      agentType: 'astrology_ai',
      firstMessage: { content: firstMessage, attachments },
    },
  });
  expect(r.status()).toBeLessThan(400);
  return (await r.json()).chat.id as string;
}

async function sendMessage(api: APIRequestContext, chatId: string, content: string): Promise<void> {
  const r = await api.post(`${BASE_API}/chats/${chatId}/messages`, {
    data: { content, attachments: [] },
  });
  expect(r.status()).toBeLessThan(400);
}

async function drainStream(api: APIRequestContext, chatId: string): Promise<string> {
  const r = await api.get(`${BASE_API}/chats/${chatId}/stream`, { timeout: 240_000 });
  const text = await r.text();
  let out = '';
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    try {
      const evt = JSON.parse(line.slice(6));
      if (evt.type === 'message_delta') out += evt.delta || '';
    } catch {
      // skip
    }
  }
  return out;
}

/** Wait until DOM has at least N new chars past baseline AND has been quiet
    for `quietMs`. Required because Gemini Pro thinking pauses are ~10-25s. */
async function waitForAnswer(
  page: Page,
  baselineLen: number,
  opts: { minNewChars?: number; quietMs?: number; maxMs?: number } = {},
): Promise<string> {
  const minNewChars = opts.minNewChars ?? 600;
  const quietMs = opts.quietMs ?? 6000;
  const maxMs = opts.maxMs ?? 200_000;
  const start = Date.now();
  let lastLen = -1;
  let lastChange = Date.now();
  let crossed = false;
  while (Date.now() - start < maxMs) {
    const len = await page.evaluate(() => (document.body.textContent || '').length);
    if (len - baselineLen >= minNewChars) crossed = true;
    if (len !== lastLen) {
      lastLen = len;
      lastChange = Date.now();
    } else if (crossed && Date.now() - lastChange >= quietMs) {
      return (await page.textContent('body')) || '';
    }
    await page.waitForTimeout(700);
  }
  return (await page.textContent('body')) || '';
}

// ---------- Fixtures: shared seeded chats (avoid re-running palm vision per test) ----------

let cachedPalmChatId: string | null = null;
let cachedNatalChatId: string | null = null;
let cachedDualChatId: string | null = null;

async function getPalmChat(api: APIRequestContext): Promise<string> {
  if (cachedPalmChatId) return cachedPalmChatId;
  const fid = await uploadPalm(api);
  const cid = await createChat(api, 'Please read my palm', [fid]);
  await drainStream(api, cid);
  cachedPalmChatId = cid;
  return cid;
}

async function getNatalChat(api: APIRequestContext): Promise<string> {
  if (cachedNatalChatId) return cachedNatalChatId;
  const cid = await createChat(api, 'Cast my Kundli. Born 24 June 1990, 3:15 AM, in Bangalore.');
  await drainStream(api, cid);
  cachedNatalChatId = cid;
  return cid;
}

async function getDualChat(api: APIRequestContext): Promise<string> {
  if (cachedDualChatId) return cachedDualChatId;
  const fid = await uploadPalm(api);
  const cid = await createChat(api, 'Please read my palm', [fid]);
  await drainStream(api, cid);
  await sendMessage(api, cid, 'Now also cast my Janam Kundli. Born 15 August 1985, 9:30 AM, Chennai.');
  await drainStream(api, cid);
  cachedDualChatId = cid;
  return cid;
}

// ---------- Tests ----------

test.describe('MysticAI Full Suite', () => {
  // Holistic + palm vision turns are slow; allow generous per-test cap.
  test.describe.configure({ timeout: 360_000 });

  // ===== 1. Cosmic UI: starfield + planets render on MysticAI mode =====
  test('1. Cosmic background renders (canvas + planets + nebula)', async ({ page }) => {
    await page.goto(`${BASE_UI}/new?mystic=1`);
    await page.waitForLoadState('networkidle');

    const probe = await page.evaluate(() => {
      const cosmos = document.querySelector('.mystic-cosmos');
      const nebula = document.querySelector('.mystic-nebula');
      const canvas = document.querySelector('canvas.mystic-starfield') as HTMLCanvasElement | null;
      const planets = document.querySelectorAll('.mystic-planet');
      return {
        cosmos: !!cosmos,
        nebula: !!nebula,
        canvas: !!canvas,
        canvasW: canvas?.width || 0,
        canvasH: canvas?.height || 0,
        planetCount: planets.length,
        mysticClass: document.documentElement.classList.contains('mystic'),
      };
    });

    expect(probe.cosmos).toBe(true);
    expect(probe.nebula).toBe(true);
    expect(probe.canvas).toBe(true);
    expect(probe.canvasW).toBeGreaterThan(100);
    expect(probe.canvasH).toBeGreaterThan(100);
    expect(probe.planetCount).toBeGreaterThanOrEqual(4);
    expect(probe.mysticClass).toBe(true);
    await page.screenshot({ path: 'e2e/screenshots/suite-01-cosmos.png' });
  });

  // ===== 2. Empty state: shimmer heading + orbital rings =====
  test('2. Empty state shows shimmer heading + orbital rings', async ({ page }) => {
    await page.goto(`${BASE_UI}/new?mystic=1`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/what does the cosmos reveal/i)).toBeVisible();
    await expect(page.getByText(/Muhurta · Kundli · Palm Reading/i)).toBeVisible();

    const orbits = await page.$$('.mystic-orbit-ring');
    expect(orbits.length).toBeGreaterThanOrEqual(2);

    // Heading element should have the shimmer-gradient class.
    const hasShimmer = await page.evaluate(() =>
      !!document.querySelector('.mystic-heading'),
    );
    expect(hasShimmer).toBe(true);
    await page.screenshot({ path: 'e2e/screenshots/suite-02-empty-state.png' });
  });

  // ===== 3. Logo: MysticAI branding with shimmer + glow =====
  test('3. Logo renders with cosmic shimmer + glowing crystal ball', async ({ page }) => {
    await page.goto(`${BASE_UI}/new?mystic=1`);
    await page.waitForLoadState('networkidle');

    const logoText = page.locator('h1').filter({ hasText: /^MysticAI$/ }).first();
    await expect(logoText).toBeVisible();
    // Logo h1 should have the .mystic-heading class for the shimmer gradient.
    const hasClass = await logoText.evaluate((el) => el.classList.contains('mystic-heading'));
    expect(hasClass).toBe(true);

    // 🔮 with .mystic-glow class.
    const glowEmoji = await page.$('span.mystic-glow');
    expect(glowEmoji).not.toBeNull();
  });

  // ===== 4. Palm scanning widget block is emitted + rendered =====
  test('4. Palm scanning widget renders cinematic placeholder', async ({ page }) => {
    const api = await request.newContext();

    // Drain a fresh palm chat at the API level so we can assert directly that
    // the backend emits the `palm_scanning` fenced block (deterministic, no
    // race with SSE timing in the browser).
    const fid = await uploadPalm(api);
    const cid = await createChat(api, 'Please read my palm', [fid]);
    const stream = await drainStream(api, cid);
    expect(stream, 'palm_scanning fenced block in SSE').toContain('```palm_scanning');
    expect(stream, 'palm_analysis fenced block in SSE').toContain('```palm_analysis');

    // Now open the chat in the UI — both fenced blocks render as widgets, so
    // the scanning widget DOM (.palm-scan-sweep) must be present permanently.
    await page.goto(`${BASE_UI}/chat/${cid}?mystic=1`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.palm-scan-sweep', { timeout: 30_000 });
    await expect(page.getByText(/Scanning Palm/i)).toBeVisible();
    // Progress bar element from the scanning widget should also be present.
    const hasProgressBar = await page.evaluate(() =>
      !!document.querySelector('.palm-scan-bokeh'),
    );
    expect(hasProgressBar).toBe(true);
    await page.screenshot({ path: 'e2e/screenshots/suite-04-scanning.png', fullPage: true });

    await api.dispose();
  });

  // ===== 5. Palm reading widget renders image + SVG line overlay =====
  test('5. Palm reading widget renders image + SVG line overlays', async ({ page }) => {
    const api = await request.newContext();
    const cid = await getPalmChat(api);

    await page.goto(`${BASE_UI}/chat/${cid}?mystic=1`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Quick Predictions', { timeout: 60_000 });

    // The widget contains the palm image.
    const img = page.locator('img[alt="Palm reading"]');
    await expect(img).toBeVisible();

    // SVG overlay with at least one path-stroked line.
    const svgPathCount = await page.evaluate(() => {
      const widgets = document.querySelectorAll('img[alt="Palm reading"]');
      let count = 0;
      widgets.forEach((img) => {
        const wrap = img.closest('div');
        const svg = wrap?.querySelector('svg');
        if (svg) count += svg.querySelectorAll('path').length;
      });
      return count;
    });
    expect(svgPathCount).toBeGreaterThan(0);
    await page.screenshot({ path: 'e2e/screenshots/suite-05-palm-widget.png', fullPage: true });

    await api.dispose();
  });

  // ===== 6. Viral predictions: all 5 chip categories present =====
  test('6. Viral predictions show all 5 chip categories', async ({ page }) => {
    const api = await request.newContext();
    const cid = await getPalmChat(api);

    await page.goto(`${BASE_UI}/chat/${cid}?mystic=1`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Quick Predictions', { timeout: 60_000 });

    const txt = (await page.textContent('body')) || '';
    expect(txt, 'lifespan chip').toMatch(/LIFESPAN[\s\S]{0,50}years/i);
    expect(txt, 'love/marriage chip').toMatch(/LOVE[\s\S]{0,80}(married|age)/i);
    expect(txt, 'family chip').toMatch(/FAMILY[\s\S]{0,60}(kid|children)/i);
    expect(txt, 'career peak chip').toMatch(/CAREER PEAK[\s\S]{0,40}age/i);
    expect(txt, 'wealth peak chip').toMatch(/WEALTH PEAK[\s\S]{0,40}age/i);
    await page.screenshot({ path: 'e2e/screenshots/suite-06-predictions.png', fullPage: true });

    await api.dispose();
  });

  // ===== 7. Natal Kundli: cast → Lagna + Mahadasha + interpretation =====
  test('7. Natal Kundli computes ascendant + dasha + 8-section interpretation', async ({ page }) => {
    const api = await request.newContext();
    const cid = await getNatalChat(api);

    await page.goto(`${BASE_UI}/chat/${cid}?mystic=1`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Lagna', { timeout: 60_000 });

    const txt = (await page.textContent('body')) || '';
    expect(txt).toMatch(/Lagna|Ascendant/);
    expect(txt).toMatch(/Mahadasha/);
    expect(txt).toMatch(/Personality/i);
    expect(txt).toMatch(/Career/i);
    // Cites a specific planet
    expect(txt).toMatch(/Saturn|Jupiter|Mercury|Venus|Mars|Sun|Moon|Rahu|Ketu/);
    await page.screenshot({ path: 'e2e/screenshots/suite-07-natal.png', fullPage: true });

    await api.dispose();
  });

  // ===== 8. Muhurta: auspicious time computation =====
  test('8. Muhurta finds auspicious windows for a date range', async ({ page }) => {
    const api = await request.newContext();

    const cid = await createChat(
      api,
      'Find best muhurta for my C-section between 25 April 2026 and 28 April 2026 at Fortis Bangalore.',
    );
    const muhurtaText = await drainStream(api, cid);

    expect(muhurtaText, 'has muhurta widget').toContain('```muhurta_results');
    expect(muhurtaText, 'cites Panchang elements').toMatch(/Nakshatra|Tithi|Lagna|Pada/);
    expect(muhurtaText, 'lists windows').toMatch(/auspicious|Window|score/i);

    await page.goto(`${BASE_UI}/chat/${cid}?mystic=1`);
    await page.waitForLoadState('networkidle');
    const txt = (await page.textContent('body')) || '';
    expect(txt).toMatch(/Nakshatra|Tithi|Lagna|Pada/);
    await page.screenshot({ path: 'e2e/screenshots/suite-08-muhurta.png', fullPage: true });

    await api.dispose();
  });

  // ===== 9. Holistic: palm + Kundli → 6-section verification answer =====
  test('9. Holistic palm+kundli answers a problem question with verification method', async ({ page }) => {
    const api = await request.newContext();
    const cid = await getDualChat(api);

    await page.goto(`${BASE_UI}/chat/${cid}?mystic=1`);
    await page.waitForLoadState('networkidle');
    const baselineLen = ((await page.textContent('body')) || '').length;

    const input = page.getByPlaceholder(/ask me anything/i);
    await input.fill(
      'I have been facing career stagnation and financial stress for 2 years. ' +
        'Using BOTH my palm and Kundli, why is this happening, how long will it last, ' +
        'and what concrete remedies should I follow?',
    );
    await page.keyboard.press('Enter');

    const finalDom = await waitForAnswer(page, baselineLen, { minNewChars: 1500, quietMs: 6000 });
    const answer = finalDom.slice(baselineLen);
    expect(answer.length).toBeGreaterThan(1500);

    expect(answer).toMatch(/Mahadasha|Antardasha|Lagna/);
    expect(answer.toLowerCase()).toMatch(/fate line|bhagya rekha|life line|mount of/);
    expect(answer).toMatch(/Saturn|Rahu|Jupiter|Mercury|Venus|Mars/);
    expect(answer.toLowerCase()).toMatch(/mantra|donate|chant|hanuman|peepal|moong|silver|saffron/);
    expect(answer.toLowerCase()).not.toContain("couldn't complete the full holistic");
    await page.screenshot({ path: 'e2e/screenshots/suite-09-holistic.png', fullPage: true });

    await api.dispose();
  });

  // ===== 10. Holistic: Kundli only → flags missing palm gracefully =====
  test('10. Holistic Kundli-only flags missing palm and still answers', async ({ page }) => {
    const api = await request.newContext();
    const cid = await getNatalChat(api);

    await page.goto(`${BASE_UI}/chat/${cid}?mystic=1`);
    await page.waitForLoadState('networkidle');
    const baselineLen = ((await page.textContent('body')) || '').length;

    const input = page.getByPlaceholder(/ask me anything/i);
    await input.fill(
      'I am facing health issues since last year. Why is this happening and how long will it last?',
    );
    await page.keyboard.press('Enter');

    const finalDom = await waitForAnswer(page, baselineLen, { minNewChars: 1000 });
    const answer = finalDom.slice(baselineLen);
    expect(answer.length).toBeGreaterThan(1000);

    expect(answer).toMatch(/Mahadasha|Antardasha|Lagna|house|Bhava/);
    // Should explicitly note the palm is missing OR invite the user to upload one.
    expect(answer.toLowerCase()).toMatch(/palm|hand|upload|samudrika|fuller|complete reading/);
    // Did NOT recast the chart on the follow-up.
    expect(answer).not.toContain('```natal_chart');
    expect(answer).not.toMatch(/Casting your Janam Kundli/i);
    await page.screenshot({ path: 'e2e/screenshots/suite-10-kundli-only.png', fullPage: true });

    await api.dispose();
  });

  // ===== 11. Bonus: follow-up after Kundli does NOT recast the chart =====
  test('11. Follow-up after Kundli does NOT recast (uses persisted chart slot)', async ({ page }) => {
    const api = await request.newContext();
    const cid = await getNatalChat(api);

    await page.goto(`${BASE_UI}/chat/${cid}?mystic=1`);
    await page.waitForLoadState('networkidle');
    const baselineLen = ((await page.textContent('body')) || '').length;

    const input = page.getByPlaceholder(/ask me anything/i);
    await input.fill('Tell me more about my Mercury placement and what it means for my career.');
    await page.keyboard.press('Enter');

    const finalDom = await waitForAnswer(page, baselineLen, { minNewChars: 800 });
    const answer = finalDom.slice(baselineLen);
    expect(answer.length).toBeGreaterThan(800);
    // No re-casting markers.
    expect(answer).not.toContain('```natal_chart');
    expect(answer).not.toMatch(/Casting your Janam Kundli/i);
    expect(answer).toMatch(/Mercury/);
    await page.screenshot({ path: 'e2e/screenshots/suite-11-no-recast.png', fullPage: true });

    await api.dispose();
  });
});
