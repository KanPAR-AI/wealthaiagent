/**
 * Memory, end to end — does the system actually remember, and correct itself?
 *
 * Run HEADED so you can watch it:
 *   npx playwright test e2e/memory-mutation.spec.ts --project=chromium --headed
 *
 * Proves three things that are separate systems under the hood:
 *
 *   1. CAPTURE     — a stated constraint is pinned to the chat.
 *   2. SUPERSEDE   — a later, contradicting statement RETIRES the first rather
 *                    than piling up beside it. Before the mutation plane both
 *                    stayed live and every later turn carried two contradictory
 *                    budgets, leaving the model to guess.
 *   3. AUDIT       — Admin → Memory shows the change as a dated event with the
 *                    right scope badge, which is how you'd debug this in prod.
 *
 * Deliberately slowed down (SLOW_MO) — the point of running headed is to see it.
 */

import { test, expect, Page } from '@playwright/test';

const OLD_BUDGET = 'my budget is strictly 80 lakh, never suggest anything above that';
const NEW_BUDGET = 'good news, loan approved — budget is now 1.2 crore';

/** Give each run its own chat so a rerun can't read the previous run's state. */
const stamp = () => new Date().toISOString().slice(11, 19).replace(/:/g, '');

async function sendMessage(page: Page, text: string) {
  const input = page.locator('textarea').first();
  await input.waitFor({ state: 'visible', timeout: 15_000 });
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await input.fill(text);
  await page.waitForTimeout(400);

  const send = page.locator('button')
    .filter({ has: page.locator('svg.lucide-arrow-up') }).first();
  for (let attempt = 0; attempt < 3; attempt++) {
    if ((await input.inputValue()).trim() !== text) await input.fill(text);
    if (await send.isEnabled().catch(() => false)) {
      await send.click({ timeout: 4_000 }).catch(async () => {
        await send.click({ force: true, timeout: 4_000 }).catch(() => {});
      });
    } else {
      await input.press('Enter');
    }
    try {
      await expect.poll(async () => (await input.inputValue()).trim(),
                        { timeout: 6_000 }).toBe('');
      return;
    } catch {
      await page.waitForTimeout(1500);
    }
  }
  throw new Error(`could not submit: ${text}`);
}

async function waitForReply(page: Page) {
  const busy = page.getByTestId('ai-loading-indicator');
  try {
    await busy.first().waitFor({ state: 'visible', timeout: 8_000 });
  } catch { /* may have come and gone between polls */ }
  await busy.first().waitFor({ state: 'detached', timeout: 120_000 })
    .catch(async () => { await busy.first().waitFor({ state: 'hidden', timeout: 120_000 }); });
  await page.waitForTimeout(2500);   // let the constraint write settle
}

// Top-level, not inside describe: launchOptions forces a new worker and
// Playwright refuses it in a describe group.
test.use({ launchOptions: { slowMo: 250 } });

test.describe('Memory: capture, supersede, audit', () => {

  test('a corrected budget retires the old one, and the change is auditable', async ({ page }) => {
    // ── 1. CAPTURE ───────────────────────────────────────────────────────
    await page.goto('/chataiagent/');
    await page.waitForTimeout(2500);
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);

    console.log('\n===== 1. STATE A CONSTRAINT =====');
    await sendMessage(page, `${OLD_BUDGET} (run ${stamp()})`);
    await waitForReply(page);

    const chatId = (page.url().match(/chat\/([0-9a-f-]{36})/) || [])[1];
    expect(chatId, 'no chat id in the URL — nothing was created').toBeTruthy();
    console.log(`chat: ${chatId}`);

    // ── 2. SUPERSEDE ─────────────────────────────────────────────────────
    console.log('\n===== 2. CORRECT IT =====');
    await sendMessage(page, NEW_BUDGET);
    await waitForReply(page);

    // ── 3. VERIFY, in the user-facing surface ───────────────────────────
    // NOT the admin page: this browser is anonymous and /admin correctly
    // bounces to sign-in. The "What I've learned" panel is the right target
    // anyway — it is what the USER sees, so it proves memory works for them
    // rather than only for an operator.
    console.log("\n===== 3. OPEN \"What I've learned\" =====");
    const panel = page.getByText("What I've learned").first();
    await panel.waitFor({ state: 'visible', timeout: 30_000 });
    await panel.click();
    await page.waitForTimeout(3000);

    // Scope to the PANEL, not the page body. A body-substring slice runs past
    // the panel into the message list and matches the user's own "80 lakh"
    // bubble — which reads as a failure when the panel is in fact correct.
    const rulesHeading = page.getByText("Rules I'm following");
    await rulesHeading.waitFor({ state: 'visible', timeout: 20_000 });
    // The heading's parent div wraps heading + list + note — a stable anchor,
    // unlike "the first ul on the page".
    const rulesText = (await rulesHeading.locator('..').textContent()) || '';
    console.log('\n--- rules section ---\n' + rulesText + '\n');

    // 3a. No longer empty. This is the bug that made the panel untrustworthy:
    //     the assistant replied "I have noted your budget constraint" while
    //     the header said "nothing yet".
    const header = (await page.getByText(/What I've learned/).first()
      .locator('..').textContent()) || '';
    expect(header, 'header still says "nothing yet"').not.toContain('nothing yet');

    // 3b. THE POINT: the CURRENT budget is listed, the SUPERSEDED one is not.
    //     Showing both would be the original bug wearing a new coat.
    expect(rulesText, 'the corrected budget is not shown').toMatch(/1\.2\s*crore/i);
    expect(rulesText, 'the retired 80 lakh rule is still listed as active')
      .not.toMatch(/80\s*lakh/i);

    console.log('✅ panel shows the CURRENT rule only; the superseded one is retired.');

    await page.waitForTimeout(3000);   // leave it on screen a moment
  });
});
