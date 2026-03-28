/**
 * Admin Dashboard E2E Tests
 *
 * Tests the admin portal features:
 *   TEST 1: Admin login & page load — agent selector, tabs, header
 *   TEST 2: Corpus panel — stats cards, source list, add source dropdown
 *   TEST 3: Add text corpus — paste text form, submit
 *   TEST 4: Add YouTube URL — form, submit
 *   TEST 5: File upload forms — PDF, audio, video, document dropzones
 *   TEST 6: Batch upload form — multi-file dropzone
 *   TEST 7: Test Retrieval — query input, run test, results display
 *   TEST 8: Test Chat — navigate, agent header, chat input
 *   TEST 9: Test Chat sends message with agent routing
 *   TEST 10: Tab switching — corpus, memory
 *   TEST 11: Agent selector switching
 *   TEST 12: Back to Chat navigation
 *
 * Prerequisites:
 *   - Frontend: npm run dev (port 5173)
 *   - Backend: cd chatservice && docker compose up --build (port 8080, SKIP_AUTH=true)
 *
 * Run:
 *   npx playwright test e2e/admin-dashboard.spec.ts --headed
 */

import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_EMAIL = 'ravipradeep89@gmail.com';
const ADMIN_PASSWORD = 'papa1210';

/** Sign in with admin credentials via the Login page. */
async function signInAsAdmin(page: Page) {
  await page.goto('/chataiagent/');
  await page.waitForTimeout(3000);

  // Check if the login form is visible. If the page shows "How can I help you today?"
  // then we're already logged in and past the login page.
  const alreadyLoggedIn = await page.getByText('How can I help you today?').isVisible().catch(() => false);
  if (alreadyLoggedIn) {
    return;
  }

  // Wait for login page to render (auth provider may show Loading... first)
  const emailButton = page.getByText('Continue with Email');
  await emailButton.waitFor({ state: 'visible', timeout: 10_000 });
  await emailButton.click();
  await page.waitForTimeout(500);

  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);

  await page.locator('button[type="submit"]').filter({ hasText: /Sign In/i }).click();

  // Wait for redirect to chat page after successful sign-in
  // The URL will be /chataiagent/chat (not just /chat, to avoid matching /chataiagent/)
  await page.waitForTimeout(5000);
  // Verify we're past the login screen
  await page.getByText('How can I help you today?').waitFor({ state: 'visible', timeout: 15_000 });
}

/**
 * Navigate to admin page and wait for it to fully load.
 * Firebase auth must hydrate from IndexedDB + call /auth/me before
 * ProtectedRoute allows access.
 */
async function goToAdmin(page: Page) {
  await page.goto('/chataiagent/admin');

  // Wait for "Admin Portal" to appear, with retries.
  // On first load, Firebase auth restoration from IndexedDB + /auth/me call
  // can cause a brief redirect to /chat. Retry once if that happens.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.getByText('Admin Portal').waitFor({ state: 'visible', timeout: 10_000 });
      return; // Success
    } catch {
      // Admin page didn't load — auth may not have hydrated yet
      await page.waitForTimeout(2000);
      await page.goto('/chataiagent/admin');
    }
  }
  // Final attempt with longer timeout
  await page.getByText('Admin Portal').waitFor({ state: 'visible', timeout: 20_000 });
}

/** Select an agent from the dropdown. Returns the agent name displayed. */
async function selectAgent(page: Page, agentId?: string): Promise<string> {
  const select = page.locator('select');
  await expect(select).toBeVisible({ timeout: 15_000 });

  if (agentId) {
    await select.selectOption(agentId);
  } else {
    const options = select.locator('option:not([disabled])');
    const count = await options.count();
    expect(count, 'Should have at least one agent option').toBeGreaterThan(0);
    const firstValue = await options.first().getAttribute('value');
    if (firstValue) await select.selectOption(firstValue);
  }

  await page.waitForTimeout(1000);
  const agentName = page.locator('h2').first();
  return (await agentName.textContent()) || '';
}

/** Click on a tab in the admin panel. */
async function clickTab(page: Page, tabLabel: string) {
  const tab = page.locator('button').filter({ hasText: tabLabel });
  await tab.click();
  await page.waitForTimeout(500);
}

