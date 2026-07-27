/**
 * "✨ suggest" — Tool Integrator AI mapping — E2E
 *
 *   TEST 1: the suggest button renders in the manual-mapping form
 *   TEST 2: suggest prefills transport + action and shows the rationale
 *   TEST 3: suggest is disabled without a tool id
 *   TEST 4: a suggester error surfaces to the user (no silent failure)
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * This feature shipped in fc22439 and was silently deleted by 38e1eba while
 * the Integrations panel was being restructured. The import and the `hint`
 * state were left dangling, so ESLint warned — but warnings don't fail CI and
 * nobody looked. The sibling "Draft with AI" button survived the same refactor
 * for exactly one reason: it had e2e/loops-draft-with-ai.spec.ts guarding it.
 *
 * So: a lint rule catches the dangling reference, but only a test catches the
 * missing button. Keep this test.
 *
 * The POST /admin/loops/integrations/suggest call is intercepted so tests are
 * deterministic and never spend a real LLM call.
 *
 * Prerequisites: npm run dev (5173) + chatservice docker (8080), admin user.
 * Run: npx playwright test e2e/loops-suggest-mapping.spec.ts
 */

import { test, expect, Page } from '@playwright/test';

const ADMIN_EMAIL = 'ravipradeep89@gmail.com';
const ADMIN_PASSWORD = 'papa1210';

const MOCK_SUGGESTION = {
  transport: 'composio' as const,
  composio_action: 'GMAIL_SEND_EMAIL',
  rationale: 'This tool sends email to a single recipient, which maps cleanly onto Gmail.',
  field_notes: 'to → recipient_email, subject → subject, body → body',
};

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

/**
 * Sign in and open the top-level Integrations section, then expand the manual
 * mapping form. Note "Integrations" appears twice in the DOM (the section
 * switcher tab, and a toggle inside Verified Procedures) — .first() is the
 * section-switcher tab.
 */
async function openManualMappingForm(page: Page) {
  await signInAsAdmin(page);
  await page.goto('/chataiagent/admin');
  const tab = page.getByRole('button', { name: 'Integrations', exact: true }).first();
  await tab.waitFor({ state: 'visible', timeout: 15_000 });
  await tab.click();
  await expect(page.getByText('Tool Integrator')).toBeVisible({ timeout: 10_000 });
  // The manual mapping form lives behind a <details> disclosure.
  await page.getByText('Map a tool manually', { exact: false }).click();
}

test.describe('Loops — ✨ suggest mapping', () => {

  test('TEST 1: the suggest button renders in the manual-mapping form', async ({ page }) => {
    await openManualMappingForm(page);
    await expect(page.getByRole('button', { name: /suggest/i })).toBeVisible();
  });

  test('TEST 2: suggest prefills transport + action and shows the rationale', async ({ page }) => {
    await page.route('**/loops/integrations/suggest', async (route) => {
      // Confirm the frontend actually sent the tool id it collected.
      const payload = route.request().postDataJSON?.() ?? {};
      expect(String(payload.tool || '')).toBe('send_reminder_email');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SUGGESTION),
      });
    });

    await openManualMappingForm(page);
    await page.getByPlaceholder(/tool id/).fill('send_reminder_email');
    await page.getByRole('button', { name: /suggest/i }).click();

    // Transport flipped to composio, so the action input appears, prefilled.
    await expect(page.getByPlaceholder(/Composio action slug/))
      .toHaveValue('GMAIL_SEND_EMAIL', { timeout: 10_000 });
    // …and the model's reasoning is shown rather than discarded.
    await expect(page.getByText(/maps cleanly onto Gmail/)).toBeVisible();
    await expect(page.getByText(/to → recipient_email/)).toBeVisible();
  });

  test('TEST 3: suggest is disabled without a tool id', async ({ page }) => {
    await openManualMappingForm(page);
    const btn = page.getByRole('button', { name: /suggest/i });
    await expect(btn).toBeDisabled();                       // empty tool id
    await page.getByPlaceholder(/tool id/).fill('a');        // <2 chars
    await expect(btn).toBeDisabled();
    await page.getByPlaceholder(/tool id/).fill('slack_post');
    await expect(btn).toBeEnabled();
  });

  test('TEST 4: a suggester error surfaces to the user', async ({ page }) => {
    await page.route('**/loops/integrations/suggest', (route) =>
      route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'suggester returned unparseable JSON' }),
      }));

    await openManualMappingForm(page);
    await page.getByPlaceholder(/tool id/).fill('slack_post');
    await page.getByRole('button', { name: /suggest/i }).click();
    await expect(page.getByText(/unparseable JSON/)).toBeVisible({ timeout: 10_000 });
  });
});
