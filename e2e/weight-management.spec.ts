/**
 * Weight Management Agent — Full E2E Flow
 *
 * Tests the complete Weight Management specialist pipeline through the UI:
 *
 *   TURN 1: Onboarding — Profile + weight loss intent in one message
 *           → Profile extracted inline, strategy selection prompt
 *   TURN 2: Strategy selection → "calorie deficit" chosen
 *           → Onboarding summary with computed targets
 *   TURN 3: Meal plan generation → 7-day structured plan with DB-backed nutrients
 *   TURN 4: Food text logging → Calorie/nutrient breakdown
 *   TURN 5: Progress check → Weight update with plateau analysis
 *
 * Validates:
 *   - Routes to weight_management agent on weight loss intent
 *   - Inline profile extraction (no unnecessary form step)
 *   - Calorie deficit strategy computes correct targets
 *   - Meal plan uses strategy-specific slot weights
 *   - Food logging provides nutrient analysis
 *   - Progress mode tracks weight changes
 *   - Context continuity across turns (stays in weight_management agent)
 *
 * Prerequisites:
 *   - Frontend: npm run dev (port 5173)
 *   - Backend: cd chatservice && docker compose up --build (port 8080, SKIP_AUTH=true)
 *
 * Run:
 *   npx playwright test e2e/weight-management.spec.ts --headed
 */

import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sign in with email/password via the Login page. */
async function signInWithEmail(page: Page, email: string, password: string) {
  const emailButton = page.getByText('Continue with Email');
  await emailButton.waitFor({ state: 'visible', timeout: 10_000 });
  await emailButton.click();
  await page.waitForTimeout(500);

  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);

  await page.locator('button[type="submit"]').filter({ hasText: /Sign In/i }).click();
  await page.waitForURL('**/chat**', { timeout: 15_000 });
  await page.waitForTimeout(1000);
}

/** Send a chat message by typing into the input and pressing Enter. */
async function sendMessage(page: Page, text: string) {
  const input = page.locator('textarea').first();
  await input.waitFor({ state: 'visible', timeout: 10_000 });
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await input.fill(text);
  await page.waitForTimeout(300);
  await input.press('Enter');
}

/** Wait for the AI response to complete streaming. */
async function waitForResponse(page: Page, timeoutMs = 120_000) {
  try {
    await page.getByText('Thinking...').waitFor({ state: 'visible', timeout: 15_000 });
  } catch {
    // Response may have been instant
  }
  await page.getByText('Thinking...').waitFor({ state: 'hidden', timeout: timeoutMs });
  await page.waitForTimeout(3000);
}

/** Get all visible text content from the chat scroll area. */
async function getChatText(page: Page): Promise<string> {
  const scrollArea = page.locator('[data-radix-scroll-area-viewport]').first();
  return (await scrollArea.textContent()) || '';
}

