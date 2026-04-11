/**
 * Phase 1C — Goal-First Create Flow UI E2E
 *
 * Tests the new goal-first agent creation experience that replaces
 * the 4-step wizard as the default "Create Agent" flow.
 *
 *   1. Click "Create Agent" → Goal-first draft screen appears
 *   2. Type a one-sentence goal → "Draft with AI" button enables
 *   3. Click "Draft with AI" → Claude Opus drafts full config
 *   4. Draft form populates with editable fields (agent_id, name,
 *      system prompt, keywords, memory categories, etc.)
 *   5. Edit agent_id to a unique value (avoids collisions)
 *   6. Click "Create Agent" → persists and closes modal
 *   7. Verify new agent appears in the admin agent dropdown
 *   8. "Advanced: manual create" link still opens the legacy wizard
 *   9. Cleanup — archive the created agent
 *
 * Prerequisites:
 *   - Frontend running on :5173 (npm run dev)
 *   - Backend running on :8080 (docker compose up --build)
 *   - Opus 4.6 accessible via ANTHROPIC_API_KEY (or fallback chain
 *     active — Gemini/GPT-4 work too, they just produce drafts)
 */

import { test, expect, Page } from '@playwright/test';

const ADMIN_EMAIL = 'ravipradeep89@gmail.com';
const ADMIN_PASSWORD = 'papa1210';

const TEST_GOAL =
  'Help users build better sleep habits using CBT-I techniques and sleep hygiene coaching';

const TEST_AGENT_SUFFIX = Date.now().toString(36).slice(-4);
const TEST_AGENT_ID = `e2e_p1c_${TEST_AGENT_SUFFIX}`;

async function signInAsAdmin(page: Page) {
  await page.goto('/chataiagent/');
  await page.waitForTimeout(3000);

  const alreadyLoggedIn = await page
    .getByText('How can I help you today?')
    .isVisible()
    .catch(() => false);
  if (alreadyLoggedIn) return;

  const emailButton = page.getByText('Continue with Email');
  await emailButton.waitFor({ state: 'visible', timeout: 10_000 });
  await emailButton.click();
  await page.waitForTimeout(500);

  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page
    .locator('button[type="submit"]')
    .filter({ hasText: /Sign In/i })
    .click();

  await page.waitForTimeout(5000);
  await page
    .getByText('How can I help you today?')
    .waitFor({ state: 'visible', timeout: 15_000 });
}

async function goToAdmin(page: Page) {
  await page.goto('/chataiagent/admin');
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page
        .getByText('Admin Portal')
        .waitFor({ state: 'visible', timeout: 10_000 });
      return;
    } catch {
      await page.waitForTimeout(2000);
      await page.goto('/chataiagent/admin');
    }
  }
}

