/**
 * The whole journey, in the real UI, from nothing: create a corpus → add a
 * YouTube video → extract → subscribe an agent → ask it a question.
 *
 * Built to be RUN HEADED and watched:
 *   npx playwright test e2e/full-journey.spec.ts --headed --project=chromium
 *
 * Every other spec starts from `knee_timed`, which already exists and is
 * already published. This one starts from an empty corpus, so it exercises the
 * parts nothing else touches: the purpose interview, the YouTube tab, the
 * schema step, publishing a corpus that has never been published, and binding
 * an agent to a corpus created minutes earlier.
 *
 * It asserts at every stop. A tour that only clicked around would glide over a
 * broken screen and look fine on video — which is exactly the failure mode
 * this codebase produces.
 */

import { expect, Page, test } from '@playwright/test';

const ADMIN_EMAIL = 'ravipradeep89@gmail.com';
const ADMIN_PASSWORD = 'papa1210';
const VIDEO = 'https://www.youtube.com/watch?v=bcM9dP_uXJU';

const RUN = Date.now().toString().slice(-6);
const NAME = `Journey ${RUN}`;

const BEAT = 2000;
const LOOK = 3200;

async function pause(page: Page, ms: number, say: string) {
  console.log(`\n  ▸ ${say}`);
  await page.waitForTimeout(ms);
}

test.use({
  launchOptions: { slowMo: 300 },
  viewport: { width: 1440, height: 900 },
  // A SELECTOR that never resolves must fail in seconds, not inherit the test
  // timeout. The first run of this spec waited on a button labelled "Create
  // corpus" that does not exist on the dashboard, and the 30-minute test
  // budget — which is there for genuinely slow WORK like transcription —
  // became the ceiling for a typo. It looked like a hang and it was a lookup.
  actionTimeout: 20_000,
});

