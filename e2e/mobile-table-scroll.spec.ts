/**
 * Mobile Table Display E2E Test
 *
 * Verifies that IRR tables display correctly on mobile viewports:
 *   1. All 6 columns fit within the mobile screen (abbreviated headers)
 *   2. All data is readable and contains valid values
 *   3. Table does not overflow or get clipped
 *
 * Prerequisites:
 *   - Frontend: npm run dev (port 5173)
 *   - Backend: ./start-all.sh (chatservice:8080 + mcprealestate:8000 + Redis)
 *
 * Run:
 *   npx playwright test e2e/mobile-table-scroll.spec.ts --headed
 */

import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Mobile viewport — iPhone 14 dimensions
// ---------------------------------------------------------------------------
const MOBILE_VIEWPORT = { width: 390, height: 844 };

// ---------------------------------------------------------------------------
// Helpers (shared with mother-test, kept local for independence)
// ---------------------------------------------------------------------------

async function sendMessage(page: Page, text: string) {
  const input = page.locator('textarea').first();
  await input.waitFor({ state: 'visible', timeout: 10_000 });
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await input.fill(text);
  await page.waitForTimeout(300);
  await input.press('Enter');
}

async function waitForResponse(page: Page, timeoutMs = 90_000) {
  try {
    await page.getByText('Thinking...').waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    // Response may have been instant
  }
  await page.getByText('Thinking...').waitFor({ state: 'hidden', timeout: timeoutMs });
  await page.waitForTimeout(2000);
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

test.describe('Mobile Table Display', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport BEFORE navigation
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/chataiagent/');
    await page.waitForTimeout(3000);
  });

  test('IRR table fits and displays all columns on mobile', async ({ page }) => {
    // =================================================================
    // Navigate to new chat on mobile
    // =================================================================
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(1000);

    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 10_000 });

    // =================================================================
    // TURN 1: Send a simple RE scenario to generate an IRR table
    // =================================================================
    await sendMessage(
      page,
      '1.5 cr house, 10% down payment, 7.8% interest, ' +
      'immediate possession. Expect price 2 cr in 3 years.'
    );

    await waitForResponse(page);

    // --- Click Confirm if it appears ---
    const confirmButton = page.getByRole('button', { name: 'Confirm & Calculate' });
    try {
      await expect(confirmButton).toBeVisible({ timeout: 30_000 });
      await confirmButton.click();
      await expect(page.getByText('Confirmed')).toBeVisible({ timeout: 5_000 });
      await waitForResponse(page);
    } catch {
      // Some flows skip confirmation — continue if table appears directly
      console.log('No confirmation button — checking for direct table output');
    }

    // =================================================================
    // Wait for IRR table to appear
    // =================================================================
    const irrTable = page.locator('table').filter({ hasText: 'Y1' }).last();
    await expect(irrTable, 'IRR table should appear on the page').toBeVisible({ timeout: 60_000 });

    // =================================================================
    // CHECK 1: All 6 column headers exist in the DOM
    // =================================================================
    const headers = irrTable.locator('thead th');
    const headerCount = await headers.count();
    expect(headerCount, 'IRR table must have exactly 6 columns').toBe(6);

    // On mobile, headers are abbreviated (e.g. "Value" instead of "House Value")
    // Verify all 6 headers have text content
    for (let i = 0; i < headerCount; i++) {
      const headerText = (await headers.nth(i).textContent())?.trim() || '';
      expect(headerText.length, `Column ${i} header should have text`).toBeGreaterThan(0);
    }

    console.log('\n=== MOBILE TABLE LAYOUT ===');
    console.log(`Viewport: ${MOBILE_VIEWPORT.width}x${MOBILE_VIEWPORT.height}`);

    // =================================================================
    // CHECK 2: Table fits within viewport (no horizontal overflow)
    // =================================================================
    const scrollContainer = irrTable.locator('xpath=ancestor::div[contains(@class, "overflow-x-auto")]').first();

    const scrollInfo = await scrollContainer.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));

    console.log(`Container clientWidth: ${scrollInfo.clientWidth}px`);
    console.log(`Table scrollWidth: ${scrollInfo.scrollWidth}px`);
    console.log(`Fits without scroll: ${scrollInfo.scrollWidth <= scrollInfo.clientWidth}`);

    // Table should fit or overflow only slightly (< 10px tolerance for borders)
    expect(
      scrollInfo.scrollWidth,
      `Table (${scrollInfo.scrollWidth}px) should fit within container (${scrollInfo.clientWidth}px) ` +
      `on mobile with abbreviated headers`
    ).toBeLessThanOrEqual(scrollInfo.clientWidth + 10);

    // =================================================================
    // CHECK 3: All 6 columns are visible without scrolling
    // =================================================================
    for (let i = 0; i < headerCount; i++) {
      const bounds = await headers.nth(i).boundingBox();
      expect(bounds, `Column ${i} should have a bounding box`).toBeTruthy();

      const headerText = (await headers.nth(i).textContent())?.trim() || '';
      console.log(`  Col ${i} "${headerText}": x=${bounds!.x.toFixed(0)}, w=${bounds!.width.toFixed(0)}`);

      // Column should be within viewport
      expect(
        bounds!.x + bounds!.width,
        `Column ${i} ("${headerText}") right edge should be within viewport (${MOBILE_VIEWPORT.width}px)`
      ).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 5);

      expect(
        bounds!.x,
        `Column ${i} ("${headerText}") should not be clipped on left`
      ).toBeGreaterThanOrEqual(-1);
    }

    // =================================================================
    // CHECK 4: All data rows have 6 cells with values
    // =================================================================
    const dataRows = irrTable.locator('tbody tr');
    const rowCount = await dataRows.count();
    expect(rowCount, 'Table should have data rows').toBeGreaterThan(0);

    for (let r = 0; r < Math.min(rowCount, 5); r++) {
      const cells = dataRows.nth(r).locator('td');
      const cellCount = await cells.count();
      expect(cellCount, `Row ${r} should have exactly 6 cells`).toBe(6);

      // Each cell should have content
      for (let c = 0; c < cellCount; c++) {
        const cellText = (await cells.nth(c).textContent())?.trim() || '';
        expect(
          cellText.length,
          `Row ${r} Cell ${c} should have content`
        ).toBeGreaterThan(0);
      }

      // Last column should have a currency value
      const lastCellText = (await cells.nth(5).textContent())?.trim() || '';
      expect(
        lastCellText.match(/[₹CrL\d]/i),
        `Row ${r} last column should be a currency value, got "${lastCellText}"`
      ).toBeTruthy();
    }

    // =================================================================
    // CHECK 5: Last column (Net Sale / Net Sale Proceeds) is visible
    // =================================================================
    const lastHeaderBounds = await headers.nth(5).boundingBox();
    expect(lastHeaderBounds, 'Last column header should have a bounding box').toBeTruthy();
    expect(
      lastHeaderBounds!.x,
      '"Net Sale" column should be visible (x >= 0)'
    ).toBeGreaterThanOrEqual(0);
    expect(
      lastHeaderBounds!.x + lastHeaderBounds!.width,
      '"Net Sale" column should fit within viewport'
    ).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 5);

    console.log('\n=== MOBILE TABLE DISPLAY TESTS PASSED ===\n');
  });

  test('Header stays visible when chat input is focused', async ({ page }) => {
    // =================================================================
    // Navigate to new chat
    // =================================================================
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(1000);

    // =================================================================
    // CHECK: Header is visible before focus
    // =================================================================
    const header = page.locator('header, [class*="ChatHeader"], .flex.h-14').first();
    const headerBefore = await header.boundingBox();
    expect(headerBefore, 'Header should be visible before input focus').toBeTruthy();
    expect(headerBefore!.y, 'Header should be near top of page').toBeLessThan(100);

    // =================================================================
    // Focus the input (simulates keyboard opening)
    // =================================================================
    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 10_000 });
    await chatInput.focus();
    await page.waitForTimeout(500);

    // =================================================================
    // CHECK: Header is still in the DOM and positioned correctly
    // The header wrapper should NOT have position:fixed on mobile
    // (which causes it to disappear on iOS when keyboard opens)
    // =================================================================
    const headerWrapper = page.locator('main > div').first();
    const position = await headerWrapper.evaluate((el) => {
      return window.getComputedStyle(el).position;
    });

    console.log(`Header wrapper position: ${position}`);
    // Should be 'static' or 'relative' — NOT 'fixed'
    expect(
      position,
      `Header wrapper should NOT be position:fixed on mobile (causes iOS keyboard issues), got "${position}"`
    ).not.toBe('fixed');

    console.log('\n=== HEADER VISIBILITY TEST PASSED ===\n');
  });
});
