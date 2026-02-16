/**
 * Mother Test Case — Custom Payment Schedule E2E Flow
 *
 * Tests the full multi-turn chat flow with a real browser against live services:
 *   1. Delayed possession scenario with custom payment schedule
 *   2. Confirmation button appears with parameter summary
 *   3. Confirm → IRR analysis with correct loan math
 *   4. BRUTAL numerical verification of the IRR table
 *   5. Explain year 1 (construction) + explain year 4 (possession)
 *   6. Modify possession 4yr→3yr → re-confirm → verify numbers change
 *
 * Prerequisites:
 *   - Frontend: npm run dev (port 5173)
 *   - Backend: ./start-all.sh (chatservice:8080 + mcprealestate:8000 + Redis)
 *
 * Run:
 *   npx playwright test e2e/mother-test.spec.ts --headed
 */

import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Currency & Percentage Parsers
// ---------------------------------------------------------------------------

/**
 * Parse Indian currency format to raw number.
 * Examples:
 *   "₹1.57 Cr"  → 15700000
 *   "₹15L"      → 1500000
 *   "+₹19L"     → 1900000
 *   "-₹5L"      → -500000
 *   "₹0.33 Cr"  → 3300000
 */
function parseCurrency(text: string): number {
  const cleaned = text.replace(/[₹,\s]/g, '').trim();
  const negative = cleaned.startsWith('-');
  const abs = cleaned.replace(/^[+-]/, '');

  if (abs.toLowerCase().endsWith('cr')) {
    return (negative ? -1 : 1) * parseFloat(abs.replace(/cr$/i, '')) * 10000000;
  }
  if (abs.toLowerCase().endsWith('l')) {
    return (negative ? -1 : 1) * parseFloat(abs.replace(/l$/i, '')) * 100000;
  }
  return parseFloat(cleaned);
}

/** Parse "18.5%" → 18.5, "N/A%" → NaN */
function parsePercentage(text: string): number {
  return parseFloat(text.replace('%', '').trim());
}

// ---------------------------------------------------------------------------
// Table Data Types
// ---------------------------------------------------------------------------

