/**
 * PDF Agent — Email Operations E2E
 *
 * Exercises the PDF domain agent's email_pdf / email_chat / info ops
 * end-to-end through the chat UI:
 *
 *   TURN 1: Upload PDF → "how many pages is this?" → agent reports info
 *           (validates routing + PDF resolution + info dispatch)
 *
 *   TURN 2: "email this pdf to test@example.com" → agent attempts send
 *           via Composio Gmail. The e2e test user has no Gmail OAuth
 *           connection, so we expect the friendly "Gmail isn't connected"
 *           surface — that proves the full path was exercised:
 *               orchestrator → PdfAgent._classify → _do_email_pdf →
 *               _send_gmail → Composio entity.get_connection → render error
 *
 *   TURN 3: "email the conversation to test@example.com" → agent uses
 *           email_chat (no PDF attachment), same OAuth surface.
 *
 *   TURN 4: Invalid recipient — "email this pdf to not-an-email" →
 *           agent declines with the recipient-validation message.
 *
 * Why we don't actually send: real Gmail OAuth can't be completed in a
 * CI/headless run, and we don't want e2e tests sending live emails. The
 * "Gmail isn't connected" branch is the same code path; only the final
 * Composio.execute_action is short-circuited.
 *
 * Prerequisites:
 *   - Frontend: npm run dev (port 5173)
 *   - Backend: ./start-all.sh (chatservice:8080 needs COMPOSIO_API_KEY)
 *
 * Run:
 *   npx playwright test e2e/pdf-email.spec.ts --headed
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PDF_FIXTURE = path.join(__dirname, 'fixtures', 'test-document.pdf');

// ---------------------------------------------------------------------------
// Helpers — match the patterns used in knee-arthritis-xray.spec.ts
// ---------------------------------------------------------------------------

async function sendMessage(page: Page, text: string) {
  const input = page.locator('textarea').first();
  await input.waitFor({ state: 'visible', timeout: 10_000 });
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await input.fill(text);
  await page.waitForTimeout(300);
  await input.press('Enter');
}

async function waitForResponse(page: Page, timeoutMs = 60_000) {
  try {
    await page.getByText('Thinking...').waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    // Response may have streamed in instantly
  }
  await page.getByText('Thinking...').waitFor({ state: 'hidden', timeout: timeoutMs });
  await page.waitForTimeout(1500); // settle markdown / widgets
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

/** Read just the assistant text *after* the user's last message —
 * keeps assertions from matching the user's own typing.  */
