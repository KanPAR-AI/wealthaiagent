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

    // SUBMIT IT. That textarea is the interview ANSWER box — `purpose` is set
    // when the answer is sent, not as you type. Filling it and reaching
    // straight for Continue left the button disabled with its own tooltip
    // explaining why, twice.
    await page.getByRole('button', { name: /Send answer/i }).click();
    await page.waitForTimeout(6000);
    await pause(page, BEAT, 'The assistant reads it back as areas it would index.');

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

    // ── 3. through the wizard ───────────────────────────────────────────
    // Continue lives OUTSIDE the tabs now — it used to be nested inside the
    // Upload Files branch, so adding by link left no way forward at all.
    await page.getByTestId("sources-continue").click();
    await pause(page, BEAT, "Sources done. The schema step reads the media.");

    // Schema, then Review. Both are one button; the review one says "Publish
    // anyway" when it has a reason to object, which is still the way forward.
    for (const label of [/^Continue →$/, /Continue →|Publish anyway →/]) {
      const b = page.getByRole("button", { name: label }).first();
      await b.waitFor({ state: "visible", timeout: 300_000 });
      // ENABLED, not just present. Both buttons are disabled while their step
      // does its work — the schema step reads the media and proposes fields,
      // which outlasts the 20s action timeout that exists to catch typos.
      // Waiting on the element and waiting on the WORK are different things
      // and need different budgets.
      await expect(b).toBeEnabled({ timeout: 600_000 });
      await b.click();
      await page.waitForTimeout(2500);
    }
    await pause(page, BEAT, "Reviewed.");

    // ── 4. publish ──────────────────────────────────────────────────────
    // EXACT. The stepper renders "5 Publish" as a button too, and a regex
    // ending in /Publish$/ matches both — strict mode then refuses to act
    // rather than picking one, which is the correct behaviour and the reason
    // the ambiguity surfaced at all.
    const publish = page.getByRole("button", { name: "Publish", exact: true });
    await publish.waitFor({ state: "visible", timeout: 120_000 });
    await publish.click();
    await pause(page, BEAT,
      "Embedding every chunk, writing the vectors, then PROVING an agent can " +
      "retrieve. An indeterminate bar, because nobody measured this.");

    await expect(
      page.getByText(/Published|Nothing was published/i).first(),
    ).toBeVisible({ timeout: 900_000 });
    await pause(page, LOOK, "Outcome reported, held-back census and all.");

    // ── 5. give it a reader ─────────────────────────────────────────────
    // The corpus is indexed and verified and STILL cannot answer anything
    // until something subscribes. That step had no control at all this
    // morning; the wizard printed advice next to nothing that could act on it.
    const picker = page.getByTestId("readers-options");
    await picker.waitFor({ state: "visible", timeout: 60_000 });
    await pause(page, LOOK,
      "Indexed, verified — and unreachable until an agent subscribes.");

    // Draft one FROM this corpus rather than hunting for an existing agent
    // that happens to fit. Everything the draft needs is already here.
    const make = page.getByTestId("create-agent-for-corpus");
    await make.click();
    await expect(page.getByText(/created as a draft and subscribed/i))
      .toBeVisible({ timeout: 300_000 });
    await pause(page, LOOK,
      "An agent drafted from the corpus's own purpose and content, and " +
      "subscribed. It answers only from here.");

    console.log(`\n  ▸ Done. Corpus "${NAME}" is published and has a reader.\n`);
  });
});
