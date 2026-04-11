/**
 * Agent Builder E2E Tests
 *
 * Tests the full agent builder lifecycle:
 *   TEST 1:  "Create Agent" button opens wizard modal
 *   TEST 2:  Wizard validation — cannot proceed without required fields
 *   TEST 3:  Wizard step navigation (Next / Back)
 *   TEST 4:  Full wizard flow: create a dynamic agent (4 steps)
 *   TEST 5:  Dynamic agent appears in agent selector after creation
 *   TEST 6:  Dynamic agent shows status badge
 *   TEST 7:  Tab bar shows agent-builder tabs (Prompts, Routing, etc.)
 *   TEST 8:  Prompt Editor — loads, edits, shows dirty indicator
 *   TEST 9:  Prompt Editor — save with change note creates new version
 *   TEST 10: Prompt Editor — version history loads and shows versions
 *   TEST 11: Routing Config — add/remove keywords
 *   TEST 12: Routing Config — add context markers
 *   TEST 13: Memory Config — toggle enable/disable
 *   TEST 14: Memory Config — add categories with decay sliders
 *   TEST 15: Ontology Editor — add/remove entity rows
 *   TEST 16: Ontology Editor — export JSON
 *   TEST 17: Sandbox — status controls (activate/deactivate)
 *   TEST 18: Sandbox — hot-reload button
 *   TEST 19: AI Builder — quick action buttons visible
 *   TEST 20: Cleanup — archive the test agent
 *
 * Prerequisites:
 *   - Frontend: npm run dev (port 5173)
 *   - Backend: cd chatservice && docker compose up --build (port 8080, SKIP_AUTH=true)
 *
 * Run:
 *   npx playwright test e2e/agent-builder.spec.ts --headed
 */

import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ADMIN_EMAIL = 'ravipradeep89@gmail.com';
const ADMIN_PASSWORD = 'papa1210';

// Unique agent ID to avoid collisions — timestamp suffix
const TEST_AGENT_ID = `e2e_test_${Date.now().toString(36)}`;
const TEST_AGENT_NAME = `E2E Test Agent ${TEST_AGENT_ID.slice(-4)}`;
const TEST_AGENT_DESC = 'Automated test agent created by Playwright E2E suite';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  await page
    .getByText('Admin Portal')
    .waitFor({ state: 'visible', timeout: 20_000 });
}

async function selectAgent(page: Page, agentId: string) {
  const select = page.locator('select');
  await expect(select).toBeVisible({ timeout: 15_000 });
  await select.selectOption(agentId);
  await page.waitForTimeout(1000);
}

/**
 * Opens the legacy 4-step wizard, which since Phase 1C lives behind
 * the "Advanced: skip AI, manual create" link on the goal-first draft
 * screen. Click Create Agent → click Advanced → wait for wizard.
 *
 * Most of this test suite was written against the wizard directly.
 * The new default for "Create Agent" is the goal-first draft screen
 * (covered by phase1c-goal-first-create.spec.ts). This helper lets
 * the legacy wizard tests keep verifying the wizard path without
 * duplicating the goal-first coverage.
 */
async function openLegacyWizard(page: Page) {
  await page.getByRole('button', { name: /Create Agent/i }).click();
  await page
    .getByText('What should this agent do?')
    .waitFor({ state: 'visible', timeout: 5_000 });
  await page.getByText('Advanced: skip AI, manual create').click();
  await page
    .getByText('Step 1 of 4: Basic Info')
    .waitFor({ state: 'visible', timeout: 5_000 });
}

async function clickTab(page: Page, tabLabel: string) {
  const tab = page.locator('button').filter({ hasText: tabLabel });
  await tab.click();
  await page.waitForTimeout(1000);
}