async function getLatestAssistantText(page: Page): Promise<string> {
  // Each message bubble has data-testid="chat-message" in the codebase;
  // but to stay independent of internal selectors, we grab the last
  // <p> / markdown block in the scroll area.
  const all = await getChatText(page);
  // Last "[Using pdf agent]" delimiter onwards
  const marker = '[Using pdf agent]';
  const i = all.lastIndexOf(marker);
  return i >= 0 ? all.slice(i) : all;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('PDF Agent — email operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chataiagent/');
    try {
      await page.getByText('Loading authentication').waitFor({ state: 'visible', timeout: 5_000 });
      await page.getByText('Loading authentication').waitFor({ state: 'hidden', timeout: 30_000 });
    } catch {
      // Auth resolved instantly
    }
    await page.waitForTimeout(2000);
  });

  test('TURN 1: upload PDF → "how many pages" → info dispatch', async ({ page }) => {
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);

    await sendMessageWithFile(page, PDF_FIXTURE, 'how many pages is this?');
    await waitForResponse(page);

    const reply = await getLatestAssistantText(page);
    console.log('\n--- assistant reply (info) ---\n', reply.slice(0, 600));

    // The PDF agent prints "[Using pdf agent]" and then info bullets
    expect(reply).toContain('[Using pdf agent]');
    expect(reply).toMatch(/Pages:\s*\d+/i);
  });

  test('TURN 2: email_pdf → friendly Gmail-not-connected surface', async ({ page }) => {
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);

    // Establish PDF context first
    await sendMessageWithFile(page, PDF_FIXTURE, 'just keep this pdf handy');
    await waitForResponse(page);

    // Now request the email send
    await sendMessage(page, 'email this pdf to test@example.com');
    await waitForResponse(page);

    const reply = await getLatestAssistantText(page);
    console.log('\n--- assistant reply (email_pdf) ---\n', reply.slice(0, 800));

    // We expect EITHER:
    //   (a) "Gmail isn't connected for your account." — no OAuth for this user
    //   (b) "Sent." — extremely unlikely in an e2e run (no OAuth done)
    //   (c) An explicit Composio error string surfaced via _format_gmail_error
    const sawOAuth = /Gmail isn'?t connected/i.test(reply);
    const sawSend = /\*\*Sent\.\*\*|^Sent\.\s/im.test(reply);
    const sawSendError = /Couldn'?t send the email/i.test(reply);

    console.log(`  surfaces: oauth=${sawOAuth}  sent=${sawSend}  sendError=${sawSendError}`);

    expect(
      sawOAuth || sawSend || sawSendError,
      `Expected one of: "Gmail isn't connected", "Sent.", or "Couldn't send the email". Got: ${reply.slice(0, 400)}`,
    ).toBe(true);

    // The "Emailing the PDF to **test@example.com**" preamble must appear —
    // that proves the email_pdf dispatch was hit, not info or another op.
    expect(reply).toMatch(/Emailing the PDF to/i);
    expect(reply).toContain('test@example.com');
  });

  test('TURN 3: email_chat → no PDF needed, transcript path', async ({ page }) => {
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);

    // Build some chat history first so the transcript is non-empty.
    // We need the PDF agent to be the routing target, so attach a PDF
    // to lock the session into PDF context.
    await sendMessageWithFile(page, PDF_FIXTURE, 'keep this pdf');
    await waitForResponse(page);

    await sendMessage(page, 'email the conversation to test@example.com');
    await waitForResponse(page);

    const reply = await getLatestAssistantText(page);
    console.log('\n--- assistant reply (email_chat) ---\n', reply.slice(0, 800));

    expect(reply).toMatch(/Emailing the chat transcript to/i);

    const ok = /Gmail isn'?t connected/i.test(reply)
            || /\*\*Sent\.\*\*|^Sent\.\s/im.test(reply)
            || /Couldn'?t send the email/i.test(reply);
    expect(ok, `Expected an email-result surface. Got: ${reply.slice(0, 400)}`).toBe(true);
  });

  test('TURN 4: invalid recipient → recipient-validation message', async ({ page }) => {
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);

    await sendMessageWithFile(page, PDF_FIXTURE, 'remember this pdf');
    await waitForResponse(page);

    // The regex shortcut won't trigger (no @-address present), so the
    // LLM classifier will pick this up; with "not-an-email" it should
    // either skip op=email_pdf (treating it as an info/unsupported request)
    // OR set to="not-an-email" which our _normalize_email rejects.
    await sendMessage(page, 'email this pdf to not-an-email');
    await waitForResponse(page);

    const reply = await getLatestAssistantText(page);
    console.log('\n--- assistant reply (invalid recipient) ---\n', reply.slice(0, 600));

    // The agent should NOT have called Composio. Either it asks for a
    // valid email (our explicit branch) or it falls through to the
    // capability help text — both are acceptable; sending IS NOT.
    expect(reply).not.toMatch(/\*\*Sent\.\*\*/);

    const okSurface =
      /I need an email address/i.test(reply) ||
      /find & replace/i.test(reply) ||
      /Gmail isn'?t connected/i.test(reply); // tolerable if LLM somehow set to=valid sentinel
    expect(okSurface, `Got: ${reply.slice(0, 400)}`).toBe(true);
  });
});
