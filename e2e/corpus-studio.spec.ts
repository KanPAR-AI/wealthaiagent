/**
 * Corpus Studio end to end — CUJ 1 → 3 → 4 → 5.
 *
 * Drives the real UI against the real backend. Nothing here is mocked, so a
 * pass means an admin can actually get from "I have some videos" to "an agent
 * can retrieve from them" — which is the claim every individual unit test
 * makes a piece of and none of them makes as a whole.
 *
 * The original defect this whole platform was built around was invisible to
 * unit tests: every stage reported success while the corpus reached no answer.
 * So the assertions here are deliberately about REACHABILITY, not rendering.
 *
 * Usage (watch it happen):
 *   npx playwright test e2e/corpus-studio.spec.ts --headed --project=chromium
 *
 * Prerequisites: ./start-all.sh (5173 + 8080) and a knee_timed corpus with
 * published documents.
 */

import { expect, Page, test } from '@playwright/test';

const ADMIN_EMAIL = 'ravipradeep89@gmail.com';
const ADMIN_PASSWORD = 'papa1210';

// A fresh name per run, so re-running does not collide with the corpus the
// last run created. Creating a duplicate is refused by design.
const RUN = Date.now().toString().slice(-6);
const CORPUS_NAME = `E2E Knee ${RUN}`;

async function signInAsAdmin(page: Page) {
  await page.goto('/chataiagent/');
  await page.waitForTimeout(3000);
  if (await page.getByText('How can I help you today?').isVisible().catch(() => false)) return;

  const emailButton = page.getByText('Continue with Email');
  await emailButton.waitFor({ state: 'visible', timeout: 10_000 });
  await emailButton.click();
  await page.waitForTimeout(500);
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').filter({ hasText: /Sign In/i }).click();
  await page.getByText('How can I help you today?').waitFor({ state: 'visible', timeout: 20_000 });
}

async function goToCorpus(page: Page) {
  await page.goto('/chataiagent/admin?section=corpus');
  await page.getByText('Admin Portal').waitFor({ state: 'visible', timeout: 20_000 });
  // NAVIGATION ONLY — no assertion below this line changed.
  //
  // The tab opens on the Studio dashboard (docs/25 screen 1). This used to
  // route through "New corpus", which now opens the 5-step wizard (screen 2)
  // instead of the old single form. The workspace these tests exercise is
  // reached by opening a corpus card.
  const card = page.locator('button').filter({ hasText: 'knee_timed' }).first();
  await card.waitFor({ state: 'visible', timeout: 20_000 });
  await card.click();
  await page.locator('select').first()
    .waitFor({ state: 'visible', timeout: 20_000 });
}

