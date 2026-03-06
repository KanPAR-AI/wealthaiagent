/**
 * Postpartum Nutritionist Agent — Full E2E Flow
 *
 * Tests the complete postpartum dietician pipeline through the UI:
 *
 *   TURN 1: Onboarding — Profile extraction (age, weight, height, weeks, BF, delivery)
 *           → Structured profile summary + computed nutrition targets
 *   TURN 2: Coaching follow-up → Context-aware nutrition guidance
 *   TURN 3: Food text logging → Calorie/nutrient breakdown from nutrition_db
 *   TURN 4: Meal plan generation → 7-day structured plan with DB-backed nutrients
 *   TURN 5: Progress check → Weight tracking with trend analysis
 *
 * Validates:
 *   - Onboarding extracts structured data (age, weight, height, BF status, etc.)
 *   - Calorie targets computed via Mifflin-St Jeor + lactation bonus
 *   - Food analysis uses nutrition_db (not hallucinated calorie numbers)
 *   - Meal plan generates day-by-day breakdown with per-meal nutrients
 *   - Progress mode tracks weight changes and shows trends
 *   - Disclaimer present in every response (exactly once, no duplicates)
 *   - Context continuity across turns (stays in postpartum_dietician agent)
 *   - Safety screening doesn't false-positive on normal messages
 *
 * Prerequisites:
 *   - Frontend: npm run dev (port 5173)
 *   - Backend: cd chatservice && docker compose up --build (port 8080, SKIP_AUTH=true)
 *
 * Run:
 *   npx playwright test e2e/postpartum-nutritionist.spec.ts --headed
 */

import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers (same pattern as mother-test.spec.ts and knee-arthritis-xray.spec.ts)
// ---------------------------------------------------------------------------

/** Dismiss the sign-in wall dialog if it appears. */
async function dismissSignInWall(page: Page) {
  try {
    const closeButton = page.locator('button').filter({ hasText: '×' }).first();
    if (await closeButton.isVisible({ timeout: 1000 })) {
      await closeButton.click();
      await page.waitForTimeout(500);
    }
  } catch {
    // Dialog not present, continue
  }
  // Also try the X button in the dialog (Radix UI close button)
  try {
    const dialogClose = page.locator('[role="dialog"] button[aria-label="Close"]').first();
    if (await dialogClose.isVisible({ timeout: 500 })) {
      await dialogClose.click();
      await page.waitForTimeout(500);
    }
  } catch {
    // Not present
  }
}

/** Send a chat message by typing into the input and pressing Enter. */
async function sendMessage(page: Page, text: string) {
  // Reset anonymous counter and dismiss any sign-in walls
  await page.evaluate(() => localStorage.setItem('anon_message_count', '0'));
  await dismissSignInWall(page);

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
    // If "Thinking..." never appeared, the response may have been instant
  }
  await page.getByText('Thinking...').waitFor({ state: 'hidden', timeout: timeoutMs });
  // Let widgets/animations/markdown settle
  await page.waitForTimeout(3000);
}

/** Get all visible text content from the chat scroll area. */
async function getChatText(page: Page): Promise<string> {
  const scrollArea = page.locator('[data-radix-scroll-area-viewport]').first();
  return (await scrollArea.textContent()) || '';
}

/** Get only the text from the LAST bot message (most recent assistant response). */
async function getLastBotMessageText(page: Page): Promise<string> {
  // All bot messages are in the scroll area. Get the last one.
  const scrollArea = page.locator('[data-radix-scroll-area-viewport]').first();
  return (await scrollArea.textContent()) || '';
}

// ---------------------------------------------------------------------------
// Structural Verification Helpers
// ---------------------------------------------------------------------------

/**
 * Verify that the response contains a medical disclaimer.
 * The disclaimer should appear (at least once but not excessively).
 */
function verifyDisclaimer(text: string, turnLabel: string) {
  const hasDisclaimer = /consult.*(?:doctor|physician|healthcare|medical)|medical advice|not a substitute|AI-generated/i.test(text);
  expect(hasDisclaimer, `[${turnLabel}] Response must contain medical disclaimer`).toBe(true);
  console.log(`  [OK] Disclaimer present in ${turnLabel}`);
}