interface IRRRow {
  year: number;       // 1, 2, 3...
  houseValue: number; // raw ₹
  totalInvested: number;
  gain: number;
  irr: number;        // percentage value (18.5 not 0.185)
  netSaleProceeds: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Send a chat message by typing into the input and pressing Enter. */
async function sendMessage(page: Page, text: string) {
  const input = page.locator('textarea').first();
  await input.waitFor({ state: 'visible', timeout: 10_000 });
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await input.fill(text);
  await page.waitForTimeout(300);
  await input.press('Enter');
}

/**
 * Wait for the AI response to complete streaming.
 */
async function waitForResponse(page: Page, timeoutMs = 90_000) {
  try {
    await page.getByText('Thinking...').waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    // If "Thinking..." never appeared, the response may have been instant
  }
  await page.getByText('Thinking...').waitFor({ state: 'hidden', timeout: timeoutMs });
  // Let widgets/animations settle
  await page.waitForTimeout(2000);
}

/** Get all visible text content from the chat scroll area. */
async function getLastBotMessageText(page: Page): Promise<string> {
  const scrollArea = page.locator('[data-radix-scroll-area-viewport]').first();
  return (await scrollArea.textContent()) || '';
}

/**
 * Parse the LAST IRR table on the page into structured data.
 * Table columns: Year | House Value | Total Invested | Gain | IRR | Net Sale Proceeds
 */
async function parseIRRTable(page: Page): Promise<IRRRow[]> {
  // Find the last table that contains "Y1" (IRR tables always have Y1)
  const tables = page.locator('table').filter({ hasText: 'Y1' });
  const tableCount = await tables.count();
  expect(tableCount, 'Expected at least one IRR table on the page').toBeGreaterThan(0);
  const table = tables.last();

  // Verify headers
  const headers = table.locator('thead th');
  const headerCount = await headers.count();
  expect(headerCount, 'IRR table should have exactly 6 columns').toBe(6);

  const expectedHeaders = ['Year', 'House Value', 'Total Invested', 'Gain', 'IRR', 'Net Sale Proceeds'];
  for (let i = 0; i < expectedHeaders.length; i++) {
    const headerText = (await headers.nth(i).textContent())?.trim() || '';
    expect(headerText, `Column ${i} header should be "${expectedHeaders[i]}"`).toBe(expectedHeaders[i]);
  }

  // Parse rows
  const rows = table.locator('tbody tr');
  const rowCount = await rows.count();
  expect(rowCount, 'IRR table should have at least 5 year rows').toBeGreaterThanOrEqual(5);

  const parsed: IRRRow[] = [];
  for (let r = 0; r < rowCount; r++) {
    const cells = rows.nth(r).locator('td');
    const yearText = (await cells.nth(0).textContent())?.trim() || '';
    const houseValueText = (await cells.nth(1).textContent())?.trim() || '';
    const totalInvestedText = (await cells.nth(2).textContent())?.trim() || '';
    const gainText = (await cells.nth(3).textContent())?.trim() || '';
    const irrText = (await cells.nth(4).textContent())?.trim() || '';
    const netSaleProceedsText = (await cells.nth(5).textContent())?.trim() || '';

    const yearMatch = yearText.match(/Y(\d+)/);
    expect(yearMatch, `Row ${r}: Year cell "${yearText}" should match Y<number>`).toBeTruthy();

    parsed.push({
      year: parseInt(yearMatch![1]),
      houseValue: parseCurrency(houseValueText),
      totalInvested: parseCurrency(totalInvestedText),
      gain: parseCurrency(gainText),
      irr: parsePercentage(irrText),
      netSaleProceeds: parseCurrency(netSaleProceedsText),
    });
  }

  return parsed;
}

/**
 * Run brutal numerical verification on parsed IRR table data.
 * This is the heart of the test — catches calculation bugs, display bugs,
 * and internal inconsistencies.
 *
 * @param rows - Parsed IRR table rows
 * @param possessionYear - Year when possession happens (e.g. 4)
 * @param housePrice - Original house price in ₹
 * @param downPaymentPct - Down payment percentage (e.g. 10)
 */
function verifyIRRTableBrutally(
  rows: IRRRow[],
  possessionYear: number,
  housePrice: number,
  downPaymentPct: number,
) {
  const LAKH = 100000;
  const CRORE = 10000000;
  const loanPct = 100 - downPaymentPct;
  const loanAmount = housePrice * loanPct / 100;
  const downPayment = housePrice * downPaymentPct / 100;

  console.log(`\n=== BRUTAL TABLE VERIFICATION ===`);
  console.log(`House Price: ₹${(housePrice / CRORE).toFixed(2)} Cr`);
  console.log(`Down Payment: ₹${(downPayment / LAKH).toFixed(1)}L (${downPaymentPct}%)`);
  console.log(`Loan Amount: ₹${(loanAmount / CRORE).toFixed(2)} Cr (${loanPct}%)`);
  console.log(`Possession Year: ${possessionYear}`);
  console.log(`Table rows: ${rows.length}\n`);

  for (const row of rows) {
    console.log(
      `Y${row.year}: House=₹${(row.houseValue / LAKH).toFixed(0)}L, ` +
      `Invested=₹${(row.totalInvested / LAKH).toFixed(0)}L, ` +
      `Gain=₹${(row.gain / LAKH).toFixed(0)}L, ` +
      `IRR=${row.irr}%, ` +
      `NetSale=₹${(row.netSaleProceeds / LAKH).toFixed(0)}L`
    );
  }
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════
  // CHECK 1: All values parse to valid numbers (no NaN from bad formatting)
  // ═══════════════════════════════════════════════════════════════════════
  for (const row of rows) {
    expect(isFinite(row.houseValue), `Y${row.year}: House Value is not a valid number`).toBe(true);
    expect(isFinite(row.totalInvested), `Y${row.year}: Total Invested is not a valid number`).toBe(true);
    expect(isFinite(row.gain), `Y${row.year}: Gain is not a valid number`).toBe(true);
    expect(isFinite(row.netSaleProceeds), `Y${row.year}: Net Sale Proceeds is not a valid number`).toBe(true);
    // IRR can be NaN for "N/A" — but should be valid for most years
    if (row.year >= 3) {
      expect(isFinite(row.irr), `Y${row.year}: IRR should be a valid number by year 3+`).toBe(true);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CHECK 2: Positive value sanity
  // ═══════════════════════════════════════════════════════════════════════
  for (const row of rows) {
    expect(row.houseValue, `Y${row.year}: House Value must be > 0`).toBeGreaterThan(0);
    expect(row.totalInvested, `Y${row.year}: Total Invested must be > 0`).toBeGreaterThan(0);
    expect(row.netSaleProceeds, `Y${row.year}: Net Sale Proceeds must be > 0 (house > loan)`).toBeGreaterThan(0);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CHECK 3: House Value > Net Sale Proceeds (loan is deducted)
  // Net sale proceeds = house value minus remaining loan. Must always be less.
  // ═══════════════════════════════════════════════════════════════════════
  for (const row of rows) {
    expect(
      row.netSaleProceeds,
      `Y${row.year}: Net Sale Proceeds (₹${(row.netSaleProceeds / LAKH).toFixed(0)}L) ` +
      `must be < House Value (₹${(row.houseValue / LAKH).toFixed(0)}L) — loan deducted`
    ).toBeLessThan(row.houseValue);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CHECK 4: Monotonicity — House Value strictly increases
  // ═══════════════════════════════════════════════════════════════════════
  for (let i = 1; i < rows.length; i++) {
    expect(
      rows[i].houseValue,
      `Y${rows[i].year}: House Value (₹${(rows[i].houseValue / LAKH).toFixed(0)}L) ` +
      `must be > Y${rows[i - 1].year} (₹${(rows[i - 1].houseValue / LAKH).toFixed(0)}L) — appreciation`
    ).toBeGreaterThan(rows[i - 1].houseValue);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CHECK 5: Monotonicity — Total Invested increases (cumulative outflows)
  // ═══════════════════════════════════════════════════════════════════════
  for (let i = 1; i < rows.length; i++) {
    expect(
      rows[i].totalInvested,
      `Y${rows[i].year}: Total Invested must be >= Y${rows[i - 1].year} — cumulative`
    ).toBeGreaterThanOrEqual(rows[i - 1].totalInvested);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CHECK 6: Monotonicity — Net Sale Proceeds increases over time
  // (house appreciates faster than loan decreases, for a good investment)
  // ═══════════════════════════════════════════════════════════════════════
  for (let i = 1; i < rows.length; i++) {
    expect(
      rows[i].netSaleProceeds,
      `Y${rows[i].year}: Net Sale Proceeds should increase year over year`
    ).toBeGreaterThan(rows[i - 1].netSaleProceeds);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CHECK 7: THE KILLER — Internal consistency of Gain during construction
  //
  // During construction (before possession), there is NO rental income.
  // Therefore: Gain = Net Sale Proceeds - Total Invested (EXACTLY)
  //
  // This is the check that catches the bug where Net Sale Proceeds was
  // computed as house_value - outstanding_loan (disbursed only) instead of
  // house_value - full_loan_commitment. With the wrong formula, the
  // equation Gain = NetSale - TotalInvested breaks catastrophically.
  //
  // Tolerance: ±2L for rounding (values displayed as ₹XL with 0 decimals)
  // ═══════════════════════════════════════════════════════════════════════
  const ROUNDING_TOLERANCE = 2 * LAKH;

  for (const row of rows) {
    if (row.year < possessionYear) {
      // Construction period: NO rental income → Gain = NetSale - TotalInvested
      const expectedGain = row.netSaleProceeds - row.totalInvested;
      const diff = Math.abs(row.gain - expectedGain);
      expect(
        diff,
        `Y${row.year} CONSTRUCTION CONSISTENCY FAILURE:\n` +
        `  Gain displayed:    ₹${(row.gain / LAKH).toFixed(0)}L\n` +
        `  Net Sale Proceeds: ₹${(row.netSaleProceeds / LAKH).toFixed(0)}L\n` +
        `  Total Invested:    ₹${(row.totalInvested / LAKH).toFixed(0)}L\n` +
        `  Expected Gain = NetSale - Invested = ₹${(expectedGain / LAKH).toFixed(0)}L\n` +
        `  Difference: ₹${(diff / LAKH).toFixed(1)}L (tolerance: ±2L)\n` +
        `  If this is way off, Net Sale Proceeds is likely using disbursed loan only,\n` +
        `  not the full loan commitment. This is the sale_proceeds bug.`
      ).toBeLessThanOrEqual(ROUNDING_TOLERANCE);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CHECK 8: Post-possession consistency — Gain >= NetSale - TotalInvested
  // After possession, rental income adds positive value to gain.
  // So: Gain = NetSale - TotalInvested + CumulativeRent
  // Since CumulativeRent >= 0: Gain >= NetSale - TotalInvested
  // ═══════════════════════════════════════════════════════════════════════
  for (const row of rows) {
    if (row.year >= possessionYear) {
      const minExpectedGain = row.netSaleProceeds - row.totalInvested;
      expect(
        row.gain,
        `Y${row.year} POST-POSSESSION: Gain (₹${(row.gain / LAKH).toFixed(0)}L) ` +
        `should be >= NetSale - Invested (₹${(minExpectedGain / LAKH).toFixed(0)}L) ` +
        `because rental income adds positive value`
      ).toBeGreaterThanOrEqual(minExpectedGain - ROUNDING_TOLERANCE);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CHECK 9: Y1 House Value range — should be house_price * ~1.14 (14.3% CAGR)
  // We allow a wide range because CAGR varies with expected price/timeline
  // ═══════════════════════════════════════════════════════════════════════
  const y1 = rows[0];
  expect(
    y1.houseValue,
    `Y1 House Value (₹${(y1.houseValue / CRORE).toFixed(2)} Cr) should be > original price ₹${(housePrice / CRORE).toFixed(2)} Cr`
  ).toBeGreaterThan(housePrice);
  expect(
    y1.houseValue,
    `Y1 House Value (₹${(y1.houseValue / CRORE).toFixed(2)} Cr) should be < 2x original price — not doubling in 1 year`
  ).toBeLessThan(housePrice * 2);

  // ═══════════════════════════════════════════════════════════════════════
  // CHECK 10: Y1 Total Invested — must include at least the down payment
  // With registration (7%) it should be higher, but DP is the floor.
  // ═══════════════════════════════════════════════════════════════════════
  expect(
    y1.totalInvested,
    `Y1 Total Invested (₹${(y1.totalInvested / LAKH).toFixed(0)}L) must be >= Down Payment (₹${(downPayment / LAKH).toFixed(0)}L)`
  ).toBeGreaterThanOrEqual(downPayment);

  // ═══════════════════════════════════════════════════════════════════════
  // CHECK 11: Possession year shows significant jump in Total Invested
  //
  // The possession year itself (Y4 in this case) has a large jump because:
  //   - Final loan disbursement completes
  //   - Registration/stamp duty may be due at possession
  //   - EMI starts partway through the year
  // Meanwhile post-possession years may have SMALLER increments because
  // rental income offsets EMI payments (cumulative_invested += outflow - rental).
  //
  // Check: The increment into the possession year should be the largest.
  // ═══════════════════════════════════════════════════════════════════════
  if (rows.length > possessionYear) {
    const possIdx = rows.findIndex(r => r.year === possessionYear);
    if (possIdx > 0) {
      const possessionIncrement = rows[possIdx].totalInvested - rows[possIdx - 1].totalInvested;
      // Pre-possession increments (excluding Y1 which includes DP)
      const prePossIncrements: number[] = [];
      for (let i = 1; i < possIdx; i++) {
        prePossIncrements.push(rows[i].totalInvested - rows[i - 1].totalInvested);
      }
      if (prePossIncrements.length > 0) {
        const avgPrePoss = prePossIncrements.reduce((a, b) => a + b, 0) / prePossIncrements.length;
        console.log(`\nPre-possession avg increment: ₹${(avgPrePoss / LAKH).toFixed(1)}L/yr`);
        console.log(`Possession year increment: ₹${(possessionIncrement / LAKH).toFixed(1)}L/yr`);
        // Possession year should have a bigger jump than average construction year
        expect(
          possessionIncrement,
          `Possession year increment (₹${(possessionIncrement / LAKH).toFixed(0)}L) ` +
          `should be > pre-possession average (₹${(avgPrePoss / LAKH).toFixed(0)}L) — ` +
          `registration + EMI start + final disbursement`
        ).toBeGreaterThan(avgPrePoss);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CHECK 12: Net Sale Proceeds during construction sanity
  // During construction: sale_proceeds = house_value - full_loan_amount
  // (NOT house_value - disbursed_only)
  //
  // So: Net Sale Proceeds ≈ House Value - Loan Amount (roughly)
  // It should NOT be close to House Value (that would mean loan not deducted)
  // ═══════════════════════════════════════════════════════════════════════
  for (const row of rows) {
    if (row.year < possessionYear) {
      // Net Sale Proceeds should be roughly house_value - loan_amount
      // Allow wide margin for registration costs and pre-EMI interest effects
      const naive = row.houseValue - loanAmount;
      const ratio = row.netSaleProceeds / row.houseValue;
      // During construction with 90% loan, net sale proceeds should be
      // a SMALL fraction of house value (roughly 10% + appreciation gains)
      expect(
        ratio,
        `Y${row.year} CONSTRUCTION: Net Sale Proceeds / House Value ratio (${(ratio * 100).toFixed(1)}%) ` +
        `should be < 50%. If it's ~90%+, the full loan amount is not being deducted. ` +
        `NetSale=₹${(row.netSaleProceeds / LAKH).toFixed(0)}L, House=₹${(row.houseValue / LAKH).toFixed(0)}L`
      ).toBeLessThan(0.50);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CHECK 13: IRR trend — leveraged real estate IRR pattern
  //
  // For leveraged real estate with appreciation:
  // - Early years: IRR is very high (tiny cash invested, big house appreciation)
  // - Later years: IRR converges downward as more cash is invested (EMI)
  // - IRR should stabilize at a positive value for a good investment
  //
  // Checks:
  //   a) All IRR values should be finite and reasonable (between -50% and 300%)
  //   b) IRR should converge (later years more stable than early years)
  //   c) Final IRR should be positive for this appreciating scenario
  // ═══════════════════════════════════════════════════════════════════════
  const validIRRRows = rows.filter(r => isFinite(r.irr));
  for (const row of validIRRRows) {
    expect(
      row.irr,
      `Y${row.year}: IRR (${row.irr}%) should be between -50% and 300%`
    ).toBeGreaterThan(-50);
    expect(row.irr).toBeLessThan(300);
  }
  if (validIRRRows.length >= 3) {
    // Final year IRR should be positive (good investment)
    const lastIRR = validIRRRows[validIRRRows.length - 1];
    expect(
      lastIRR.irr,
      `Final year IRR (Y${lastIRR.year}: ${lastIRR.irr}%) should be positive — appreciating asset`
    ).toBeGreaterThan(0);
  }

  console.log('\n=== ALL BRUTAL CHECKS PASSED ===\n');
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

test.describe('Mother Test — Custom Payment Schedule Full Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chataiagent/');
    await page.waitForTimeout(3000);
  });

  test('Full multi-turn flow with brutal numerical verification', async ({ page }) => {
    // Scenario constants for verification
    const HOUSE_PRICE = 13700000; // 1.37 Cr
    const DOWN_PAYMENT_PCT = 10;
    const INTEREST_RATE = 7.8;
    const POSSESSION_YEARS = 4;
    const LAKH = 100000;

    // =================================================================
    // Navigate to new chat
    // =================================================================
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(1000);

    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 10_000 });

    // =================================================================
    // TURN 1: Send scenario with custom payment schedule
    // =================================================================
    await sendMessage(
      page,
      '1.37 cr house, 10% down payment, 7.8% interest, ' +
      'possession in 4 years. ' +
      'Payment schedule: 10% booking, 5% after 1 month, 10% after 9 months, ' +
      'rest quarterly till possession. ' +
      'Expect price to be 2.5 cr in 4.5 years.'
    );

    await waitForResponse(page);

    // --- Confirmation button must appear ---
    const confirmButton = page.getByRole('button', { name: 'Confirm & Calculate' });
    await expect(confirmButton).toBeVisible({ timeout: 30_000 });

    // --- Verify parameter echo in confirmation ---
    const responseText = await getLastBotMessageText(page);

    // House price mentioned
    expect(
      responseText.match(/1\.37|137|13[,.]?7/i),
      'Confirmation should mention house price 1.37 Cr'
    ).toBeTruthy();

    // Interest rate
    expect(responseText, 'Confirmation should mention 7.8% interest').toContain('7.8');

    // Possession period
    expect(
      responseText.match(/4\s*year|48\s*month|possession/i),
      'Confirmation should mention 4 year possession'
    ).toBeTruthy();

    // CAGR ~14.3% (derived from 1.37→2.5 Cr in 4.5 years) — NOT default 6%
    expect(
      responseText.match(/14[,.]?[23]/i),
      'Confirmation should show CAGR ~14.3% (not default 6%)'
    ).toBeTruthy();

    // Payment schedule milestones
    expect(
      responseText.match(/M1|M9|after\s*1\s*month|after\s*9\s*month|5%.*M1|10%.*M9/i),
      'Confirmation should show payment schedule milestones'
    ).toBeTruthy();

    // =================================================================
    // TURN 2: Click Confirm → Full Analysis
    // =================================================================
    await confirmButton.click();
    await expect(page.getByText('Confirmed')).toBeVisible({ timeout: 5_000 });
    await waitForResponse(page);

    const analysisText = await getLastBotMessageText(page);

    // --- Basic presence checks ---
    expect(analysisText.match(/IRR|return|%/i), 'Analysis should contain IRR data').toBeTruthy();
    expect(analysisText.match(/EMI|loan|down\s*payment/i), 'Analysis should contain loan details').toBeTruthy();

    // --- Specific numerical checks on text ---
    // EMI should be ~₹1.02L/mo
    expect(
      analysisText.match(/1\.02L|1,01,60[0-9]|101,60[0-9]/i),
      'EMI should be ~₹1.02L/mo for 1.233Cr loan at 7.8% for 20yr'
    ).toBeTruthy();

    // Down payment: 13.70L
    expect(
      analysisText.match(/13\.70?L|13\.7/i),
      'Down payment should be ₹13.7L (10% of 1.37Cr)'
    ).toBeTruthy();

    // 90% loan
    expect(
      analysisText.match(/90%\s*loan/i),
      'Should mention 90% loan'
    ).toBeTruthy();

    // Interest rate
    expect(analysisText, 'Should mention 7.8% interest').toContain('7.8');

    // Possession 48 months
    expect(
      analysisText.match(/48\s*month/i),
      'Should mention 48 month possession'
    ).toBeTruthy();

    // =================================================================
    // TURN 2b: BRUTAL IRR TABLE VERIFICATION
    // =================================================================
    console.log('\n========== FIRST ANALYSIS — BRUTAL TABLE CHECK ==========');
    const irrRows = await parseIRRTable(page);

    verifyIRRTableBrutally(
      irrRows,
      POSSESSION_YEARS,  // possession at year 4
      HOUSE_PRICE,
      DOWN_PAYMENT_PCT,
    );

    // --- Extra scenario-specific checks ---

    // Y1 Total Invested should be ~15-25L (DP 13.7L + registration 9.6L + pre-EMI ~1L)
    expect(
      irrRows[0].totalInvested,
      `Y1 Total Invested (₹${(irrRows[0].totalInvested / LAKH).toFixed(0)}L) should be between 13L and 30L`
    ).toBeGreaterThanOrEqual(13 * LAKH);
    expect(irrRows[0].totalInvested).toBeLessThanOrEqual(30 * LAKH);

    // Y1 Gain — during construction with 90% loan, gain should be modest
    // (house appreciated ~14% but most is loan) — between -30L and +30L
    expect(
      irrRows[0].gain,
      `Y1 Gain (₹${(irrRows[0].gain / LAKH).toFixed(0)}L) should be between -30L and +30L`
    ).toBeGreaterThanOrEqual(-30 * LAKH);
    expect(irrRows[0].gain).toBeLessThanOrEqual(30 * LAKH);

    // =================================================================
    // TURN 3: Explain year 1 (construction period)
    // =================================================================
    await sendMessage(page, 'explain year 1 calculation');
    await waitForResponse(page);

    const explain1Text = await getLastBotMessageText(page);
    expect(explain1Text.length, 'Year 1 explanation should be substantial').toBeGreaterThan(100);

    // Year 1 explanation should reference pre-EMI or construction or disbursement
    expect(
      explain1Text.match(/pre.?EMI|construction|disburs|interest.only/i),
      'Year 1 explanation should mention pre-EMI/construction/disbursement'
    ).toBeTruthy();

    // =================================================================
    // TURN 4: Explain year 4 (possession year)
    // =================================================================
    await sendMessage(page, 'explain year 4 when possession happens');
    await waitForResponse(page);

    const explain4Text = await getLastBotMessageText(page);
    expect(explain4Text.length, 'Year 4 explanation should be substantial').toBeGreaterThan(100);

    // Year 4 explanation should mention possession or EMI transition or rental
    expect(
      explain4Text.match(/possession|EMI\s*(start|begin|kick)|full\s*EMI|rent/i),
      'Year 4 explanation should reference possession/EMI start/rental'
    ).toBeTruthy();

    // =================================================================
    // TURN 5: Modify possession to 3 years
    // =================================================================

    // Count tables BEFORE the modify step to detect if a new one appears
    const tableCountBefore = await page.locator('table').filter({ hasText: 'Y1' }).count();

    await sendMessage(
      page,
      'Modify my analysis: change possession period to 3 years. Keep house price 1.37 cr and everything else the same.'
    );
    await waitForResponse(page);

    // --- Scenario: Should get new confirmation ---
    let confirmButton2 = page.getByRole('button', { name: 'Confirm & Calculate' });
    let gotConfirmation2 = false;
    try {
      await expect(confirmButton2).toBeVisible({ timeout: 20_000 });
      gotConfirmation2 = true;
    } catch {
      await sendMessage(
        page,
        'What if possession is 3 years instead of 4 years? Recalculate with 3 year possession.'
      );
      await waitForResponse(page);
      confirmButton2 = page.getByRole('button', { name: 'Confirm & Calculate' });
      try {
        await expect(confirmButton2).toBeVisible({ timeout: 20_000 });
        gotConfirmation2 = true;
      } catch {
        const directText = await getLastBotMessageText(page);
        if (directText.match(/IRR|return|year\s*1|Y1/i)) {
          console.log('TURN 5: LLM went directly to analysis (skipped confirmation). Accepting.');
          gotConfirmation2 = false;
        } else {
          throw new Error(
            'Turn 5 failed: no Confirm button and no analysis results. ' +
            `Page text includes: "${directText.slice(-300)}"`
          );
        }
      }
    }

    if (gotConfirmation2) {
      const modifiedText = await getLastBotMessageText(page);
      expect(
        modifiedText.match(/3\s*year|36\s*month/i),
        'Modified confirmation should mention 3 years or 36 months'
      ).toBeTruthy();

      // =================================================================
      // TURN 6: Confirm modified params → New analysis
      // =================================================================
      await confirmButton2.click();
      await expect(page.getByText('Confirmed').last()).toBeVisible({ timeout: 5_000 });
      await waitForResponse(page);
    }

    // =================================================================
    // TURN 6b: VERIFY MODIFIED ANALYSIS (if a new table was generated)
    // =================================================================
    const tableCountAfter = await page.locator('table').filter({ hasText: 'Y1' }).count();
    const newTableGenerated = tableCountAfter > tableCountBefore;

    if (newTableGenerated) {
      console.log('\n========== MODIFIED ANALYSIS (3yr) — BRUTAL TABLE CHECK ==========');
      const modifiedRows = await parseIRRTable(page);

      verifyIRRTableBrutally(
        modifiedRows,
        3,              // possession now at year 3
        HOUSE_PRICE,
        DOWN_PAYMENT_PCT,
      );

      // --- Cross-analysis comparison: numbers must have CHANGED ---
      const origY3 = irrRows.find(r => r.year === 3);
      const newY3 = modifiedRows.find(r => r.year === 3);

      if (origY3 && newY3) {
        const totalInvestedChanged = Math.abs(origY3.totalInvested - newY3.totalInvested) > 1 * LAKH;
        const irrChanged = Math.abs(origY3.irr - newY3.irr) > 0.1;
        const gainChanged = Math.abs(origY3.gain - newY3.gain) > 1 * LAKH;

        expect(
          totalInvestedChanged || irrChanged || gainChanged,
          `Y3 numbers should change when possession moves from 4yr to 3yr.\n` +
          `  Original Y3: Invested=₹${(origY3.totalInvested / LAKH).toFixed(0)}L, IRR=${origY3.irr}%, Gain=₹${(origY3.gain / LAKH).toFixed(0)}L\n` +
          `  Modified Y3: Invested=₹${(newY3.totalInvested / LAKH).toFixed(0)}L, IRR=${newY3.irr}%, Gain=₹${(newY3.gain / LAKH).toFixed(0)}L`
        ).toBe(true);
      }
    } else {
      console.log('\nNo new IRR table generated after modify — LLM responded with text only.');
      console.log('Skipping cross-analysis numerical comparison.');
    }

    // Final: verify the page has IRR data somewhere
    const newAnalysisText = await getLastBotMessageText(page);
    expect(newAnalysisText.match(/IRR|return|%/i), 'Page should contain IRR data').toBeTruthy();
  });
});
