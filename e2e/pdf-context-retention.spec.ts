/**
 * PDF Agent — CONTEXT RETENTION regression suite.
 *
 * REPLAYS A REAL FAILING CONVERSATION (prod chat dbc31c3e). After a successful
 * unlock, the agent had no memory of the file it had just produced, and the
 * next three turns each failed a different way:
 *
 *   [0] "unlock this pdf and share to me password is ..."  → unlocked. OK
 *   [1] "cant see the unlocked pdf , how to download"
 *   [2] "give me the unlocked pdf"
 *         → "Please share the password for the PDF"        ← BUG A: re-asked
 *   [3] "<password again>"
 *         → unlocked a SECOND time, new file               ← BUG C: duplicate
 *   [4] "GIVE ME DOWNLOAD LINK"
 *         → "**Pages:** 87"                                ← BUG B: misrouted
 *
 * THE REPLAY IS COMPRESSED TO THREE MESSAGES. Anonymous users get 3 free
 * messages before a sign-in wall (chat-input.tsx:198), and that wall silently
 * swallows the 4th submit — which is correct product behaviour, not a
 * regression. Three turns still cover all three bugs: A (no password re-ask),
 * B (a link request is not answered with a page count) and C (exactly one file
 * across the conversation). The redundant bare-password turn is covered by
 * tests/test_pdf_agent_context.py::test_unlocking_an_already_unlocked_document_reuses_it.
 *
 * One root cause: each turn was re-derived from the source PDF alone, because
 * nothing recorded that an unlocked artifact already existed. The fix records
 * every produced file in the action ledger (services/action_ledger.py) and adds
 * a `get_artifact` op that hands it back.
 *
 * A FOURTH bug lived on the frontend and is covered here too: the streamed
 * reply was cached in IndexedDB with EMPTY content, and because a "fresh"
 * cache short-circuits the backend fetch, revisiting the chat showed a blank
 * assistant bubble. That is very likely what the user meant by "cant see the
 * unlocked pdf". See `reload` coverage below.
 *
 * Assertions are deliberately NEGATIVE where it counts. "Contains a link" is
 * easy to satisfy by accident; "never asks for the password again" and "never
 * answers a link request with a page count" are the properties that regressed.
 *
 * NOTE ON SELECTORS: the agent marker "[Using pdf agent]" is rendered as a
 * badge, not literal text, and download URLs live in an <a href>, never in
 * textContent. Both are asserted accordingly.
 *
 * Prerequisites:
 *   - Frontend on http://localhost:5173 (npm run dev)
 *   - Backend  on http://localhost:8080 (./start-all.sh)
 *
 * Run:
 *   npx playwright test e2e/pdf-context-retention.spec.ts --project=chromium
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCKED_PDF = path.join(__dirname, 'fixtures', 'locked-document.pdf');
const PASSWORD = '36006250';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function sendMessage(page: Page, text: string) {
  const input = page.locator('textarea').first();
  await input.waitFor({ state: 'visible', timeout: 10_000 });
  await expect(input).toBeEnabled({ timeout: 30_000 });
  // Submitting is genuinely flaky in this flow: on one turn neither Enter nor
  // a single button click registered, which surfaces as "the agent replied
  // with nothing" and blames the wrong component. Retry both mechanisms and
  // treat a cleared textarea as proof the submit landed.
  const send = page.locator('button')
    .filter({ has: page.locator('svg.lucide-arrow-up') }).first();

  for (let attempt = 0; attempt < 3; attempt++) {
    if ((await input.inputValue()).trim() !== text) {
      await input.fill(text);
      await page.waitForTimeout(300);
    }
    if (await send.isEnabled().catch(() => false)) {
      // NOTE: on the 4th turn of this flow a normal click times out on
      // actionability — the send button is enabled and correctly labelled, but
      // something is sitting over it. `force` bypasses the overlay so the
      // regression this test exists for stays testable; the overlay itself is
      // tracked separately as a suspected UI defect, not fixed here.
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
      console.log(`[sendMessage] submit attempt ${attempt + 1} did not register, retrying`);
      await page.waitForTimeout(2000);
    }
  }
  throw new Error(`could not submit message: ${text}`);
}

async function waitForResponse(page: Page, timeoutMs = 120_000) {
  const indicator = page.getByTestId('ai-loading-indicator');
  try {
    await indicator.first().waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    // Indicator may have mounted+unmounted between polls.
  }
  await indicator.first().waitFor({ state: 'detached', timeout: timeoutMs }).catch(async () => {
    await indicator.first().waitFor({ state: 'hidden', timeout: timeoutMs });
  });
  await page.waitForTimeout(1500);
}

async function getChatText(page: Page): Promise<string> {
  const area = page.locator('[data-radix-scroll-area-viewport]').first();
  return (await area.textContent()) || '';
}

/** Distinct file-download URLs the agent has linked so far, read from hrefs. */
async function downloadHrefs(page: Page): Promise<string[]> {
  const links = page.locator('a[href*="/api/v1/files/"][href*="/download"]');
  const hrefs = await links.evaluateAll((els) =>
    els.map((e) => (e as HTMLAnchorElement).href));
  return [...new Set(hrefs)];
}

async function uploadFile(page: Page, filePath: string) {
  const fileInput = page.locator('input[type="file"]#file-upload');
  await fileInput.setInputFiles(filePath);
  await expect(page.locator('button[aria-label*="Remove"]').first())
    .toBeVisible({ timeout: 30_000 });
}