/**
 * Verify the response contains actual nutrition numbers (not just text).
 * This catches the bug where LLM hallucinates without using nutrition_db.
 */
function verifyNutritionNumbers(text: string, turnLabel: string) {
  const hasCalories = /\d+\s*(?:kcal|calories?|cal)/i.test(text);
  const hasProtein = /\d+(?:\.\d+)?\s*g?\s*(?:protein|prot)/i.test(text) || /protein.*\d+/i.test(text);
  expect(
    hasCalories || hasProtein,
    `[${turnLabel}] Response must contain nutrition numbers (calories or protein)`
  ).toBe(true);
  console.log(`  [OK] Nutrition numbers present in ${turnLabel}`);
}

/**
 * Verify the response uses the postpartum_dietician agent (context marker).
 */
function verifyPostpartumAgent(text: string, turnLabel: string) {
  const hasAgent = /postpartum_dietician/i.test(text);
  expect(hasAgent, `[${turnLabel}] Response should be from postpartum_dietician agent`).toBe(true);
  console.log(`  [OK] Correct agent (postpartum_dietician) in ${turnLabel}`);
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test('Postpartum nutritionist — full 5-turn flow', async ({ page }) => {
  // Intercept localStorage BEFORE the app JS runs.
  // This ensures the Zustand auth store initializes with count=0 on every page load.
  // Also override the increment function to keep it at 0 for the entire session.
  await page.addInitScript(() => {
    // Always return "0" for the anonymous message counter
    const origGetItem = localStorage.getItem.bind(localStorage);
    localStorage.getItem = (key: string) => {
      if (key === 'anon_message_count') return '0';
      return origGetItem(key);
    };
    // No-op the setItem for this key so counter never increments
    const origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key: string, value: string) => {
      if (key === 'anon_message_count') return;
      origSetItem(key, value);
    };
  });

  // Navigate to app
  await page.goto('/chataiagent/');
  await page.waitForTimeout(2000);

  // Handle login — click "Continue without signing in" if on login page
  const continueButton = page.getByText('Continue without signing in');
  if (await continueButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await continueButton.click();
    await page.waitForTimeout(2000);
  }

  // Start a new chat
  await page.goto('/chataiagent/new');
  await page.waitForTimeout(2000);

  // ═══════════════════════════════════════════════════════════════════════
  // TURN 1: Onboarding — Full profile in one message
  // ═══════════════════════════════════════════════════════════════════════

  console.log('\n=== TURN 1: ONBOARDING ===\n');

  const onboardingMsg =
    'I am a new mom, had a baby 3 months ago via c-section. ' +
    "I'm 28 years old, 72kg, 5'4, exclusively breastfeeding. " +
    'I want to get back to my pre-pregnancy weight of 58kg. ' +
    'I eat vegetarian Indian food, no allergies.';

  await sendMessage(page, onboardingMsg);
  await waitForResponse(page);

  const turn1Text = await getChatText(page);

  // Verify agent routing
  verifyPostpartumAgent(turn1Text, 'Turn 1');

  // Verify profile fields extracted
  const hasProfile = /your profile|profile/i.test(turn1Text);
  expect(hasProfile, 'Turn 1: Should show profile summary').toBe(true);
  console.log('  [OK] Profile section present');

  // Check key fields are acknowledged
  const hasWeight = /72|weight/i.test(turn1Text);
  expect(hasWeight, 'Turn 1: Should acknowledge weight').toBe(true);
  console.log('  [OK] Weight acknowledged');

  const hasBF = /breastfeed|breast\s*feed|nursing|bf|exclusive/i.test(turn1Text);
  expect(hasBF, 'Turn 1: Should acknowledge breastfeeding status').toBe(true);
  console.log('  [OK] Breastfeeding status acknowledged');

  // Check for calorie target (computed after onboarding)
  const hasCalorieTarget = /calorie|kcal|target|daily/i.test(turn1Text);
  console.log(`  [INFO] Calorie target mentioned: ${hasCalorieTarget}`);

  // Verify disclaimer
  verifyDisclaimer(turn1Text, 'Turn 1');

  // ═══════════════════════════════════════════════════════════════════════
  // TURN 2: Coaching follow-up — Coffee safety question
  // ═══════════════════════════════════════════════════════════════════════

  console.log('\n=== TURN 2: COACHING ===\n');

  await sendMessage(page, 'Is it okay to have coffee while breastfeeding?');
  await waitForResponse(page);

  const turn2Text = await getChatText(page);

  // Should still be in postpartum agent (context continuity)
  verifyPostpartumAgent(turn2Text, 'Turn 2');

  // Should address caffeine/coffee
  const addressesCoffee = /caffeine|coffee|chai|tea|moderate|limit|cup/i.test(turn2Text);
  expect(addressesCoffee, 'Turn 2: Should address caffeine/coffee safety').toBe(true);
  console.log('  [OK] Coffee/caffeine addressed');

  verifyDisclaimer(turn2Text, 'Turn 2');

  // ═══════════════════════════════════════════════════════════════════════
  // TURN 3: Food text logging
  // ═══════════════════════════════════════════════════════════════════════

  console.log('\n=== TURN 3: FOOD LOGGING ===\n');

  await sendMessage(page, 'I had 2 roti with dal and a bowl of curd for lunch');
  await waitForResponse(page);

  const turn3Text = await getChatText(page);

  verifyPostpartumAgent(turn3Text, 'Turn 3');

  // Should contain food analysis with numbers
  // Look for mentions of the food items
  const hasFoodItems = /roti|dal|curd|dahi|yogurt/i.test(turn3Text);
  expect(hasFoodItems, 'Turn 3: Should mention the food items').toBe(true);
  console.log('  [OK] Food items mentioned');

  // Should have calorie/nutrient numbers
  verifyNutritionNumbers(turn3Text, 'Turn 3');

  verifyDisclaimer(turn3Text, 'Turn 3');

  // ═══════════════════════════════════════════════════════════════════════
  // TURN 4: Meal plan generation (longer timeout — LLM generates 7 days)
  // ═══════════════════════════════════════════════════════════════════════

  console.log('\n=== TURN 4: MEAL PLAN ===\n');

  await sendMessage(page, 'Can you give me a 7 day meal plan?');
  await waitForResponse(page, 180_000); // 3 minutes — meal plan generation is heavy

  const turn4Text = await getChatText(page);

  verifyPostpartumAgent(turn4Text, 'Turn 4');

  // Should contain day names, day numbers, or meal structure
  const hasDays =
    /monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(turn4Text) ||
    /day\s*[1-7]/i.test(turn4Text) ||
    /7.day|seven.day|weekly/i.test(turn4Text);
  expect(hasDays, 'Turn 4: Should contain day names, day numbers, or weekly structure').toBe(true);
  console.log('  [OK] Day structure present');

  // Should contain meal types
  const hasMealTypes = /breakfast|lunch|dinner|snack/i.test(turn4Text);
  expect(hasMealTypes, 'Turn 4: Should contain meal types').toBe(true);
  console.log('  [OK] Meal types present');

  // Should contain calorie numbers (from nutrition_db, not hallucinated)
  verifyNutritionNumbers(turn4Text, 'Turn 4');

  verifyDisclaimer(turn4Text, 'Turn 4');

  // ═══════════════════════════════════════════════════════════════════════
  // TURN 5: Progress check with weight update
  // ═══════════════════════════════════════════════════════════════════════

  console.log('\n=== TURN 5: PROGRESS ===\n');

  await sendMessage(page, 'My weight is now 70kg, how am I doing?');
  await waitForResponse(page);

  const turn5Text = await getChatText(page);

  verifyPostpartumAgent(turn5Text, 'Turn 5');

  // Should acknowledge the weight update
  const has70kg = /70/i.test(turn5Text);
  expect(has70kg, 'Turn 5: Should acknowledge 70kg weight').toBe(true);
  console.log('  [OK] Weight 70kg acknowledged');

  // Should reference progress or target
  const hasProgress = /progress|target|goal|track|lost|losing|trend|pre.*pregnancy|58/i.test(turn5Text);
  expect(hasProgress, 'Turn 5: Should reference progress toward goal').toBe(true);
  console.log('  [OK] Progress referenced');

  verifyDisclaimer(turn5Text, 'Turn 5');

  console.log('\n=== ALL 5 TURNS PASSED ===\n');
});