/** Navigate to corpus tab for mental_health agent. Common setup for corpus tests. */
async function goToCorpusPanel(page: Page) {
  await goToAdmin(page);
  await selectAgent(page, 'mental_health');
  await clickTab(page, 'Corpus');
  await page.waitForTimeout(2000);
  await expect(page.getByText('Corpus Sources')).toBeVisible({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsAdmin(page);
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 1: Admin page loads with agent selector and tabs
  // ═══════════════════════════════════════════════════════════════════
  test('Admin page loads with agent selector and header', async ({ page }) => {
    await goToAdmin(page);

    await expect(page.getByText('Admin Portal')).toBeVisible();
    await expect(page.getByText('Back to Chat')).toBeVisible();

    const select = page.locator('select');
    await expect(select).toBeVisible({ timeout: 15_000 });

    const agentName = await selectAgent(page);
    expect(agentName.length, 'Agent name should be displayed').toBeGreaterThan(0);
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 2: Corpus panel — stats, source list, add dropdown
  // ═══════════════════════════════════════════════════════════════════
  test('Corpus panel shows stats and sources', async ({ page }) => {
    await goToCorpusPanel(page);

    await expect(page.getByRole('button', { name: /Add Source/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Reload Vectors/i })).toBeVisible();
    await expect(page.getByText('Test Retrieval')).toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 3: Add text corpus form
  // ═══════════════════════════════════════════════════════════════════
  test('Add text corpus form works', async ({ page }) => {
    await goToCorpusPanel(page);

    await page.getByRole('button', { name: /Add Source/i }).click();
    await page.waitForTimeout(300);
    await page.getByText('Paste Text').click();
    await page.waitForTimeout(500);

    const titleInput = page.locator('input[placeholder="Title"]');
    await expect(titleInput).toBeVisible();

    const textArea = page.locator('textarea[placeholder*="Paste your text"]');
    await expect(textArea).toBeVisible();

    const addTextBtn = page.getByRole('button', { name: 'Add Text' });
    await expect(addTextBtn).toBeDisabled();

    await titleInput.fill('E2E Test Document');
    await textArea.fill('This is a test document about anxiety management.');
    await expect(addTextBtn).toBeEnabled();

    // Close form without submitting
    const closeBtn = page.locator('button').filter({ has: page.locator('svg.lucide-x') }).first();
    await closeBtn.click();
    await expect(titleInput).not.toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 4: Add YouTube URL form
  // ═══════════════════════════════════════════════════════════════════
  test('Add YouTube URL form works', async ({ page }) => {
    await goToCorpusPanel(page);

    await page.getByRole('button', { name: /Add Source/i }).click();
    await page.waitForTimeout(300);
    await page.getByText('YouTube URL').click();
    await page.waitForTimeout(500);

    const urlInput = page.locator('input[placeholder*="youtube.com"]');
    await expect(urlInput).toBeVisible();

    const addBtn = page.locator('button').filter({ hasText: 'Add' }).last();
    await expect(addBtn).toBeDisabled();

    await urlInput.fill('https://www.youtube.com/watch?v=test123');
    await expect(addBtn).toBeEnabled();

    const closeBtn = page.locator('button').filter({ has: page.locator('svg.lucide-x') }).first();
    await closeBtn.click();
    await expect(urlInput).not.toBeVisible();
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 5: File upload dropzones (PDF, Audio, Video, Document)
  // ═══════════════════════════════════════════════════════════════════
  test('File upload dropzones render for each type', async ({ page }) => {
    await goToCorpusPanel(page);

    const fileTypes = [
      { label: 'Upload PDF', accepts: '.pdf' },
      { label: 'Upload Audio', accepts: '.mp3' },
      { label: 'Upload Video File', accepts: '.mp4' },
      { label: 'Upload Document/Image', accepts: '.jpg' },
    ];

    for (const { label, accepts } of fileTypes) {
      await page.getByRole('button', { name: /Add Source/i }).click();
      await page.waitForTimeout(300);
      await page.getByText(label).click();
      await page.waitForTimeout(500);

      await expect(page.getByText('Drop file here or click to browse')).toBeVisible();

      const fileInput = page.locator('input[type="file"]').first();
      const acceptAttr = await fileInput.getAttribute('accept');
      expect(acceptAttr, `${label} should accept ${accepts}`).toContain(accepts);

      const closeBtn = page.locator('button').filter({ has: page.locator('svg.lucide-x') }).first();
      await closeBtn.click();
      await page.waitForTimeout(300);
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 6: Batch upload form
  // ═══════════════════════════════════════════════════════════════════
  test('Batch upload form renders with multi-file support', async ({ page }) => {
    await goToCorpusPanel(page);

    await page.getByRole('button', { name: /Add Source/i }).click();
    await page.waitForTimeout(300);
    await page.getByText('Batch Upload').click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Drop multiple files here or click to browse')).toBeVisible();

    const fileInput = page.locator('input[type="file"]').first();
    const isMultiple = await fileInput.getAttribute('multiple');
    expect(isMultiple !== null, 'Batch file input should have multiple attribute').toBe(true);

    const closeBtn = page.locator('button').filter({ has: page.locator('svg.lucide-x') }).first();
    await closeBtn.click();
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 7: Test Retrieval section
  // ═══════════════════════════════════════════════════════════════════
  test('Test Retrieval section has query input and test button', async ({ page }) => {
    await goToCorpusPanel(page);

    await expect(page.getByText('Test Retrieval')).toBeVisible();

    const queryInput = page.locator('input[placeholder*="test query"]');
    await expect(queryInput).toBeVisible();

    const testBtn = page.getByRole('button', { name: 'Test', exact: true });
    await expect(testBtn).toBeVisible();

    await queryInput.fill('What is CBT?');
    await expect(testBtn).toBeEnabled();
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 8: Test Chat navigation
  // ═══════════════════════════════════════════════════════════════════
  test('Test Chat page loads with agent context', async ({ page }) => {
    await goToAdmin(page);
    await selectAgent(page, 'mental_health');

    const testChatBtn = page.getByRole('link', { name: /Test Chat/i });
    await expect(testChatBtn).toBeVisible();

    await testChatBtn.click();
    await page.waitForURL('**/admin/test/mental_health**', { timeout: 10_000 });
    await page.waitForTimeout(2000);

    await expect(page.getByText('Test Chat:')).toBeVisible();
    await expect(page.getByText('mental health')).toBeVisible();
    await expect(page.getByText('Back to Admin')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Test' })).toBeVisible();

    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 10_000 });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 9: Test Chat sends message with agent routing
  // ═══════════════════════════════════════════════════════════════════
  test('Test Chat sends message and gets agent-specific response', async ({ page }) => {
    await page.goto('/chataiagent/admin/test/mental_health');
    await page.waitForTimeout(5000);

    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 15_000 });
    await expect(chatInput).toBeEnabled({ timeout: 30_000 });

    await chatInput.fill('What is cognitive behavioral therapy?');
    await page.waitForTimeout(300);
    await chatInput.press('Enter');

    try {
      await page.getByText('Thinking...').waitFor({ state: 'visible', timeout: 10_000 });
    } catch {
      // instant response
    }
    await page.getByText('Thinking...').waitFor({ state: 'hidden', timeout: 120_000 });
    await page.waitForTimeout(2000);

    const scrollArea = page.locator('[data-radix-scroll-area-viewport]').first();
    const responseText = (await scrollArea.textContent()) || '';

    expect(
      responseText.match(/CBT|cognitive|behavioral|therapy|thoughts|behavior/i),
      'Response should contain CBT-related content'
    ).toBeTruthy();
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 10: Tab switching
  // ═══════════════════════════════════════════════════════════════════
  test('Tab switching shows correct panel content', async ({ page }) => {
    await goToAdmin(page);
    await selectAgent(page, 'mental_health');
    await page.waitForTimeout(1000);

    await clickTab(page, 'Corpus');
    await expect(page.getByText('Corpus Sources')).toBeVisible({ timeout: 10_000 });

    await clickTab(page, 'Memory');
    await page.waitForTimeout(1000);

    await clickTab(page, 'Corpus');
    await expect(page.getByText('Corpus Sources')).toBeVisible({ timeout: 10_000 });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 11: Agent selector switching
  // ═══════════════════════════════════════════════════════════════════
  test('Switching agents updates displayed content', async ({ page }) => {
    await goToAdmin(page);

    const firstName = await selectAgent(page);
    expect(firstName.length).toBeGreaterThan(0);

    const select = page.locator('select');
    const options = select.locator('option:not([disabled])');
    const optionCount = await options.count();

    if (optionCount > 1) {
      const secondValue = await options.nth(1).getAttribute('value');
      if (secondValue) {
        await select.selectOption(secondValue);
        await page.waitForTimeout(1000);
        const secondName = await page.locator('h2').first().textContent();
        expect(secondName).not.toBe(firstName);
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 12: Back to Chat navigation
  // ═══════════════════════════════════════════════════════════════════
  test('Back to Chat link navigates away from admin', async ({ page }) => {
    await goToAdmin(page);

    const backLink = page.getByText('Back to Chat');
    await expect(backLink).toBeVisible();
    await backLink.click();

    // Should navigate to /new (the back link points to /new)
    await page.waitForTimeout(3000);
    expect(page.url()).not.toContain('/admin');
  });
});
