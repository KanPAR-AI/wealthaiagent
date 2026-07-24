/**
 * Model Gateway admin — the task→model map — E2E
 *
 *   TEST 1: Models tab renders the task map (grouped rows, model per task)
 *   TEST 2: Editing a task's model saves and marks it as an override
 *
 * The /admin/model-profiles calls are intercepted so tests are deterministic.
 *
 * Prerequisites: npm run dev (5173) + chatservice docker (8080), admin user.
 * Run: npx playwright test e2e/model-profiles.spec.ts
 */

import { test, expect, Page } from '@playwright/test';

const ADMIN_EMAIL = 'ravipradeep89@gmail.com';
const ADMIN_PASSWORD = 'papa1210';

const PROFILES = [
  { task_key: 'loops.compile', primary: 'anthropic/claude-opus-4-8', fallbacks: [],
    temperature: 0.2, max_tokens: 32000, tiers: {}, cache: false, kind: 'json',
    description: 'Compile prose SOP → LoopSpec + evals', is_override: false },
  { task_key: 'orchestrator.route', primary: 'gemini/gemini-flash-latest', fallbacks: [],
    temperature: 0.7, max_tokens: 4096, tiers: {}, cache: false, kind: 'json',
    description: 'One-word agent-type routing classification', is_override: false },
];
const KNOWN = ['anthropic/claude-opus-4-8', 'anthropic/claude-sonnet-5', 'gemini/gemini-pro-latest', 'gemini/gemini-flash-latest'];

async function signInAsAdmin(page: Page) {
  await page.goto('/chataiagent/');
  await page.waitForTimeout(3000);
  const alreadyLoggedIn = await page
    .getByText('How can I help you today?').isVisible().catch(() => false);
  if (!alreadyLoggedIn) {
    await page.getByText('Continue with Email').click();
    await page.waitForTimeout(500);
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').filter({ hasText: /Sign In/i }).click();
    await page.waitForTimeout(5000);
  }
}

async function openModelsTab(page: Page) {
  await signInAsAdmin(page);
  await page.goto('/chataiagent/admin?section=models');
  await page.getByRole('button', { name: 'Models', exact: true }).click();
}

test.describe('Model Gateway — task→model map', () => {

  test('TEST 1: Models tab renders the task map', async ({ page }) => {
    await page.route('**/admin/model-profiles', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ profiles: PROFILES, known_models: KNOWN }) }));

    await openModelsTab(page);

    await expect(page.getByText('loops.compile')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('anthropic/claude-opus-4-8')).toBeVisible();
    await expect(page.getByText('orchestrator.route')).toBeVisible();
    // grouped by prefix — the "loops" and "orchestrator" group headers show
    await expect(page.getByText('loops', { exact: true })).toBeVisible();
  });

  test('TEST 2: editing a model saves and marks an override', async ({ page }) => {
    await page.route('**/admin/model-profiles', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ profiles: PROFILES, known_models: KNOWN }) }));
    // The PUT that persists the swap.
    await page.route('**/model-profiles/loops.compile', async (route) => {
      expect(route.request().method()).toBe('PUT');
      const body = route.request().postDataJSON?.() ?? {};
      expect(body.primary).toBe('anthropic/claude-sonnet-5');
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ...PROFILES[0], primary: 'anthropic/claude-sonnet-5', is_override: true }) });
    });

    await openModelsTab(page);
    await page.getByText('loops.compile').click();          // open the edit row
    await page.locator('select').first().selectOption('anthropic/claude-sonnet-5');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    // Row now shows the new model + an "override" badge.
    await expect(page.getByText('anthropic/claude-sonnet-5')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('override', { exact: true })).toBeVisible();
  });
});