test.describe('Full journey', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(1_800_000);

  test('corpus → video → extract → agent → chat', async ({ page }) => {
    // ── sign in ─────────────────────────────────────────────────────────
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

    await page.goto('/chataiagent/admin?section=corpus');
    await page.getByText('Admin Portal').waitFor({ state: 'visible', timeout: 30_000 });
    await pause(page, BEAT, 'Corpus Studio. Starting from nothing.');

    // ── 1. create ───────────────────────────────────────────────────────
    // "New corpus" on the dashboard — "Create corpus" is the button inside a
    // corpus, which is a different screen entirely.
    await page.getByRole('button', { name: /New corpus/i }).first().click();
    await page.getByPlaceholder(/an assistant that recommends/i)
      .waitFor({ state: 'visible', timeout: 30_000 });
    await pause(page, BEAT, 'Step 1 is the PURPOSE — everything downstream reads it.');

    await page.getByPlaceholder(/an assistant that recommends/i).fill(
      'Answer questions about joint supplements and topical pain relief for ' +
      'knee arthritis, using what the reviewer actually says on camera.');
    await pause(page, BEAT, 'Stated as an outcome, not a topic list.');

    // NAME FIRST. The continue button is disabled until both a name and a
    // purpose exist — it says so in its own tooltip — and the previous run
    // spent twenty seconds trying to click it before filling the field it was
    // waiting for. The name box lives in the preview sidebar, always
    // rendered, so there is nothing to wait for.
    // EXACT. getByPlaceholder does substring matching, so 'Knee Rehab' also
    // matched the legacy create form's 'Knee Rehabilitation' — two elements,
    // strict-mode violation. It also explains the previous run: isVisible()
    // THREW on the ambiguity and my .catch(() => false) swallowed it into
    // "not visible", which sent the test off clicking a disabled button.
    const nameBox = page.getByPlaceholder('Knee Rehab', { exact: true });
    await nameBox.waitFor({ state: 'visible', timeout: 30_000 });
    await nameBox.fill(NAME);
    await pause(page, BEAT, 'Named. The continue button unlocks once both exist.');

    // EXACTLY this button. The previous run used /Create|Continue/i with
    // .first(), which matched the page HEADER's "Create Agent" and opened the
    // agent builder on top of the corpus wizard — while the narration happily
    // announced "Created. On to sources." A broad regex plus .first() is a
    // guess dressed up as a selector.
    const cont = page.getByRole('button', { name: /Looks good, continue/i });
    await expect(cont).toBeEnabled({ timeout: 30_000 });
    await cont.click();
    await page.waitForTimeout(4000);
    await pause(page, LOOK, 'Created. On to sources.');

    // ── 2. add the video ────────────────────────────────────────────────
    const ytTab = page.getByRole('button', { name: /YouTube Links/i });
    await ytTab.waitFor({ state: 'visible', timeout: 30_000 });
    await ytTab.click();
    await pause(page, BEAT,
      'The YouTube tab — disabled until today, because the only ingest that ' +
      'existed wrote documents this pipeline could not read.');

    await page.getByTestId('youtube-url').fill(VIDEO);
    await pause(page, BEAT, 'One link. No file, no upload.');
    await page.getByTestId('youtube-add').click();

    // Captions in seconds; no captions means transcribing the audio, minutes.
    await expect(page.getByTestId('youtube-added')).toBeVisible({ timeout: 900_000 });
    await pause(page, LOOK,
      'Added — it says which rung of the cascade answered, and how many ' +
      'passages the transcript was split into.');

    // ── 3. schema + publish ─────────────────────────────────────────────
    for (const label of [/^Next$/, /^Continue$/, /Skip/]) {
      const b = page.getByRole('button', { name: label }).first();
      if (await b.isVisible().catch(() => false)) {
        await b.click();
        await page.waitForTimeout(2500);
      }
    }
    await pause(page, BEAT, 'Through the schema step.');

    const publish = page.getByRole('button', { name: /^Publish$/ });
    await publish.waitFor({ state: 'visible', timeout: 60_000 });
    await publish.click();
    await pause(page, BEAT,
      'Publishing: embed every chunk, write the vectors, then PROVE an agent ' +
      'can retrieve — an indeterminate bar, because nobody measured this.');

    await expect(page.getByText(/Published|Nothing was published/i).first())
      .toBeVisible({ timeout: 900_000 });
    await pause(page, LOOK, 'Outcome reported, held-back census and all.');

    // ── 4. bind an agent ────────────────────────────────────────────────
    const picker = page.getByTestId('readers-options');
    await picker.waitFor({ state: 'visible', timeout: 60_000 });
    await pause(page, LOOK,
      'And the binding step, on the same screen — "no agent subscribes to ' +
      'this corpus" is the warning, and the fix is right under it.');

    const reader = page.getByTestId('reader-knee_arthritis');
    await reader.click();
    await page.getByTestId('save-readers').click();
    await expect(page.getByTestId('readers-saved')).toBeVisible({ timeout: 30_000 });
    await pause(page, LOOK, 'Subscribed. The corpus is now reachable.');

    // ── 5. ask it something ─────────────────────────────────────────────
    await page.goto('/chataiagent/new');
    await page.getByText('How can I help you today?')
      .waitFor({ state: 'visible', timeout: 30_000 });
    await pause(page, BEAT, 'Now ask the agent about it.');

    const box = page.locator('textarea, input[type="text"]').first();
    await box.click();
    await box.fill(
      'I have knee arthritis. What does the reviewer say in this video about ' +
      'the product — is it worth using, and how should I use it?');
    await page.keyboard.press('Enter');

    await expect(page.getByText(/Sources|Watch|reviewer|Dr\.? David/i).first())
      .toBeVisible({ timeout: 300_000 });
    await pause(page, LOOK,
      'Answered from a corpus that did not exist when this run started.');

    console.log(`\n  ▸ Done. Corpus "${NAME}" is live and subscribed.\n`);
  });
});
