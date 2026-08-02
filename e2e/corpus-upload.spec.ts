/**
 * CUJ 2 — upload an asset and watch it actually get processed.
 *
 * Uploads a REAL video from the Dr David library, so this exercises the whole
 * canonical pipeline: fingerprint, artifact lookup, transcription (or reuse),
 * span proposal, document creation.
 *
 * WHAT IT IS REALLY TESTING is the reuse branch. Transcription is a property
 * of the FOOTAGE, not of the corpus holding it — so uploading a file this
 * platform has already seen must cost nothing and say so. Three of the 49
 * files in that folder are byte-identical pairs, so this is not hypothetical.
 *
 * Paced with visible pauses so it can be watched:
 *   npx playwright test e2e/corpus-upload.spec.ts --headed --project=chromium
 */

import { existsSync } from 'fs';
import { expect, Page, test } from '@playwright/test';

const ADMIN_EMAIL = 'ravipradeep89@gmail.com';
const ADMIN_PASSWORD = 'papa1210';

const VIDEO_DIR = '/Users/ravipradeep/Desktop/projectknee/drdavid/videos';
// A NARRATED video: the pipeline's transcription branch only exists for these.
// (6) is the smallest file but is music-only, and picking it first is how the
// blind-transcription bug was found — Whisper hallucinated two segments of
// lyrics over the soundtrack.
const VIDEO = `${VIDEO_DIR}/El_Paso_Manual_Physical_Therapy (10).mp4`;
// Music-only, at -9.3 dB — loud enough that a naive silence check passes.
const SILENT_VIDEO = `${VIDEO_DIR}/El_Paso_Manual_Physical_Therapy (6).mp4`;

const CORPUS = `upload_demo_${Date.now().toString().slice(-6)}`;

/** Long enough to read what changed on screen. */
const WATCH = 5_000;

async function signInAsAdmin(page: Page) {
  await page.goto('/chataiagent/');
  await page.waitForTimeout(3000);
  if (await page.getByText('How can I help you today?').isVisible().catch(() => false)) return;
  await page.getByText('Continue with Email').click();
  await page.waitForTimeout(500);
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').filter({ hasText: /Sign In/i }).click();
  await page.getByText('How can I help you today?').waitFor({ state: 'visible', timeout: 20_000 });
}

test.describe('CUJ 2 — upload starts the pipeline', () => {
  test.describe.configure({ mode: 'serial' });

  test('the source videos exist to upload', async () => {
    // Asserted rather than assumed: a missing file would otherwise surface as
    // an opaque Playwright timeout twenty seconds later.
    expect(existsSync(VIDEO), `${VIDEO} not found`).toBe(true);
    expect(existsSync(SILENT_VIDEO), `${SILENT_VIDEO} not found`).toBe(true);
  });

  test('uploading a real video creates a corpus document', async ({ page }) => {
    test.setTimeout(300_000);   // transcription is minutes, not seconds

    await signInAsAdmin(page);
    await page.goto('/chataiagent/admin?section=corpus');
    await page.getByText('Admin Portal').waitFor({ state: 'visible', timeout: 20_000 });
    await page.getByRole('button', { name: /New corpus/i }).first().click();

    // A corpus with a purpose — CUJ 1 first, because there is nowhere to put
    // an asset until a corpus exists.
    await page.getByRole('button', { name: 'Create corpus' }).click();
    await page.locator('input[placeholder="Knee Rehabilitation"]').fill(CORPUS);
    await page.locator('textarea').first().fill(
      'Demonstrate that uploading a video starts the processing pipeline.');
    await page.waitForTimeout(WATCH);          // ← watch the form
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(page.locator('select').first())
      .toHaveValue(new RegExp(CORPUS), { timeout: 20_000 });
    await page.waitForTimeout(WATCH);          // ← watch the corpus appear

    // The Add video control lives on the source view, because ingest acts on
    // a SOURCE and not on an extracted item.
    const addButton = page.getByRole('button', { name: /Add video/i });
    await addButton.waitFor({ state: 'visible', timeout: 20_000 });
    await page.waitForTimeout(WATCH);          // ← watch the empty corpus

    await page.locator('[data-testid="add-asset-input"]').setInputFiles(VIDEO);

    // "Processing…" proves the upload STARTED something. Upload used to store
    // nothing and start nothing, which is the whole defect this closes.
    await expect(page.getByRole('button', { name: /Processing/i }))
      .toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(WATCH);          // ← watch it working

    // Then the result: timed segments and a document, reported on screen.
    await expect(page.getByText(/timed segments,\s*\d+ document/i))
      .toBeVisible({ timeout: 240_000 });
    await page.waitForTimeout(WATCH);          // ← read the result

    // And the source list now has it.
    await expect(page.getByText(/1 sources · 1 items/)).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(WATCH);          // ← see it in the list
  });

  test('uploading the SAME footage again reuses the transcript', async ({ page }) => {
    test.setTimeout(300_000);

    await signInAsAdmin(page);
    await page.goto('/chataiagent/admin?section=corpus');
    await page.getByText('Admin Portal').waitFor({ state: 'visible', timeout: 20_000 });
    await page.getByRole('button', { name: /New corpus/i }).first().click();
    await page.locator('select').first().selectOption(CORPUS);
    await page.waitForTimeout(WATCH);

    await page.locator('[data-testid="add-asset-input"]').setInputFiles(VIDEO);

    // THE ASSERTION THAT MATTERS. Transcription is a property of the footage,
    // not of the corpus, so the second upload must cost nothing and say so.
    await expect(page.getByText(/Transcript reused/i))
      .toBeVisible({ timeout: 120_000 });
    await page.waitForTimeout(WATCH);          // ← read "Transcript reused"
  });

  test('music-only footage is refused rather than hallucinated over',
    async ({ page }) => {
      test.setTimeout(300_000);

      // THE BUG THIS TEST EXISTS FOR. 26 of the 49 files are music-only at
      // -9.3 dB — loud, not silent, so a naive check passes and Whisper writes
      // lyrics into a "transcript". Garbage that looks like a transcript is
      // worse than none, because nothing downstream can tell.
      await signInAsAdmin(page);
      await page.goto('/chataiagent/admin?section=corpus');
      await page.getByText('Admin Portal').waitFor({ state: 'visible', timeout: 20_000 });
      await page.getByRole('button', { name: /New corpus/i }).first().click();
      await page.locator('select').first().selectOption(CORPUS);
      await page.waitForTimeout(WATCH);

      await page.locator('[data-testid="add-asset-input"]').setInputFiles(SILENT_VIDEO);

      await expect(page.getByText(/contains no speech|has no speech/i))
        .toBeVisible({ timeout: 240_000 });
      await page.waitForTimeout(WATCH);        // ← read the refusal
    });
});
