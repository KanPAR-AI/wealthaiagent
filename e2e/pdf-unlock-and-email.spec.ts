/**
 * PDF Agent — UNLOCK then EMAIL, live end-to-end.
 *
 * Verifies the full real-world flow:
 *   1. Upload a password-protected PDF (`fixtures/locked-document.pdf`,
 *      password "36006250" — a real file the user provided).
 *   2. "unlock this pdf password is 36006250" → PDF agent's
 *      `remove_password` op decrypts the file via pikepdf and returns
 *      a downloadable, unlocked copy.
 *   3. "email this pdf to ravi.ismystery@gmail.com" → PDF agent's
 *      `email_pdf` op attaches the (now-active, unlocked) PDF and sends
 *      it through Composio Gmail (`GMAIL_SEND_EMAIL`).
 *
 * Prerequisites the harness expects:
 *   - Frontend on http://localhost:5173 (Vite dev server)
 *   - Backend on http://localhost:8080 (chatservice in Docker)
 *   - SKIP_AUTH=true AND SKIP_AUTH_USER_ID=local_test on the
 *     chatservice container so we authenticate as the Composio entity
 *     whose Gmail OAuth has been completed.
 *   - The `local_test` entity must have an ACTIVE Gmail connection.
 *
 * Note: this test SENDS A REAL EMAIL. The destination is the fixed
 * address the user supplied. If you fork this test for a different
 * recipient, change RECIPIENT below.
 *
 * Run with:
 *   npx playwright test e2e/pdf-unlock-and-email.spec.ts --project=chromium --headed
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCKED_PDF = path.join(__dirname, 'fixtures', 'locked-document.pdf');
const PASSWORD = '36006250';
const RECIPIENT = 'ravi.ismystery@gmail.com';

// ---------------------------------------------------------------------------
// Helpers (same shape as pdf-email.spec.ts)
// ---------------------------------------------------------------------------

async function sendMessage(page: Page, text: string) {
  const input = page.locator('textarea').first();
  await input.waitFor({ state: 'visible', timeout: 10_000 });
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await input.fill(text);
  await page.waitForTimeout(300);
  await input.press('Enter');
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
  const scrollArea = page.locator('[data-radix-scroll-area-viewport]').first();
  return (await scrollArea.textContent()) || '';
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
  const sendButton = page.locator('button').filter({
    has: page.locator('svg.lucide-arrow-up'),
  });
  await sendButton.click();
}

/** Slice the full chat-area text to "everything after the Nth occurrence
 *  of the PDF-agent marker", which is the canonical first line each
 *  PDF-agent turn emits. */
function sliceAfterNthPdfMarker(text: string, n: number): string {
  const marker = '[Using pdf agent]';
  let pos = -1;
  for (let i = 0; i < n; i++) {
    pos = text.indexOf(marker, pos + 1);
    if (pos === -1) return '';
  }
  return text.slice(pos);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('PDF Agent — unlock then email (live delivery)', () => {
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

  test('upload → unlock → email (real Gmail send)', async ({ page }) => {
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);

    // -----------------------------------------------------------------
    // TURN 1 — Upload locked PDF and request unlock.
    // -----------------------------------------------------------------
    console.log('\n========== TURN 1: UPLOAD + UNLOCK ==========\n');
    await sendMessageWithFile(
      page,
      LOCKED_PDF,
      `unlock this pdf password is ${PASSWORD}`,
    );
    await waitForResponse(page, 120_000);

    const after1 = sliceAfterNthPdfMarker(await getChatText(page), 1);
    console.log('--- TURN 1 reply ---\n', after1.slice(0, 600));

    // The unlock dispatch yields a success message containing the
    // exact phrase "Password removed." and a download link the user can
    // click. If the PDF wasn't actually decrypted (wrong password,
    // wrong file, GCS lookup failed), the agent says so explicitly.
    expect(after1).toMatch(/Password removed/i);
    expect(after1).toMatch(/Download the unlocked PDF/i);
    expect(after1).not.toMatch(/didn'?t decrypt|wrong password|Couldn'?t unlock/i);

    // -----------------------------------------------------------------
    // TURN 2 — Email the (now-unlocked) PDF to the fixed recipient.
    // The PDF agent should resolve the MOST RECENT PDF in the chat,
    // which is the unlocked copy just uploaded by `_upload_result`.
    // -----------------------------------------------------------------
    console.log('\n========== TURN 2: EMAIL THROUGH COMPOSIO GMAIL ==========\n');
    await sendMessage(page, `email this pdf to ${RECIPIENT}`);
    await waitForResponse(page, 180_000);

    const after2 = sliceAfterNthPdfMarker(await getChatText(page), 2);
    console.log('--- TURN 2 reply ---\n', after2.slice(0, 800));

    // The PDF agent prints "Emailing the PDF to **<addr>**…" as the
    // first line of the dispatch — proves we hit `_do_email_pdf`.
    expect(after2).toMatch(/Emailing the PDF to/i);
    expect(after2).toContain(RECIPIENT);

    // On a successful Composio round-trip the agent yields "**Sent.**".
    // Markdown is rendered to plain text in the chat scroll-area, so we
    // look for "Sent. The PDF was emailed to <addr>" — the exact phrase
    // from `_do_email_pdf`'s success path. Failure modes (Gmail not
    // connected, SDK error) are explicit, so a missing send is caught.
    expect(after2).toMatch(/Sent\.\s*The PDF was emailed to/i);
    expect(after2).not.toMatch(/Gmail isn'?t connected|Couldn'?t send the email/i);
  });
});
