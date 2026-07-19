/**
 * Verified Procedures (Loops) admin — E2E
 *
 *   TEST 1: Dashboard — overview cards + loop list render
 *   TEST 2: Loop detail — all sections render (procedure, evals, prompts, ops, runs)
 *   TEST 3: Eval case editor — add a case, then delete it (flywheel editing)
 *   TEST 4: Operations quick-edit — change budget → save → version bumps
 *   TEST 5: Integrations — add a webhook mapping, see it listed, delete it
 *   TEST 6: Version history — versions listed, current marked
 *   TEST 7: Run & watch — live timeline runs a dry run to a verdict
 *
 * Prerequisites: npm run dev (5173) + chatservice docker (8080), admin user.
 * Run: npx playwright test e2e/loops-admin.spec.ts
 */

import { test, expect, Page } from '@playwright/test';

const ADMIN_EMAIL = 'ravipradeep89@gmail.com';
const ADMIN_PASSWORD = 'papa1210';
const LOOP_NAME = 'Overdue Invoice Reminders';

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

/** Sign in and land on the Verified Procedures tab. */
async function openLoops(page: Page) {
  await signInAsAdmin(page);
  await page.goto('/chataiagent/admin');
  const tab = page.getByRole('button', { name: 'Verified Procedures' });
  await tab.waitFor({ state: 'visible', timeout: 15_000 });
  await tab.click();
  await expect(page.getByText('Describe a procedure in plain English', { exact: false }))
    .toBeVisible({ timeout: 10_000 });
}

async function openLoopDetail(page: Page) {
  await openLoops(page);
  const row = page.getByRole('button', { name: new RegExp(LOOP_NAME) });
  await row.waitFor({ state: 'visible', timeout: 15_000 });
  await row.click();
  await expect(page.getByRole('heading', { name: LOOP_NAME }))
    .toBeVisible({ timeout: 15_000 });
}

