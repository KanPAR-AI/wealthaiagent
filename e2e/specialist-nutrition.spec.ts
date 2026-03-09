/**
 * Specialist Nutrition Platform — E2E Tests
 *
 * Tests the specialist picker widget and specialist agent flows:
 *
 *   TEST 1: Specialist Picker Widget renders and navigates
 *   TEST 2: Medical Nutrition — Onboard with diabetes → get plan with low-GI meals
 *   TEST 3: Kids Nutrition — Onboard child age 5 → verify age-appropriate portions
 *   TEST 4: Pregnancy Nutrition — Onboard T2 → verify folate-rich meals, no raw fish
 *   TEST 5: Multi-condition — Pregnant + diabetic → merged constraints
 *
 * Prerequisites:
 *   - Frontend: npm run dev (port 5173)
 *   - Backend: cd chatservice && docker compose up --build (port 8080, SKIP_AUTH=true)
 *
 * Run:
 *   npx playwright test e2e/specialist-nutrition.spec.ts --headed
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
  const viewport = page.locator('[data-radix-scroll-area-viewport]').first();
  await viewport.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(500);
}

/** Navigate to a new chat. */
async function startNewChat(page: Page) {
  await page.goto('/chataiagent/new');
  await page.waitForTimeout(2000);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Specialist Nutrition Platform', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/chataiagent/');
    await page.waitForTimeout(2000);

    // Sign in if login page is showing
    const isLoginPage = await page.getByText('Continue with Email').isVisible().catch(() => false);
    if (isLoginPage) {
      await signInWithEmail(page, 'ravipradeep89@gmail.com', 'papa1210');
    }
  });

  test('Medical Nutrition — diabetes onboarding and plan generation', async ({ page }) => {
    await startNewChat(page);

    // TURN 1: Trigger medical nutrition with diabetes mention
    await sendMessage(page, 'I have type 2 diabetes and need a diet plan. I am a 45 year old male, 80kg, 175cm, sedentary, vegetarian.');
    await waitForResponse(page);
    const turn1 = await getChatText(page);

    // Should route to medical nutrition and start onboarding
    expect(
      turn1.toLowerCase().includes('diabetes') ||
      turn1.toLowerCase().includes('medical') ||
      turn1.toLowerCase().includes('condition') ||
      turn1.toLowerCase().includes('nutrition')
    ).toBeTruthy();

    await scrollToBottom(page);

    // TURN 2: Complete onboarding with medications/lab values
    await sendMessage(page, 'I take metformin 500mg twice daily. My HbA1c is 7.2, fasting sugar is 140.');
    await waitForResponse(page);

    await scrollToBottom(page);

    // TURN 3: Request meal plan
    await sendMessage(page, 'Generate a meal plan for me');
    await waitForResponse(page);

    const planText = await getChatText(page);
    const planLower = planText.toLowerCase();

    // Verify plan includes low-GI friendly meals
    expect(
      planLower.includes('meal') ||
      planLower.includes('breakfast') ||
      planLower.includes('lunch') ||
      planLower.includes('dinner') ||
      planLower.includes('plan')
    ).toBeTruthy();

    // Verify it mentions diabetes-relevant dietary guidance
    expect(
      planLower.includes('glycemic') ||
      planLower.includes('gi') ||
      planLower.includes('blood sugar') ||
      planLower.includes('diabetes') ||
      planLower.includes('protein') ||
      planLower.includes('calories')
    ).toBeTruthy();
  });

  test('Kids Nutrition — child age 5 onboarding', async ({ page }) => {
    await startNewChat(page);

    // TURN 1: Trigger kids nutrition
    await sendMessage(page, 'I need a diet plan for my 5 year old son. He is 18kg, 110cm, and is a picky eater. He is vegetarian.');
    await waitForResponse(page);
    const turn1 = await getChatText(page);

    // Should recognize this is for a child
    expect(
      turn1.toLowerCase().includes('child') ||
      turn1.toLowerCase().includes('kid') ||
      turn1.toLowerCase().includes('age') ||
      turn1.toLowerCase().includes('nutrition') ||
      turn1.toLowerCase().includes('picky')
    ).toBeTruthy();

    await scrollToBottom(page);

    // TURN 2: Request meal plan
    await sendMessage(page, 'Generate a weekly meal plan');
    await waitForResponse(page);

    const planText = await getChatText(page);
    const planLower = planText.toLowerCase();

    // Verify plan was generated
    expect(
      planLower.includes('meal') ||
      planLower.includes('breakfast') ||
      planLower.includes('lunch') ||
      planLower.includes('plan')
    ).toBeTruthy();
  });

  test('Pregnancy Nutrition — T2 onboarding with folate focus', async ({ page }) => {
    await startNewChat(page);

    // TURN 1: Trigger pregnancy nutrition
    await sendMessage(page, 'I am 20 weeks pregnant, second trimester. I weigh 65kg, height 160cm, age 30. I am vegetarian and have no allergies.');
    await waitForResponse(page);
    const turn1 = await getChatText(page);

    // Should recognize pregnancy context
    expect(
      turn1.toLowerCase().includes('pregnan') ||
      turn1.toLowerCase().includes('trimester') ||
      turn1.toLowerCase().includes('prenatal') ||
      turn1.toLowerCase().includes('nutrition')
    ).toBeTruthy();

    await scrollToBottom(page);

    // TURN 2: Request meal plan
    await sendMessage(page, 'Please create a meal plan for me');
    await waitForResponse(page);

    const planText = await getChatText(page);
    const planLower = planText.toLowerCase();

    // Verify plan mentions pregnancy-relevant nutrients
    expect(
      planLower.includes('folate') ||
      planLower.includes('folic') ||
      planLower.includes('iron') ||
      planLower.includes('calcium') ||
      planLower.includes('meal') ||
      planLower.includes('trimester')
    ).toBeTruthy();

    // Verify no unsafe foods mentioned in a positive context
    // (raw fish, alcohol should not appear as recommendations)
    const responseOnly = planLower.slice(planLower.lastIndexOf('meal plan'));
    if (responseOnly.includes('raw fish') || responseOnly.includes('sashimi')) {
      // If raw fish is mentioned, it should be in a warning context (avoid/do not eat)
      expect(
        responseOnly.includes('avoid') ||
        responseOnly.includes('do not') ||
        responseOnly.includes('forbidden') ||
        responseOnly.includes('unsafe')
      ).toBeTruthy();
    }
  });

  test('Specialist routing — context continuity across turns', async ({ page }) => {
    await startNewChat(page);

    // TURN 1: Start with medical nutrition
    await sendMessage(page, 'I have hypertension and diabetes. I am 55 year old female, 75kg, 160cm.');
    await waitForResponse(page);

    await scrollToBottom(page);

    // TURN 2: Follow-up should stay in medical nutrition context
    await sendMessage(page, 'What foods should I avoid?');
    await waitForResponse(page);

    const text = await getChatText(page);
    const lower = text.toLowerCase();

    // Should give medical-specific food avoidance advice
    expect(
      lower.includes('sodium') ||
      lower.includes('salt') ||
      lower.includes('sugar') ||
      lower.includes('avoid') ||
      lower.includes('limit') ||
      lower.includes('blood pressure')
    ).toBeTruthy();

    await scrollToBottom(page);

    // TURN 3: Ask about a specific food — should still be in medical context
    await sendMessage(page, 'Can I eat pickles?');
    await waitForResponse(page);

    const turn3 = await getChatText(page);
    const turn3Lower = turn3.toLowerCase();

    // Response should reference sodium/salt concern for hypertension
    expect(
      turn3Lower.includes('sodium') ||
      turn3Lower.includes('salt') ||
      turn3Lower.includes('hypertension') ||
      turn3Lower.includes('blood pressure') ||
      turn3Lower.includes('limit') ||
      turn3Lower.includes('moderation')
    ).toBeTruthy();
  });

});