test.describe('Phase 1C — goal-first create flow', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  // ═══════════════════════════════════════════════════════════════════
  // 1. "Create Agent" button opens the goal-first draft screen
  //    (not the legacy 4-step wizard)
  // ═══════════════════════════════════════════════════════════════════
  test('Create Agent opens the goal-first draft screen', async ({ page }) => {
    await goToAdmin(page);

    const createBtn = page.getByRole('button', { name: /Create Agent/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // Goal-first screen distinguishing features:
    await expect(page.getByText('What should this agent do?')).toBeVisible({
      timeout: 5_000,
    });
    await expect(
      page.getByRole('button', { name: /Draft with AI/i })
    ).toBeVisible();
    // Advanced escape hatch link exists
    await expect(
      page.getByText('Advanced: skip AI, manual create')
    ).toBeVisible();

    // NOT the legacy wizard's "Step 1 of 4" label
    await expect(page.getByText('Step 1 of 4')).not.toBeVisible();

    // Close
    await page.getByRole('button').filter({ has: page.locator('svg.lucide-x') }).first().click();
  });

  // ═══════════════════════════════════════════════════════════════════
  // 2. "Advanced" link opens the legacy wizard (escape hatch)
  // ═══════════════════════════════════════════════════════════════════
  test('Advanced link opens the legacy 4-step wizard', async ({ page }) => {
    await goToAdmin(page);
    await page.getByRole('button', { name: /Create Agent/i }).click();
    await page.getByText('What should this agent do?').waitFor();

    await page.getByText('Advanced: skip AI, manual create').click();

    // Legacy wizard's Step 1 label should now be visible
    await expect(page.getByText('Step 1 of 4: Basic Info')).toBeVisible({
      timeout: 5_000,
    });

    // Close
    await page.getByRole('button', { name: /Cancel/i }).click();
  });

  // ═══════════════════════════════════════════════════════════════════
  // 3. Draft with AI button is disabled on an empty/short goal
  // ═══════════════════════════════════════════════════════════════════
  test('Draft with AI is disabled until goal is long enough', async ({ page }) => {
    await goToAdmin(page);
    await page.getByRole('button', { name: /Create Agent/i }).click();
    await page.getByText('What should this agent do?').waitFor();

    const draftBtn = page.getByRole('button', { name: /Draft with AI/i });
    await expect(draftBtn).toBeDisabled();

    // Short (<10 chars) — still disabled
    const goalTextarea = page.locator('textarea').first();
    await goalTextarea.fill('short');
    await expect(draftBtn).toBeDisabled();

    // Long enough — enabled
    await goalTextarea.fill(TEST_GOAL);
    await expect(draftBtn).toBeEnabled();

    await page.getByRole('button').filter({ has: page.locator('svg.lucide-x') }).first().click();
  });

  // ═══════════════════════════════════════════════════════════════════
  // 4. Draft → edit → create full flow
  //    (this is the key Phase 1C user journey)
  // ═══════════════════════════════════════════════════════════════════
  test('Full goal-first flow: draft, edit agent_id, create', async ({ page }) => {
    test.setTimeout(180_000); // Opus draft can take up to 60s

    await goToAdmin(page);
    await page.getByRole('button', { name: /Create Agent/i }).click();
    await page.getByText('What should this agent do?').waitFor();

    // Fill the goal and click Draft
    await page.locator('textarea').first().fill(TEST_GOAL);
    await page.getByRole('button', { name: /Draft with AI/i }).click();

    // Wait for Opus to respond. Success condition = "Edit the draft"
    // header appears + agent_id input shows a draft value.
    await expect(page.getByText('Edit the draft')).toBeVisible({
      timeout: 120_000,
    });

    // The draft should populate fields. Grab the agent_id input
    // (has monospace font + placeholder "sleep_wellness"), replace
    // it with our unique test id to avoid collisions.
    const agentIdInput = page.locator('input[placeholder="sleep_wellness"]');
    await expect(agentIdInput).toBeVisible();
    await expect(agentIdInput).not.toHaveValue('');
    await agentIdInput.fill(TEST_AGENT_ID);

    // System prompt textarea should be non-empty (draft populated)
    const systemPromptArea = page.locator('textarea').nth(1);
    const sysPromptValue = await systemPromptArea.inputValue();
    expect(sysPromptValue.length).toBeGreaterThan(100);

    // Click Create
    await page
      .locator('[class*="fixed"]')
      .getByRole('button', { name: /^Create Agent$/i })
      .click();

    // Toast + modal close
    await expect(page.getByText('Agent created', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Edit the draft')).not.toBeVisible({
      timeout: 10_000,
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 5. New agent appears in the admin dropdown after creation
  // ═══════════════════════════════════════════════════════════════════
  test('Created agent appears in admin dropdown', async ({ page }) => {
    await goToAdmin(page);
    await page.waitForTimeout(2000);

    const select = page.locator('select');
    await expect(select).toBeVisible({ timeout: 15_000 });

    const option = select.locator(`option[value="${TEST_AGENT_ID}"]`);
    await expect(option).toBeAttached({ timeout: 10_000 });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 6. Cleanup — archive the test agent via direct API (SKIP_AUTH mode)
  // ═══════════════════════════════════════════════════════════════════
  test('Cleanup: archive test agent', async ({ request }) => {
    const res = await request.put(
      `http://localhost:8080/api/v1/admin/agents/${TEST_AGENT_ID}/status`,
      { data: { status: 'archived' } }
    );
    // Either 200 (archived) or 400 (transition invalid because it was
    // never activated — that's fine, still counts as cleanup).
    expect([200, 400]).toContain(res.status());
  });
});
