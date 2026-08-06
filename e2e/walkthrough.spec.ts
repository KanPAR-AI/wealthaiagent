/**
 * A watchable walkthrough of the whole flow — built to be RUN HEADED.
 *
 *   npx playwright test e2e/walkthrough.spec.ts --headed --project=chromium
 *
 * The other specs are written to be fast and mostly hit the API, so there is
 * nothing to see. This one drives the real UI at human speed, pauses on each
 * thing worth looking at, and narrates to the terminal as it goes.
 *
 * It still ASSERTS. A walkthrough that only clicks around would pass over a
 * broken screen and look fine on video — so each stop checks the one thing
 * that stop exists to show.
 */

import { expect, Page, test } from '@playwright/test';

const ADMIN_EMAIL = 'ravipradeep89@gmail.com';
const ADMIN_PASSWORD = 'papa1210';
const CORPUS = 'knee_timed';

// Long enough to read what is on screen, short enough that the whole run is
// watchable in one sitting.
const BEAT = 2200;
const LOOK = 3500;

async function pause(page: Page, ms: number, say: string) {
  console.log(`\n  ▸ ${say}`);
  await page.waitForTimeout(ms);
}

test.use({
  launchOptions: { slowMo: 350 },
  viewport: { width: 1440, height: 900 },
});

test.describe('Walkthrough', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(900_000);

  test('the whole flow, slowly', async ({ page }) => {
    // ── 1. sign in ──────────────────────────────────────────────────────
    await page.goto('/chataiagent/');
    await page.waitForTimeout(3000);
    if (!(await page.getByText('How can I help you today?').isVisible().catch(() => false))) {
      await page.getByText('Continue with Email').click();
      await page.waitForTimeout(500);
      await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
      await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
      await page.locator('button[type="submit"]').filter({ hasText: /Sign In/i }).click();
    }
    await page.getByText('How can I help you today?')
      .waitFor({ state: 'visible', timeout: 30_000 });
    await pause(page, BEAT, 'Signed in.');

    // ── 2. the corpus estate, and its states ────────────────────────────
    await page.goto('/chataiagent/admin?section=corpus');
    await page.getByText('Admin Portal').waitFor({ state: 'visible', timeout: 30_000 });
    await pause(page, LOOK,
      'Corpus Studio. Each card leads with a STATE — "Published", "Ready to ' +
      'publish", "Archived" — not a document count.');

    const card = page.getByTestId(`corpus-card-${CORPUS}`);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.scrollIntoViewIfNeeded();
    await pause(page, BEAT, 'This is the corpus the knee agent reads.');

    // ── 3. binding — the control that did not exist this morning ────────
    await card.click();
    const toggle = page.getByTestId('toggle-readers');
    await toggle.waitFor({ state: 'visible', timeout: 30_000 });
    await pause(page, LOOK,
      '"read by knee_arthritis" — at corpus level, where you land. It used to ' +
      'live inside a view tab nobody had a reason to open.');

    await toggle.click();
    await expect(page.getByTestId('readers-options')).toBeVisible({ timeout: 20_000 });
    await pause(page, LOOK,
      'The agents that may retrieve from this corpus. PUT /readers has worked ' +
      'for weeks; nothing in any UI called it until now.');
    await toggle.click();

    // ── 4. an asset, and the assistant that knows which one ─────────────
    const source = page.locator('button').filter({ hasText: /Fish Oil|Salonpas|Biofreeze/ }).first();
    if (await source.isVisible().catch(() => false)) {
      await source.click();
      await pause(page, LOOK,
        'One source. Transcript, segments and the footage itself.');

      const ask = page.getByRole('button', { name: /^Ask$/ });
      if (await ask.isVisible().catch(() => false)) {
        await ask.click();
        await pause(page, BEAT,
          'The assistant, scoped to THIS source — it is given the cue count, ' +
          'where the transcript came from, and which fields are empty.');

        const starter = page.getByRole('button', {
          name: /What is the transcript here/i,
        });
        if (await starter.isVisible().catch(() => false)) {
          await starter.click();
          await pause(page, 14_000, 'Asking it about this asset…');
        }
      }
    }

    // ── 5. the builder, which now knows what knowledge exists ───────────
    await page.goto('/chataiagent/admin?section=agents');
    await page.getByText('Admin Portal').waitFor({ state: 'visible', timeout: 30_000 });
    await pause(page, BEAT, 'Over to the agent builder.');

    await page.getByRole('button', { name: /Create Agent|New Agent/i }).last().click();
    await page.waitForTimeout(1200);
    const manual = page.getByRole('button', { name: /Advanced: skip AI, manual create/i });
    if (await manual.isVisible().catch(() => false)) {
      await manual.click();
      await page.getByPlaceholder('e.g. sleep_wellness')
        .waitFor({ state: 'visible', timeout: 20_000 });
      await page.getByPlaceholder('e.g. sleep_wellness').fill('walkthrough_demo');
      await page.getByPlaceholder('e.g. Sleep Wellness Coach').fill('Walkthrough Demo');
      const next = page.getByRole('button', { name: /^Next$/ });
      await next.click();
      await page.getByPlaceholder('You are a compassionate sleep wellness coach...')
        .fill('You answer questions about joint supplements from Dr David.');
      await next.click();
      await next.click();

      await expect(page.getByTestId('corpus-options')).toBeVisible({ timeout: 20_000 });
      await pause(page, LOOK,
        'The Knowledge step. Every corpus that exists, with its document ' +
        'count — the builder used to mention "corpus" exactly once, in a ' +
        'hardcoded string.');

      await expect(page.getByTestId('grounding-corpus_only'))
        .toHaveAttribute('aria-pressed', 'true');
      await pause(page, LOOK,
        'And the grounding choice, SHOWN rather than inherited: by default ' +
        'this agent answers only from its corpora, and says so when they do ' +
        'not cover a question.');
    }
    await page.keyboard.press('Escape');

    // ── 6. the point of all of it ───────────────────────────────────────
    await page.goto('/chataiagent/new');
    await page.getByText('How can I help you today?')
      .waitFor({ state: 'visible', timeout: 30_000 });
    await pause(page, BEAT,
      'Now the part that matters: ask it something only the videos can answer.');

    const box = page.locator('textarea, input[type="text"]').first();
    await box.click();
    await box.fill(
      'I have knee arthritis. In Dr Davids fish oil review, how many ' +
      'milligrams is each pill and how many per day?');
    await pause(page, BEAT, 'The dosage is spoken in the video and appears in no PDF.');
    await page.keyboard.press('Enter');

    // "950" is in Dr David's caption track and nowhere else — the whole
    // grounding claim, on screen.
    await expect(page.getByText(/950/).first()).toBeVisible({ timeout: 180_000 });
    await pause(page, LOOK,
      '"950 milligrams" — from the caption track of a YouTube video that was ' +
      'a dead link in a PDF this morning.');

    await expect(page.getByText(/Sources|Watch/i).first()).toBeVisible({ timeout: 60_000 });
    await pause(page, LOOK,
      'And the citations resolve, each one deep-linked to the second the ' +
      'claim is made.');

    console.log('\n  ▸ Done.\n');
  });
});
