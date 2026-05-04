// Regression test for "Response interrupted" bug.
//
// The MysticAI palm path triggers Gemini 2.5 Pro which spends 20-28s on
// internal "thoughts" before emitting its first text token. During that
// window only SSE comment pings (`: ping\n\n`) hit the wire — the parsed
// data:-only TTFB watchdog used to abort at 30s, surfacing as "Response
// interrupted. Tap Retry". This test fails if that regression returns.
//
// Also catches the React StrictMode dev double-fire bug (would open 2 SSE
// streams for one user message).

import { test, expect, Locator } from '@playwright/test';

const BASE = 'http://localhost:5173/chataiagent';
const PALM_IMAGE = '/tmp/real_palm.jpg';

test.describe('SSE never spuriously interrupts', () => {
  test('MysticAI palm with image streams to completion without Retry banner', async ({ page }) => {
    test.setTimeout(180_000);

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const streamUrls: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (/\/chats\/[0-9a-f-]+\/stream/i.test(url)) streamUrls.push(url);
    });

    await page.goto(`${BASE}/new?mystic=1`);
    // Wait for the auth provider to settle (anonymous sign-in resolves).
    await page.waitForLoadState('networkidle');
    await expect(page.getByPlaceholder(/ask me anything/i)).toBeEnabled({ timeout: 20_000 });

    // Upload image. The file input is `display:none` but Playwright handles it.
    await page.locator('input[type="file"]').setInputFiles(PALM_IMAGE);

    // Wait for upload completion by watching for the file-preview chip to render.
    // The chip displays the filename inside the input area once /files/upload returns.
    await expect(page.getByText('real_palm.jpg', { exact: false })).toBeVisible({ timeout: 30_000 });

    const input = page.getByPlaceholder(/ask me anything/i);
    await input.fill('analyse my palm');
    await page.keyboard.press('Enter');

    // Should navigate to /chat/{newId}.
    await page.waitForURL(/\/chataiagent\/chat\/[0-9a-f-]+/, { timeout: 15_000 });

    // Scope all retry/banner assertions to the chat-content area only — the
    // sidebar contains chats with titles like "retry e2e" / "regen test"
    // which would falsely match `getByRole('button', { name: /retry/i })`.
    const main = page.getByRole('main').filter({ hasText: /(?:)/ }).first();
    const interruptedBanner = main.getByText(/Response interrupted/i);
    const retryBtn = main.getByRole('button', { name: /^retry$/i });

    // Race: either we see the bug (Retry banner) or substantive bot content.
    // Gemini 2.5 Pro thinking + vision can take 25-60s — well past the old
    // 30s TTFB ceiling. Give it 120s before declaring failure.
    const start = Date.now();
    let sawInterrupt = false;
    let sawBotResponse = false;
    while (Date.now() - start < 120_000) {
      if (await interruptedBanner.isVisible().catch(() => false)) {
        sawInterrupt = true;
        break;
      }
      // Bot bubble content is anything non-empty inside <main> that isn't
      // our own user bubble or the input. Easiest heuristic: wait for any
      // text matching one of the agent's expected outputs to appear inside
      // <main>.
      const mainText = (await main.textContent()) || '';
      if (
        /Heart Line|Hand Shape|Mount of|Namaste|life line|let me read|let's read|read the story|🤚|🔮|upload a clear|i'd be happy to analyze|i'd love to read|analy[zs]e your palm|reading the story/i.test(
          mainText,
        )
      ) {
        sawBotResponse = true;
        break;
      }
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: `e2e/screenshots/sse-no-interrupt-${Date.now()}.png`,
      fullPage: true,
    });

    expect(
      sawInterrupt,
      'SSE was spuriously aborted (Response interrupted banner appeared)',
    ).toBe(false);
    expect(await retryBtn.count()).toBe(0);
    expect(sawBotResponse, 'No bot response observed within 120s').toBe(true);

    // Exactly one SSE stream request — duplicate would mean StrictMode
    // double-fire regression returned.
    const uniqueChatStreams = Array.from(new Set(streamUrls.map((u) => u.split('?')[0])));
    expect(uniqueChatStreams.length).toBe(1);
    expect(streamUrls.length).toBe(1);

    // No SSE-abort errors in console.
    const sseErrors = consoleErrors.filter((e) =>
      /BodyStreamBuffer|aborted|SSE Stream error|TimeoutError/i.test(e),
    );
    expect(sseErrors, `unexpected SSE errors:\n${sseErrors.join('\n')}`).toEqual([]);
  });
});