test.describe('Verified Procedures admin', () => {

  test('TEST 1: dashboard shows overview cards and the loop list', async ({ page }) => {
    await openLoops(page);

    // Overview cards (ops truth at a glance)
    await expect(page.getByText('runs in flight')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('waiting on YOUR approval')).toBeVisible();
    await expect(page.getByText(/recent spend/)).toBeVisible();

    // Loop list with metadata line
    await expect(page.getByText(LOOP_NAME)).toBeVisible();
    await expect(page.getByText(/overdue_invoice_reminders · v\d+/)).toBeVisible();
  });

  test('TEST 2: loop detail renders every section', async ({ page }) => {
    await openLoopDetail(page);

    await expect(page.getByText('The procedure (source of truth)')).toBeVisible();
    // Compiled step chips (full chip text — strict-mode safe even if a
    // validation banner elsewhere mentions the step id)
    await expect(page.getByText('fetch_invoices (tool)')).toBeVisible();
    await expect(page.getByText('Done means')).toBeVisible();
    // Eval scorecard
    await expect(page.getByRole('heading', { name: /Prove it — eval suite/ })).toBeVisible();
    await expect(page.getByText(/\d+ cases × \d+ trials/)).toBeVisible();
    // Regression-gated prompt editing
    await expect(page.getByRole('heading', { name: 'Step prompts' })).toBeVisible();
    // Ops + advanced editor entry
    await expect(page.getByRole('heading', { name: 'Operations' })).toBeVisible();
    await expect(page.getByText('Advanced: edit full spec (JSON)')).toBeVisible();
    // Versioning + runs
    await expect(page.getByText(/Version history \(currently v\d+\)/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Runs' })).toBeVisible();
  });

  test('TEST 3: eval case editor adds then deletes a case', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await openLoopDetail(page);

    const before = await page.getByText(/(\d+) cases × \d+ trials/).textContent();
    const beforeN = parseInt(before!.match(/(\d+) cases/)![1], 10);

    await page.getByRole('button', { name: 'Edit cases' }).click();
    await page.getByRole('button', { name: 'Add case' }).click();
    await page.getByPlaceholder(/Focus — what this case probes/).fill('e2e: playwright probe case');
    await page.getByPlaceholder('Expected outcome (optional, plain English)')
      .fill('nothing to send; loop completes cleanly');
    await page.getByRole('button', { name: 'Save case' }).click();

    await expect(page.getByText(`${beforeN + 1} cases ×`, { exact: false }))
      .toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('e2e: playwright probe case')).toBeVisible();

    // Delete the case we just added (last row's trash button)
    const row = page.locator('div', { hasText: 'e2e: playwright probe case' })
      .locator('button.text-destructive').last();
    await row.click();
    await expect(page.getByText(`${beforeN} cases ×`, { exact: false }))
      .toBeVisible({ timeout: 15_000 });
  });

  test('TEST 4: operations quick-edit saves and bumps the version', async ({ page }) => {
    await openLoopDetail(page);

    const vText = await page.getByText(/^v\d+$/).first().textContent();
    const vBefore = parseInt(vText!.slice(1), 10);

    const costInput = page.locator('label', { hasText: 'Max cost / run' }).locator('input');
    const current = parseFloat(await costInput.inputValue());
    // Nudge the budget so the form is dirty either way, staying sane (1.5 ↔ 2)
    const next = current === 2 ? 1.5 : 2;
    await costInput.fill(String(next));

    const opsRow = page.locator('div.flex.flex-wrap.items-end', { hasText: 'Max cost / run' });
    await opsRow.getByRole('button', { name: 'Save' }).click();

    // PUT /spec is versioned — the header badge must bump.
    await expect(page.getByText(`v${vBefore + 1}`, { exact: true }))
      .toBeVisible({ timeout: 20_000 });
  });

  test('TEST 5: integrations panel adds and removes a webhook mapping', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await openLoops(page);

    await page.getByRole('button', { name: 'Integrations' }).click();
    await expect(page.getByRole('heading', { name: 'Tool integrations' })).toBeVisible();

    await page.getByPlaceholder('tool id (whatsapp_send_message)').fill('e2e_test_tool');
    await page.getByPlaceholder('https://hooks.zapier.com/…')
      .fill('https://hooks.example.com/e2e/probe');
    await page.getByPlaceholder('secret (optional)').fill('e2e-secret');
    await page.getByRole('button', { name: 'Save' }).click();

    const row = page.locator('div.flex.items-center', { hasText: 'e2e_test_tool' });
    await expect(row.first()).toBeVisible({ timeout: 15_000 });
    await expect(row.first().getByText('🔒 secret')).toBeVisible();

    await row.first().locator('button.text-destructive').click();
    await expect(page.getByText('e2e_test_tool')).toHaveCount(0, { timeout: 15_000 });
  });

  test('TEST 6: version history lists versions with the current one marked', async ({ page }) => {
    await openLoopDetail(page);

    await page.getByText(/Version history \(currently v\d+\)/).click();
    await expect(page.getByText(/v\d+ \(current\)/)).toBeVisible({ timeout: 15_000 });
    // At least one older version with a Restore button (this loop has many edits)
    await expect(page.getByRole('button', { name: 'Restore' }).first())
      .toBeVisible({ timeout: 15_000 });
  });

  test('TEST 7: Run & watch executes a dry run live to a verdict', async ({ page }) => {
    // Login + TWO human gates + several real LLM steps + verification —
    // legitimately longer than the default 3-minute budget.
    test.setTimeout(420_000);
    await openLoopDetail(page);

    await page.getByRole('button', { name: 'Run & watch' }).click();
    await expect(page.getByRole('heading', { name: 'Live run' })).toBeVisible({ timeout: 15_000 });

    // The full step timeline appears up-front (run_started lays it out)
    await expect(page.getByText(/\d+\/\d+ steps/)).toBeVisible({ timeout: 30_000 });

    // With real data flow (v4+), the run parks on EVERY human gate — this loop
    // has two (approve the drafts, then the guarded send). Approve each from
    // the live panel until the verdict lands (Diagram 2's amber beats).
    const approve = page.getByRole('button', { name: 'Approve' });
    const verdict = page.getByText(/verdict: (passed|failed)/i).first();
    // Poll: click Approve whenever a gate is actionable; stop at the verdict.
    const deadline = Date.now() + 300_000;
    while (Date.now() < deadline) {
      if (await verdict.isVisible().catch(() => false)) break;
      if (await approve.isVisible().catch(() => false)
          && await approve.isEnabled().catch(() => false)) {
        await approve.click();
      }
      await page.waitForTimeout(2000);
    }

    // Post-approval the panel polls the resumed run to its real verdict.
    await expect(verdict).toBeVisible({ timeout: 150_000 });

    // Cost + tokens were metered live
    await expect(page.getByText(/\$\d+\.\d{4}/).first()).toBeVisible();
    await expect(page.getByText(/\d+ tok/).first()).toBeVisible();
  });
});
