/**
 * "Draft with AI" — Verified Procedures create flow — E2E
 *
 *   TEST 1: Draft-with-AI box renders in the create panel
 *   TEST 2: A goal drafts a full SOP into the textarea (API mocked) + enables Compile
 *   TEST 3: Draft button is disabled for a too-short goal
 *   TEST 4: A drafter error surfaces to the user (no silent failure)
 *
 * The POST /admin/loops/draft-sop call is intercepted so tests are deterministic
 * and never spend a real LLM call.
 *
 * Prerequisites: npm run dev (5173) + chatservice docker (8080), admin user.
 * Run: npx playwright test e2e/loops-draft-with-ai.spec.ts
 */

import { test, expect, Page } from '@playwright/test';

const ADMIN_EMAIL = 'ravipradeep89@gmail.com';
const ADMIN_PASSWORD = 'papa1210';

const MOCK_SOP =
  'Every Friday at 9am, list all clients with unpaid invoices older than 30 days. ' +
  'Draft a polite reminder email for each. Show me the drafts for approval before ' +
  'sending. Once approved, email each client. Done when every overdue client has ' +
  'been emailed. Then send me a Slack summary of who was contacted.';

async function signInAsAdmin(page: Page) {
  await page.goto('/chataiagent/');
  await page.waitForTimeout(3000);
  const alreadyLoggedIn = await page
    .getByText('How can I help you today?').isVisible().catch(() => false);
  if (!alreadyLoggedIn) {
    const emailButton = page.getByText('Continue with Email');
    await emailButton.waitFor({ state: 'visible', timeout: 10_000 });
    await emailButton.click();
    await page.waitForTimeout(500);
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').filter({ hasText: /Sign In/i }).click();
    await page.waitForTimeout(5000);
  }
}

/** Sign in, open Verified Procedures, and open the "New from SOP" create panel. */
async function openCreatePanel(page: Page) {
  await signInAsAdmin(page);
  await page.goto('/chataiagent/admin');
  const tab = page.getByRole('button', { name: 'Verified Procedures' });
  await tab.waitFor({ state: 'visible', timeout: 15_000 });
  await tab.click();
  await page.getByRole('button', { name: /New from SOP/ }).click();
  await expect(page.getByText('Describe the procedure', { exact: false }))
    .toBeVisible({ timeout: 10_000 });
}

test.describe('Loops — Draft with AI', () => {

  test('TEST 1: the Draft-with-AI box renders in the create panel', async ({ page }) => {
    await openCreatePanel(page);
    await expect(page.getByText('Draft with AI', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder(/What should this procedure do/)).toBeVisible();
  });

  test('TEST 2: a goal drafts a full SOP into the textarea and enables Compile', async ({ page }) => {
    // Intercept the drafter call → deterministic SOP, no real LLM spend.
    await page.route('**/loops/draft-sop', async (route) => {
      // Confirm the frontend actually sent the goal it collected.
      const payload = route.request().postDataJSON?.() ?? {};
      expect(String(payload.goal || '')).toContain('overdue invoices');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'drafted', sop: MOCK_SOP }),
      });
    });

    await openCreatePanel(page);

    const sopBox = page.locator('textarea');
    await expect(sopBox).toHaveValue('');   // empty before drafting

    await page.getByPlaceholder(/What should this procedure do/)
      .fill('chase overdue invoices every Friday');
    await page.getByRole('button', { name: 'Draft', exact: true }).click();

    // The drafted SOP lands in the editable textarea…
    await expect(sopBox).toHaveValue(MOCK_SOP, { timeout: 10_000 });
    // …and the now-populated SOP (>20 chars) enables Compile & save.
    await expect(page.getByRole('button', { name: /Compile & save draft/ }))
      .toBeEnabled();
  });

  test('TEST 3: Draft is disabled for a too-short goal', async ({ page }) => {
    await openCreatePanel(page);
    const draftBtn = page.getByRole('button', { name: 'Draft', exact: true });
    await expect(draftBtn).toBeDisabled();                 // empty goal
    await page.getByPlaceholder(/What should this procedure do/).fill('hi');  // <5 chars
    await expect(draftBtn).toBeDisabled();
    await page.getByPlaceholder(/What should this procedure do/).fill('email overdue clients');
    await expect(draftBtn).toBeEnabled();
  });

  test('TEST 4: a drafter error surfaces to the user', async ({ page }) => {
    await page.route('**/loops/draft-sop', (route) =>
      route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Draft failed (retry): drafter returned an empty/too-short SOP' }),
      }));

    await openCreatePanel(page);
    await page.getByPlaceholder(/What should this procedure do/).fill('do something vague');
    await page.getByRole('button', { name: 'Draft', exact: true }).click();

    await expect(page.getByText(/Draft failed/)).toBeVisible({ timeout: 10_000 });
    // Textarea stays empty — no partial/garbage draft written on failure.
    await expect(page.locator('textarea')).toHaveValue('');
  });
});