async function sendMessageWithFile(page: Page, filePath: string, message: string) {
  await uploadFile(page, filePath);
  await page.waitForTimeout(800);
  const input = page.locator('textarea').first();
  await input.waitFor({ state: 'visible' });
  await input.fill(message);
  await page.waitForTimeout(300);
  await page.locator('button')
    .filter({ has: page.locator('svg.lucide-arrow-up') })
    .click();
}

/** Send a turn and return ONLY the text that appeared because of it, so an
 *  assertion about turn 4 can't pass on text produced by turn 1. */
async function turn(page: Page, text: string): Promise<string> {
  const before = await getChatText(page);
  await sendMessage(page, text);

  // Length, not substring: one of these turns is the password, which already
  // appears verbatim in turn 1, so `includes(text)` is true before it is sent.
  await expect
    .poll(async () => (await getChatText(page)).length, { timeout: 20_000 })
    .toBeGreaterThanOrEqual(before.length + text.length);

  await waitForResponse(page);

  // The reply can lag the loading indicator by a beat; wait for text to
  // actually grow past the echoed user message.
  await expect
    .poll(async () => (await getChatText(page)).length,
          { timeout: 60_000 })
    .toBeGreaterThan(before.length + text.length);

  const after = await getChatText(page);
  const delta = after.startsWith(before) ? after.slice(before.length) : after;
  return delta.replace(text, '');   // drop the echoed user message
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('PDF Agent — context retention after unlock', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chataiagent/');
    try {
      await page.getByText('Loading authentication').waitFor({ state: 'visible', timeout: 5_000 });
      await page.getByText('Loading authentication').waitFor({ state: 'hidden', timeout: 30_000 });
    } catch {
      // Auth resolved instantly.
    }
    await page.waitForTimeout(2000);
  });

  test('replays the failing sequence: never re-asks, never misroutes, never duplicates', async ({ page }) => {
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);

    // TURN 1 — upload + unlock. This one always worked.
    console.log('\n===== TURN 1: upload + unlock =====\n');
    await sendMessageWithFile(
      page, LOCKED_PDF, `unlock this pdf and share to me password is ${PASSWORD}`);
    await waitForResponse(page);

    expect((await downloadHrefs(page)).length,
      'turn 1 should produce exactly one downloadable file').toBe(1);

    // TURN 2 — "give me the unlocked pdf"   ← the original BUG A turn
    console.log('\n===== TURN 2: give me the unlocked pdf =====\n');
    const t2 = await turn(page, 'give me the unlocked pdf');
    expect(t2.toLowerCase(),
      'BUG A: the file is already unlocked — the password is not needed'
    ).not.toContain('share the password');
    expect(t2.toLowerCase(), 'turn 2 should point at the file')
      .toMatch(/download|unlocked/);

    // TURN 3 — "GIVE ME DOWNLOAD LINK"   ← the original BUG B turn
    console.log('\n===== TURN 3: GIVE ME DOWNLOAD LINK =====\n');
    const t3 = await turn(page, 'GIVE ME DOWNLOAD LINK');
    expect(t3,
      'BUG B: a page count is not an answer to "give me the download link"'
    ).not.toMatch(/Pages:/i);
    expect(t3.toLowerCase(), 'BUG B: must point at the download')
      .toMatch(/download/);

    // BUG C — across the WHOLE conversation, one source unlocked exactly once.
    const hrefs = await downloadHrefs(page);
    console.log(`distinct files linked across the conversation: ${hrefs.length}`);
    expect(hrefs.length,
      `BUG C: the same PDF was unlocked more than once (${hrefs.join(', ')})`
    ).toBe(1);
  });

  test('the reply survives a reload (IndexedDB cache keeps its content)', async ({ page }) => {
    // The streamed reply used to be cached with EMPTY content. Because a
    // "fresh" cache short-circuits the backend fetch, revisiting the chat
    // rendered a blank assistant bubble — the answer appeared to vanish.
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);

    await sendMessageWithFile(
      page, LOCKED_PDF, `unlock this pdf password is ${PASSWORD}`);
    await waitForResponse(page);

    const live = await getChatText(page);
    expect(live.toLowerCase(), 'nothing rendered during streaming')
      .toContain('unlocked');

    await page.reload();
    await page.waitForTimeout(12_000);

    const afterReload = await getChatText(page);
    expect(afterReload.toLowerCase(),
      'the assistant reply is blank after a reload — cached with empty content'
    ).toContain('unlocked');
    expect((await downloadHrefs(page)).length,
      'the download link did not survive the reload').toBeGreaterThan(0);
  });

  test('the download link actually serves an unlocked PDF', async ({ page, request }) => {
    // A link that 404s, or one that hands back a file still needing the
    // password, is invisible to any text assertion. Check the bytes.
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);

    await sendMessageWithFile(
      page, LOCKED_PDF, `unlock this pdf password is ${PASSWORD}`);
    await waitForResponse(page);

    const hrefs = await downloadHrefs(page);
    expect(hrefs.length, 'no download link in the reply').toBeGreaterThan(0);

    const res = await request.get(hrefs[0]);
    expect(res.status(), 'download link should not 404').toBe(200);

    const body = await res.body();
    expect(body.subarray(0, 5).toString(), 'not a PDF').toBe('%PDF-');
    // A still-encrypted PDF carries an /Encrypt dictionary.
    expect(body.includes(Buffer.from('/Encrypt')),
      'the "unlocked" file is still password-protected').toBe(false);
  });
});