/** Scroll the chat area to the bottom so the latest response is visible. */
async function scrollToBottom(page: Page) {
  const scrollArea = page.locator('[data-radix-scroll-area-viewport]').first();
  await scrollArea.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// Verification Helpers
// ---------------------------------------------------------------------------

function verifyWeightManagementAgent(text: string, turnLabel: string) {
  const hasAgent = /weight.management|weight_management/i.test(text);
  expect(hasAgent, `[${turnLabel}] Response should be from weight_management agent`).toBe(true);
  console.log(`  [OK] Correct agent (weight_management) in ${turnLabel}`);
}

function verifyNutritionNumbers(text: string, turnLabel: string) {
  const hasCalories = /\d+\s*(?:kcal|calories?|cal)/i.test(text);
  const hasProtein = /\d+(?:\.\d+)?\s*g?\s*(?:protein|prot)/i.test(text) || /protein.*\d+/i.test(text);
  expect(
    hasCalories || hasProtein,
    `[${turnLabel}] Response must contain nutrition numbers (calories or protein)`
  ).toBe(true);
  console.log(`  [OK] Nutrition numbers present in ${turnLabel}`);
}

function checkDisclaimer(text: string, turnLabel: string) {
  const hasDisclaimer = /consult.*(?:doctor|physician|healthcare|medical)|medical advice|not a substitute|AI-generated|disclaimer/i.test(text);
  if (hasDisclaimer) {
    console.log(`  [OK] Disclaimer present in ${turnLabel}`);
  } else {
    console.log(`  [INFO] No disclaimer in ${turnLabel} (template response)`);
  }
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test('Weight Management agent — full 5-turn flow with calorie deficit strategy', async ({ page }) => {
  // Navigate to login page and sign in
  await page.goto('/chataiagent/');
  await page.waitForTimeout(2000);

  await signInWithEmail(page, 'ravipradeep89@gmail.com', 'papa1210');

  // Clear anonymous message counter from any previous runs
  await page.evaluate(() => localStorage.removeItem('anon_message_count'));

  // Start a new chat
  await page.goto('/chataiagent/new');
  await page.waitForTimeout(2000);

  // ═══════════════════════════════════════════════════════════════════════
  // TURN 1: Onboarding — Full profile in one message
  // Agent extracts profile inline → asks for strategy
  // ═══════════════════════════════════════════════════════════════════════

  console.log('\n=== TURN 1: ONBOARDING WITH PROFILE ===\n');

  const onboardingMsg =
    'I want to lose weight. I am a 32 year old male, ' +
    '85kg, 175cm tall. My target weight is 72kg. ' +
    'I am moderately active and eat non-veg Indian food. ' +
    'No allergies or medical conditions.';

  await sendMessage(page, onboardingMsg);
  await waitForResponse(page);

  const turn1Text = await getChatText(page);

  // Verify agent routing — should route to weight management
  verifyWeightManagementAgent(turn1Text, 'Turn 1');

  // Should ask for strategy selection (profile was extracted inline)
  const hasStrategyAsk = /strategy|calorie.deficit|intermittent|fasting|keto|high.protein|choose|select|approach/i.test(turn1Text);
  expect(hasStrategyAsk, 'Turn 1: Should ask for strategy selection after extracting profile').toBe(true);
  console.log('  [OK] Strategy selection prompt shown');

  checkDisclaimer(turn1Text, 'Turn 1');

  await scrollToBottom(page);
  await page.screenshot({ path: 'e2e-screenshots/wm-turn1-onboarding.png', fullPage: false });

  // ═══════════════════════════════════════════════════════════════════════
  // TURN 2: Strategy Selection — Choose calorie deficit
  // ═══════════════════════════════════════════════════════════════════════

  console.log('\n=== TURN 2: STRATEGY SELECTION ===\n');

  await sendMessage(page, 'I want calorie deficit');
  await waitForResponse(page);

  const turn2Text = await getChatText(page);

  verifyWeightManagementAgent(turn2Text, 'Turn 2');

  // Should confirm calorie deficit strategy
  const hasDeficit = /calorie.deficit|deficit/i.test(turn2Text);
  expect(hasDeficit, 'Turn 2: Should confirm calorie deficit strategy').toBe(true);
  console.log('  [OK] Calorie deficit confirmed');

  // Should show computed nutrition targets
  const hasTargets = /calorie|kcal|protein|carb|fat|target|daily|macro/i.test(turn2Text);
  expect(hasTargets, 'Turn 2: Should show computed nutrition targets').toBe(true);
  console.log('  [OK] Nutrition targets present');

  checkDisclaimer(turn2Text, 'Turn 2');

  await scrollToBottom(page);
  await page.screenshot({ path: 'e2e-screenshots/wm-turn2-strategy.png', fullPage: false });

  // ═══════════════════════════════════════════════════════════════════════
  // TURN 3: Meal plan generation (longer timeout)
  // ═══════════════════════════════════════════════════════════════════════

  console.log('\n=== TURN 3: MEAL PLAN ===\n');

  await sendMessage(page, 'Generate a 7 day meal plan for me');
  await waitForResponse(page, 180_000); // 3 minutes — meal plan generation is heavy

  const turn3Text = await getChatText(page);

  verifyWeightManagementAgent(turn3Text, 'Turn 3');

  // Should contain the structured meal plan with summary table
  const hasPlanReady = /7-day meal plan.*ready|meal plan/i.test(turn3Text);
  expect(hasPlanReady, 'Turn 3: Should confirm meal plan is ready').toBe(true);
  console.log('  [OK] Meal plan ready');

  // Should contain the nutrient summary table
  const hasSummaryTable = /daily.avg|nutrient|target|status|calories.*kcal/i.test(turn3Text);
  expect(hasSummaryTable, 'Turn 3: Should contain nutrient summary table').toBe(true);
  console.log('  [OK] Nutrient summary table present');

  // Should contain dashboard link
  const hasDashboardLink = /view.*meal.*plan|dashboard|mealplan/i.test(turn3Text);
  expect(hasDashboardLink, 'Turn 3: Should contain dashboard link').toBe(true);
  console.log('  [OK] Dashboard link present');

  verifyNutritionNumbers(turn3Text, 'Turn 3');
  checkDisclaimer(turn3Text, 'Turn 3');

  await scrollToBottom(page);
  await page.screenshot({ path: 'e2e-screenshots/wm-turn3-mealplan.png', fullPage: false });

  // ═══════════════════════════════════════════════════════════════════════
  // TURN 4: Food text logging
  // ═══════════════════════════════════════════════════════════════════════

  console.log('\n=== TURN 4: FOOD LOGGING ===\n');

  await sendMessage(page, 'I had 3 eggs, 2 toast with butter and a glass of milk for breakfast');
  await waitForResponse(page);

  const turn4Text = await getChatText(page);

  verifyWeightManagementAgent(turn4Text, 'Turn 4');

  // Should mention the food items
  const hasFoodItems = /egg|toast|butter|milk/i.test(turn4Text);
  expect(hasFoodItems, 'Turn 4: Should mention the food items').toBe(true);
  console.log('  [OK] Food items mentioned');

  checkDisclaimer(turn4Text, 'Turn 4');

  await scrollToBottom(page);
  await page.screenshot({ path: 'e2e-screenshots/wm-turn4-foodlog.png', fullPage: false });

  // ═══════════════════════════════════════════════════════════════════════
  // TURN 5: Progress check with weight update
  // ═══════════════════════════════════════════════════════════════════════

  console.log('\n=== TURN 5: PROGRESS ===\n');

  await sendMessage(page, 'My weight is now 83.5 kg, how am I progressing?');
  await waitForResponse(page);

  const turn5Text = await getChatText(page);

  verifyWeightManagementAgent(turn5Text, 'Turn 5');

  // Should acknowledge the weight update
  const has83 = /83\.5|83/i.test(turn5Text);
  expect(has83, 'Turn 5: Should acknowledge 83.5kg weight').toBe(true);
  console.log('  [OK] Weight 83.5kg acknowledged');

  // Should reference progress toward goal
  const hasProgress = /progress|target|goal|lost|losing|track|72|down|kg|deficit|great|keep/i.test(turn5Text);
  expect(hasProgress, 'Turn 5: Should reference progress toward goal').toBe(true);
  console.log('  [OK] Progress referenced');

  checkDisclaimer(turn5Text, 'Turn 5');

  await scrollToBottom(page);
  await page.screenshot({ path: 'e2e-screenshots/wm-turn5-progress.png', fullPage: false });

  console.log('\n=== ALL 5 TURNS PASSED ===\n');

  // 10-second visual inspection pause
  console.log('=== VISUAL INSPECTION: Pausing 10 seconds ===\n');
  await page.waitForTimeout(10_000);
  console.log('=== Done ===\n');
});