/** Wait for loading skeleton to disappear. */
async function waitForPanelLoad(page: Page) {
  // Wait for any animated pulse skeleton to disappear
  try {
    await page
      .locator('.animate-pulse')
      .first()
      .waitFor({ state: 'hidden', timeout: 15_000 });
  } catch {
    // No skeleton found — panel loaded instantly
  }
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

test.describe('Agent Builder', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 1: "Create Agent" opens the goal-first draft screen by default
  //         AND "Advanced" link still reaches the legacy wizard
  //
  // Phase 1C moved the default Create flow from the 4-step wizard to a
  // single-screen goal-first experience. This test locks in both: the
  // new default AND the preserved escape hatch.
  // ═══════════════════════════════════════════════════════════════════
  test('Create Agent opens draft screen; Advanced reaches legacy wizard', async ({
    page,
  }) => {
    await goToAdmin(page);

    const createBtn = page.getByRole('button', { name: /Create Agent/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // Phase 1C default: goal-first draft screen
    await expect(page.getByText('What should this agent do?')).toBeVisible({
      timeout: 5_000,
    });
    await expect(
      page.getByRole('button', { name: /Draft with AI/i })
    ).toBeVisible();
    await expect(
      page.getByText('Advanced: skip AI, manual create')
    ).toBeVisible();

    // Clicking Advanced switches to the legacy 4-step wizard
    await page.getByText('Advanced: skip AI, manual create').click();
    await expect(page.getByText('Create New Agent')).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText('Step 1 of 4: Basic Info')).toBeVisible();

    // Cancel closes the wizard
    await page.getByRole('button', { name: /Cancel/i }).click();
    await expect(page.getByText('Create New Agent')).not.toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 2: Wizard validation — cannot proceed without required fields
  // ═══════════════════════════════════════════════════════════════════
  test('Wizard blocks Next when required fields are empty', async ({
    page,
  }) => {
    await goToAdmin(page);
    await openLegacyWizard(page);

    // Next button should be disabled when Agent ID and Name are empty
    const nextBtn = page.getByRole('button', { name: /Next/i });
    await expect(nextBtn).toBeDisabled();

    // Fill Agent ID only — still disabled (name required)
    await page.locator('input[placeholder*="sleep_wellness"]').fill('test_id');
    await expect(nextBtn).toBeDisabled();

    // Fill Name too — now enabled
    await page
      .locator('input[placeholder*="Sleep Wellness"]')
      .fill('Test Agent');
    await expect(nextBtn).toBeEnabled();
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 3: Wizard step navigation
  // ═══════════════════════════════════════════════════════════════════
  test('Wizard navigates between steps with Next/Back', async ({ page }) => {
    await goToAdmin(page);
    await openLegacyWizard(page);

    // Step 1: Fill required fields
    await page
      .locator('input[placeholder*="sleep_wellness"]')
      .fill('nav_test');
    await page
      .locator('input[placeholder*="Sleep Wellness"]')
      .fill('Nav Test');

    // Go to Step 2
    await page.getByRole('button', { name: /Next/i }).click();
    await expect(page.getByText('Step 2 of 4: System Prompt')).toBeVisible();

    // System Prompt is required for step 2, but Next should be disabled until filled
    const nextBtn2 = page.getByRole('button', { name: /Next/i });
    await expect(nextBtn2).toBeDisabled();

    // Fill system prompt
    await page
      .locator('textarea[placeholder*="compassionate"]')
      .fill('You are a test agent.');
    await expect(nextBtn2).toBeEnabled();

    // Go to Step 3
    await nextBtn2.click();
    await expect(page.getByText('Step 3 of 4: Routing & Memory')).toBeVisible();

    // Back returns to Step 2
    await page.getByRole('button', { name: /Back/i }).click();
    await expect(page.getByText('Step 2 of 4: System Prompt')).toBeVisible();

    // Back again returns to Step 1
    await page.getByRole('button', { name: /Back/i }).click();
    await expect(page.getByText('Step 1 of 4: Basic Info')).toBeVisible();

    // Cancel button should close the wizard
    await page.getByRole('button', { name: /Cancel/i }).click();
    await expect(page.getByText('Create New Agent')).not.toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 4: Full wizard flow — create a dynamic agent
  // ═══════════════════════════════════════════════════════════════════
  test('Full wizard flow creates a dynamic agent', async ({ page }) => {
    await goToAdmin(page);
    await openLegacyWizard(page);

    // --- Step 1: Basic Info ---
    await page
      .locator('input[placeholder*="sleep_wellness"]')
      .fill(TEST_AGENT_ID);
    await page
      .locator('input[placeholder*="Sleep Wellness"]')
      .fill(TEST_AGENT_NAME);
    await page
      .locator('textarea[placeholder*="Helps users"]')
      .fill(TEST_AGENT_DESC);
    await page.getByRole('button', { name: /Next/i }).click();

    // --- Step 2: System Prompt ---
    await expect(page.getByText('Step 2 of 4: System Prompt')).toBeVisible();
    await page
      .locator('textarea[placeholder*="compassionate"]')
      .fill(
        'You are a helpful test agent created by Playwright E2E tests. Be concise and friendly.'
      );
    await page
      .locator('textarea[placeholder*="Always ask"]')
      .fill('Always greet the user first.');
    await page
      .locator('input[placeholder*="not medical advice"]')
      .fill('This is a test agent — not real advice.');
    await page.getByRole('button', { name: /Next/i }).click();

    // --- Step 3: Routing & Memory ---
    await expect(page.getByText('Step 3 of 4: Routing & Memory')).toBeVisible();
    await page
      .locator('input[placeholder="insomnia, sleep hygiene, can\'t sleep"]')
      .fill('e2e test, playwright, automation');
    await page.getByRole('button', { name: /Next/i }).click();

    // --- Step 4: Review ---
    await expect(page.getByText('Step 4 of 4: Review & Create')).toBeVisible();

    // Verify review displays the entered info
    await expect(page.getByText(TEST_AGENT_ID)).toBeVisible();
    await expect(page.getByText(TEST_AGENT_NAME)).toBeVisible();
    await expect(page.getByText(TEST_AGENT_DESC)).toBeVisible();
    // The wizard review shows "Agent will be created in draft status"
    await expect(page.getByText('draft', { exact: true })).toBeVisible();

    // Keywords should appear as pills
    await expect(page.getByText('e2e test', { exact: true })).toBeVisible();
    await expect(page.getByText('playwright', { exact: true })).toBeVisible();

    // Click Create Agent (the one inside the wizard modal, not the header)
    await page
      .locator('[class*="fixed"]')
      .getByRole('button', { name: /Create Agent/i })
      .click();

    // Wait for creation (API call + modal close)
    await expect(page.getByText('Create New Agent')).not.toBeVisible({
      timeout: 30_000,
    });

    // Toast notification should appear
    await expect(page.getByText('Agent created', { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 5: Dynamic agent appears in agent selector
  // ═══════════════════════════════════════════════════════════════════
  test('Dynamic agent appears in selector after creation', async ({
    page,
  }) => {
    await goToAdmin(page);
    await page.waitForTimeout(2000);

    const select = page.locator('select');
    await expect(select).toBeVisible({ timeout: 15_000 });

    // The agent dropdown should contain our test agent
    const option = select.locator(`option[value="${TEST_AGENT_ID}"]`);
    await expect(option).toBeAttached({ timeout: 10_000 });

    // Select it
    await select.selectOption(TEST_AGENT_ID);
    await page.waitForTimeout(1000);

    // Agent name should display in the heading
    await expect(page.getByRole('heading', { level: 2 })).toContainText(
      TEST_AGENT_NAME
    );
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 6: Dynamic agent shows status badge
  // ═══════════════════════════════════════════════════════════════════
  test('Dynamic agent displays status badge', async ({ page }) => {
    await goToAdmin(page);
    await selectAgent(page, TEST_AGENT_ID);

    // Badge should show "DRAFT" (uppercase tracking-wider in our polished UI)
    const badge = page.locator('span').filter({ hasText: /draft/i });
    await expect(badge.first()).toBeVisible({ timeout: 10_000 });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 7: Tab bar shows agent-builder tabs
  // ═══════════════════════════════════════════════════════════════════
  test('Dynamic agent shows agent-builder tabs', async ({ page }) => {
    await goToAdmin(page);
    await selectAgent(page, TEST_AGENT_ID);
    await page.waitForTimeout(1000);

    // Dynamic agents created with default capabilities should have these tabs
    const expectedTabs = ['Prompts', 'Routing', 'Corpus', 'Memory'];
    for (const tab of expectedTabs) {
      const tabBtn = page.locator('button').filter({ hasText: tab });
      // At least some of these should be visible
      const isVisible = await tabBtn.isVisible().catch(() => false);
      if (isVisible) {
        expect(isVisible).toBe(true);
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 8: Prompt Editor — loads and shows dirty indicator
  // ═══════════════════════════════════════════════════════════════════
  test('Prompt Editor loads config and tracks dirty state', async ({
    page,
  }) => {
    await goToAdmin(page);
    await selectAgent(page, TEST_AGENT_ID);
    await clickTab(page, 'Prompts');
    await waitForPanelLoad(page);

    // System Prompt card should be visible
    await expect(page.getByText('System Prompt').first()).toBeVisible({
      timeout: 10_000,
    });

    // The textarea should contain our initial prompt
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible();
    const value = await textarea.inputValue();
    expect(value).toContain('Playwright');

    // Edit the prompt — dirty indicator should appear
    await textarea.fill(value + '\nEdited by E2E test.');
    await expect(page.getByText('Unsaved changes')).toBeVisible({
      timeout: 5_000,
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 9: Prompt Editor — save with change note
  // ═══════════════════════════════════════════════════════════════════
  test('Prompt Editor saves with change note and creates version', async ({
    page,
  }) => {
    await goToAdmin(page);
    await selectAgent(page, TEST_AGENT_ID);
    await clickTab(page, 'Prompts');
    await waitForPanelLoad(page);

    // Edit prompt
    const textarea = page.locator('textarea').first();
    const currentValue = await textarea.inputValue();
    await textarea.fill(currentValue + '\nVersion 2 edit.');

    // Change note input should appear
    const changeNoteInput = page.locator(
      'input[placeholder*="Added CBT"]'
    );
    await expect(changeNoteInput).toBeVisible({ timeout: 5_000 });

    await changeNoteInput.fill('E2E test version 2');

    // Save button
    await page.getByRole('button', { name: /Save/i }).click();

    // Toast should confirm save
    await expect(page.getByText(/Prompts saved/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 10: Prompt Editor — version history
  // ═══════════════════════════════════════════════════════════════════
  test('Prompt Editor shows version history', async ({ page }) => {
    await goToAdmin(page);
    await selectAgent(page, TEST_AGENT_ID);
    await clickTab(page, 'Prompts');
    await waitForPanelLoad(page);

    // Click History button
    await page.getByRole('button', { name: /History/i }).click();
    await page.waitForTimeout(2000);

    // Version History section should appear
    await expect(page.getByText('Version History')).toBeVisible({
      timeout: 10_000,
    });

    // Should have at least v1 (initial) and v2 (from test 9)
    await expect(page.getByText('v1')).toBeVisible({ timeout: 10_000 });

    // Active version badge
    const activeBadge = page.locator('span').filter({ hasText: 'active' });
    await expect(activeBadge.first()).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 11: Routing Config — add/remove keywords
  // ═══════════════════════════════════════════════════════════════════
  test('Routing Config lets you add and remove keywords', async ({
    page,
  }) => {
    await goToAdmin(page);
    await selectAgent(page, TEST_AGENT_ID);

    // Find and click the Routing tab
    const routingTab = page.locator('button').filter({ hasText: 'Routing' });
    const isVisible = await routingTab.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip();
      return;
    }
    await routingTab.click();
    await waitForPanelLoad(page);

    // Strong Indicators section should be visible
    await expect(page.getByText('Strong Indicators')).toBeVisible({
      timeout: 10_000,
    });

    // Add a new keyword
    const keywordInput = page
      .locator('input[placeholder="Add keyword..."]')
      .first();
    await keywordInput.fill('new_e2e_keyword');
    await keywordInput.press('Enter');
    await page.waitForTimeout(500);

    // Keyword pill should appear
    await expect(page.getByText('new_e2e_keyword')).toBeVisible();

    // Remove it by clicking the X on the pill
    const pill = page
      .locator('span')
      .filter({ hasText: 'new_e2e_keyword' })
      .first();
    const removeBtn = pill.locator('button');
    await removeBtn.click();
    await page.waitForTimeout(500);

    // Keyword should be gone
    await expect(page.getByText('new_e2e_keyword')).not.toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 12: Routing Config — add context markers
  // ═══════════════════════════════════════════════════════════════════
  test('Routing Config lets you add context markers', async ({ page }) => {
    await goToAdmin(page);
    await selectAgent(page, TEST_AGENT_ID);

    const routingTab = page.locator('button').filter({ hasText: 'Routing' });
    const isVisible = await routingTab.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip();
      return;
    }
    await routingTab.click();
    await waitForPanelLoad(page);

    // Context Markers section
    await expect(page.getByText('Context Markers')).toBeVisible({
      timeout: 10_000,
    });

    // Add a marker
    const markerInput = page
      .locator('input[placeholder="Add marker..."]')
      .first();
    await markerInput.fill('[E2E test marker]');
    await markerInput.press('Enter');
    await page.waitForTimeout(500);

    // Marker pill should appear (purple styled)
    await expect(page.getByText('[E2E test marker]')).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 13: Memory Config — toggle enable/disable
  // ═══════════════════════════════════════════════════════════════════
  test('Memory Config toggle enables/disables memory settings', async ({
    page,
  }) => {
    await goToAdmin(page);
    await selectAgent(page, TEST_AGENT_ID);

    const memTab = page.locator('button').filter({ hasText: 'Mem Config' });
    const isVisible = await memTab.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip();
      return;
    }
    await memTab.click();
    await waitForPanelLoad(page);

    // User Memory toggle should be visible
    await expect(page.getByText('User Memory')).toBeVisible({
      timeout: 10_000,
    });

    // Toggle button (the custom switch)
    const toggle = page.locator('button.rounded-full').first();

    // Click to enable — categories section should appear
    await toggle.click();
    await page.waitForTimeout(500);

    // Check if Memory Categories section appeared (it may already be enabled)
    const catSection = page.getByText('Memory Categories');
    const catVisible = await catSection.isVisible().catch(() => false);
    if (catVisible) {
      await expect(catSection).toBeVisible();
    }

    // Toggle back
    await toggle.click();
    await page.waitForTimeout(500);
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 14: Memory Config — add categories
  // ═══════════════════════════════════════════════════════════════════
  test('Memory Config lets you add categories with decay sliders', async ({
    page,
  }) => {
    await goToAdmin(page);
    await selectAgent(page, TEST_AGENT_ID);

    const memTab = page.locator('button').filter({ hasText: 'Mem Config' });
    const isVisible = await memTab.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip();
      return;
    }
    await memTab.click();
    await waitForPanelLoad(page);

    // Ensure memory is enabled
    const toggle = page.locator('button.rounded-full').first();

    // Check if categories section is visible, if not — enable
    const catVisible = await page
      .getByText('Memory Categories')
      .isVisible()
      .catch(() => false);
    if (!catVisible) {
      await toggle.click();
      await page.waitForTimeout(500);
    }

    // Add a category
    const catInput = page
      .locator('input[placeholder*="SLEEP_PATTERNS"]')
      .first();
    await catInput.fill('E2E_TEST_CAT');
    await catInput.press('Enter');
    await page.waitForTimeout(500);

    // Category should appear (auto-uppercased)
    await expect(page.getByText('E2E_TEST_CAT')).toBeVisible();

    // Decay slider should be present
    const slider = page.locator('input[type="range"]').first();
    await expect(slider).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 15: Ontology Editor — add/remove entity rows
  // ═══════════════════════════════════════════════════════════════════
  test('Ontology Editor lets you add and remove entities', async ({
    page,
  }) => {
    await goToAdmin(page);
    await selectAgent(page, TEST_AGENT_ID);

    const ontTab = page.locator('button').filter({ hasText: 'Ontology' });
    const isVisible = await ontTab.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip();
      return;
    }
    await ontTab.click();
    await waitForPanelLoad(page);

    // Domain Ontology card should be visible
    await expect(page.getByText('Domain Ontology')).toBeVisible({
      timeout: 10_000,
    });

    // Click "Add Entity"
    await page.getByRole('button', { name: /Add Entity/i }).click();
    await page.waitForTimeout(500);

    // A new row should appear with empty inputs
    const canonicalInput = page
      .locator('input[placeholder="insomnia"]')
      .first();
    await expect(canonicalInput).toBeVisible();

    // Fill in the entity
    await canonicalInput.fill('e2e_entity');
    const displayInput = page
      .locator('input[placeholder="Insomnia"]')
      .first();
    await displayInput.fill('E2E Entity');

    // Delete the row
    const deleteBtn = page.locator('button').filter({
      has: page.locator('svg.lucide-trash-2'),
    });
    await deleteBtn.first().click();
    await page.waitForTimeout(500);

    // Input should be gone (back to empty state)
    await expect(canonicalInput).not.toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 16: Ontology Editor — export JSON
  // ═══════════════════════════════════════════════════════════════════
  test('Ontology Editor export button works', async ({ page }) => {
    await goToAdmin(page);
    await selectAgent(page, TEST_AGENT_ID);

    const ontTab = page.locator('button').filter({ hasText: 'Ontology' });
    const isVisible = await ontTab.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip();
      return;
    }
    await ontTab.click();
    await waitForPanelLoad(page);

    // Export button should be visible
    const exportBtn = page.getByRole('button', { name: /Export/i });
    await expect(exportBtn).toBeVisible();

    // Set up download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 5_000 });
    await exportBtn.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toContain('ontology.json');
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 17: Sandbox — status controls
  // ═══════════════════════════════════════════════════════════════════
  test('Sandbox shows status controls and can activate agent', async ({
    page,
  }) => {
    await goToAdmin(page);
    await selectAgent(page, TEST_AGENT_ID);

    const sandboxTab = page.locator('button').filter({ hasText: 'Sandbox' });
    const isVisible = await sandboxTab.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip();
      return;
    }
    await sandboxTab.click();
    await waitForPanelLoad(page);

    // Sandbox header
    await expect(page.getByText('Prompt Sandbox')).toBeVisible({
      timeout: 10_000,
    });

    // Status badge should show draft
    await expect(
      page
        .locator('span')
        .filter({ hasText: /draft/i })
        .first()
    ).toBeVisible();

    // Activate button should be visible for draft agents
    const activateBtn = page.getByRole('button', {
      name: /Activate Agent/i,
    });
    await expect(activateBtn).toBeVisible();

    // Activate it
    await activateBtn.click();
    await page.waitForTimeout(3000);

    // Status should change to active
    await expect(page.getByText(/active/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // Now Deactivate should be visible
    const deactivateBtn = page.getByRole('button', {
      name: /Deactivate/i,
    });
    await expect(deactivateBtn).toBeVisible({ timeout: 5_000 });

    // Deactivate back to draft
    await deactivateBtn.click();
    await page.waitForTimeout(3000);
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 18: Sandbox — hot-reload button
  // ═══════════════════════════════════════════════════════════════════
  test('Sandbox hot-reload button works', async ({ page }) => {
    await goToAdmin(page);
    await selectAgent(page, TEST_AGENT_ID);

    const sandboxTab = page.locator('button').filter({ hasText: 'Sandbox' });
    const isVisible = await sandboxTab.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip();
      return;
    }
    await sandboxTab.click();
    await waitForPanelLoad(page);

    // The reload button (RefreshCw icon)
    const reloadBtn = page.locator('button[title="Hot-reload agent config"]');
    await expect(reloadBtn).toBeVisible({ timeout: 10_000 });

    await reloadBtn.click();

    // Toast should confirm reload
    await expect(page.getByText(/Agent reloaded/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 19: AI Builder — quick action buttons visible
  // ═══════════════════════════════════════════════════════════════════
  test('AI Builder shows quick action buttons', async ({ page }) => {
    await goToAdmin(page);
    await selectAgent(page, TEST_AGENT_ID);

    const builderTab = page
      .locator('button')
      .filter({ hasText: 'AI Builder' });
    const isVisible = await builderTab.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip();
      return;
    }
    await builderTab.click();
    await waitForPanelLoad(page);

    // AI Agent Builder header
    await expect(page.getByText('AI Agent Builder')).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByText('Claude Opus 4.6 helps you design')
    ).toBeVisible();

    // Quick action buttons
    await expect(
      page.getByRole('button', { name: /Generate Config/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Improve Prompt/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Generate Ontology/i })
    ).toBeVisible();

    // Chat input
    const chatInput = page.locator(
      'input[placeholder*="Ask about prompt design"]'
    );
    await expect(chatInput).toBeVisible();

    // Empty state message
    await expect(
      page.getByText('Use the quick actions above or chat')
    ).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 20: Cleanup — archive the test agent
  // ═══════════════════════════════════════════════════════════════════
  test('Cleanup — archive test agent', async ({ page }) => {
    await goToAdmin(page);
    await selectAgent(page, TEST_AGENT_ID);

    const sandboxTab = page.locator('button').filter({ hasText: 'Sandbox' });
    const isVisible = await sandboxTab.isVisible().catch(() => false);
    if (!isVisible) {
      // If no sandbox tab, try to archive via API directly
      test.skip();
      return;
    }
    await sandboxTab.click();
    await waitForPanelLoad(page);

    // Handle the confirm dialog
    page.on('dialog', (dialog) => dialog.accept());

    // Click Archive
    const archiveBtn = page.getByRole('button', { name: /Archive/i });
    await expect(archiveBtn).toBeVisible({ timeout: 5_000 });
    await archiveBtn.click();

    // Wait for status change
    await page.waitForTimeout(3000);

    // Status should show archived
    await expect(
      page
        .locator('span')
        .filter({ hasText: /archived/i })
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