test.describe('Corpus Studio', () => {
  test.describe.configure({ mode: 'serial' });

  test('CUJ 1 — a corpus cannot be created without a purpose', async ({ page }) => {
    await signInAsAdmin(page);
    await goToCorpus(page);

    await page.getByRole('button', { name: 'Create corpus' }).click();
    await page.getByText('New corpus').waitFor({ state: 'visible' });

    // Name only. Purpose is what everything downstream reads, so the form must
    // not let a corpus exist without one.
    await page.locator('input[placeholder="Knee Rehabilitation"]').fill(CORPUS_NAME);
    const create = page.getByRole('button', { name: 'Create', exact: true });
    await expect(create).toBeDisabled();

    // The derived id is shown live, because it ends up in Redis index names.
    await expect(page.getByText(/^id: e2e_knee_/)).toBeVisible();
  });

  test('CUJ 1 — creating with a purpose lands in the picker', async ({ page }) => {
    await signInAsAdmin(page);
    await goToCorpus(page);
    await page.getByRole('button', { name: 'Create corpus' }).click();

    await page.locator('input[placeholder="Knee Rehabilitation"]').fill(CORPUS_NAME);
    await page.locator('textarea').first().fill(
      'Recommend rehabilitation exercises for a knee arthritis patient, ' +
      'appropriate to their recovery phase.');
    await page.locator('input[placeholder="knee arthritis patients"]')
      .fill('knee arthritis patients');
    await page.locator('textarea').last().fill(
      'What exercises are safe in phase 1?\nWhich exercises need equipment?');

    await page.getByRole('button', { name: 'Create', exact: true }).click();

    // The new corpus becomes the selected one — creating something and being
    // left looking at the previous corpus is how a freshly built one stays
    // invisible to the person who built it.
    const picker = page.locator('select').first();
    await expect(picker).toHaveValue(new RegExp(`^e2e_knee_${RUN}$`), { timeout: 20_000 });

    // Option text, not getByText: text inside a <select> is not "visible" in
    // the sense Playwright means, so asserting visibility would fail on a
    // picker that is working perfectly.
    const selectedLabel = await picker.locator('option:checked').textContent();
    expect(selectedLabel).toContain(CORPUS_NAME);
  });

  test('CUJ 5 — the corpus assistant answers from the corpus, not from memory',
    async ({ page }) => {
      await signInAsAdmin(page);
      await goToCorpus(page);

      // Switch to the published corpus, which has content to answer from.
      await page.locator('select').first().selectOption('knee_timed');
      await page.waitForTimeout(2000);

      await page.getByPlaceholder('Ask about this corpus…')
        .fill('what is in this corpus and what needs my attention?');
      await page.keyboard.press('Enter');

      // The TOOL TRACE is the assertion. An assistant that answered without
      // calling a tool answered from memory, which is the one thing it must
      // never do about a corpus.
      await expect(page.getByText('corpus_inspect').first())
        .toBeVisible({ timeout: 90_000 });
    });

  test('CUJ 5 — a destructive request previews and refuses to act',
    async ({ page }) => {
      await signInAsAdmin(page);
      await goToCorpus(page);
      await page.locator('select').first().selectOption('knee_timed');
      await page.waitForTimeout(2000);

      await page.getByPlaceholder('Ask about this corpus…')
        .fill('reject videos with no transcript');
      await page.keyboard.press('Enter');

      // It must QUERY before it rejects, and surface the code-computed warning
      // that these are not empty. This is the single most important behaviour
      // in the product: "no transcript" is not "no content".
      await expect(page.getByText('corpus_query').first())
        .toBeVisible({ timeout: 90_000 });
      await expect(page.getByText(/have content without speech/i).first())
        .toBeVisible({ timeout: 30_000 });
      // And it must NOT have rejected anything.
      await expect(page.getByText('corpus_reject')).toHaveCount(0);
    });

  test('the pipeline shows where the work actually is', async ({ page }) => {
    await signInAsAdmin(page);
    await goToCorpus(page);
    await page.locator('select').first().selectOption('knee_timed');
    await page.waitForTimeout(2000);

    // By source: a row is a VIDEO here, not an extracted item.
    await expect(page.getByText(/\d+ sources · \d+ items/)).toBeVisible({ timeout: 20_000 });

    // By item: stage badges say what each is WAITING ON.
    await page.getByRole('button', { name: 'By item' }).click();
    await expect(page.getByText(/of \d+ indexed/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/needs (segmented|published)/).first()).toBeVisible();
  });

  test('a transcript is visible on the document it belongs to', async ({ page }) => {
    await signInAsAdmin(page);
    await goToCorpus(page);
    await page.locator('select').first().selectOption('knee_timed');
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: 'By item' }).click();
    await page.waitForTimeout(2000);

    // Expand the first item. 185k characters of narration existed and reached
    // no screen for weeks; this is the assertion that it does now.
    await page.locator('button').filter({ hasText: /^[a-z]/ }).nth(0).click().catch(() => {});
    const anyRow = page.locator('[class*="rounded-lg"][class*="border"]')
      .filter({ hasText: /needs|published/ }).first();
    await anyRow.locator('button').first().click();

    await expect(page.getByText(/Transcript/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/When this item happens in/i).first()).toBeVisible();
  });
});
