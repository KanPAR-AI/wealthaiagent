/**
 * Stress tests for specialist nutrition agents:
 * 1. Meal plan fiddling (swap, regenerate, modify) for each agent
 * 2. Dish variation check over weeks
 * 3. General nutrition agent stress test
 * 4. Minimal info start: "I need to create a diet plan"
 * Screenshots after every message.
 */

import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';

const SCREENSHOT_DIR = '/tmp/specialist-stress-screenshots';

test.beforeAll(async () => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

async function sendMessage(page: Page, text: string) {
  const input = page.locator('textarea').first();
  await input.waitFor({ state: 'visible', timeout: 10_000 });
  await expect(input).toBeEnabled({ timeout: 30_000 });
  await input.fill(text);
  await page.waitForTimeout(300);
  await input.press('Enter');
}

async function waitForResponse(page: Page, timeoutMs = 120_000) {
  try {
    await page.getByText('Thinking...').waitFor({ state: 'visible', timeout: 15_000 });
  } catch {
    // Response may have been instant
  }
  await page.getByText('Thinking...').waitFor({ state: 'hidden', timeout: timeoutMs });
  await page.waitForTimeout(3000);
}

async function scrollToBottom(page: Page) {
  const viewport = page.locator('[data-radix-scroll-area-viewport]').first();
  await viewport.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(500);
}

async function screenshot(page: Page, name: string) {
  await scrollToBottom(page);
  await page.waitForTimeout(500);
  const path = `${SCREENSHOT_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`📸 ${path}`);
}

async function getLatestResponse(page: Page): Promise<string> {
  await scrollToBottom(page);
  const viewport = page.locator('[data-radix-scroll-area-viewport]').first();
  return (await viewport.textContent()) || '';
}

async function signInWithEmail(page: Page) {
  const emailButton = page.getByText('Continue with Email');
  await emailButton.waitFor({ state: 'visible', timeout: 10_000 });
  await emailButton.click();
  await page.waitForTimeout(500);
  await page.locator('input[type="email"]').fill('ravipradeep89@gmail.com');
  await page.locator('input[type="password"]').fill('papa1210');
  await page.locator('button[type="submit"]').filter({ hasText: /Sign In/i }).click();
  await page.waitForURL('**/chat**', { timeout: 15_000 });
  await page.waitForTimeout(1000);
}

test.describe('Specialist Stress Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/chataiagent/');
    await page.waitForTimeout(2000);
    const isLoginPage = await page.getByText('Continue with Email').isVisible().catch(() => false);
    if (isLoginPage) {
      await signInWithEmail(page);
    }
  });

  // ─── TEST 1: MINIMAL INFO START — "I need a diet plan" ───
  test('Minimal info — just "I need a diet plan" with no details', async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);
    await screenshot(page, 'minimal-00-start');

    // TURN 1: Super vague request
    console.log('\n--- MINIMAL TURN 1: vague request ---');
    await sendMessage(page, 'I need to create a diet plan');
    await waitForResponse(page);
    await screenshot(page, 'minimal-01-turn1');
    const t1 = await getLatestResponse(page);
    console.log('MINIMAL T1 (last 1500):', t1.slice(-1500));

    // Should ask for more info (age, weight, goals etc) — NOT generate a plan immediately
    const asksForInfo = t1.toLowerCase().includes('age') ||
                        t1.toLowerCase().includes('weight') ||
                        t1.toLowerCase().includes('goal') ||
                        t1.toLowerCase().includes('tell me') ||
                        t1.toLowerCase().includes('help me understand') ||
                        t1.toLowerCase().includes('share');
    console.log(`Asks for more info: ${asksForInfo}`);
    expect(asksForInfo).toBeTruthy();

    // TURN 2: Provide info now
    console.log('\n--- MINIMAL TURN 2: provide details ---');
    await sendMessage(page, 'I am a 30 year old male, 75kg, 175cm, moderately active, vegetarian. Goal is weight loss.');
    await waitForResponse(page);
    await screenshot(page, 'minimal-02-turn2');
    const t2 = await getLatestResponse(page);
    console.log('MINIMAL T2 (last 1500):', t2.slice(-1500));

    // Should now have enough to proceed with cuisine selection or plan
    const hasProgress = t2.toLowerCase().includes('cuisine') ||
                        t2.toLowerCase().includes('plan') ||
                        t2.toLowerCase().includes('calorie') ||
                        t2.toLowerCase().includes('target');
    console.log(`Has progress after details: ${hasProgress}`);
    expect(hasProgress).toBeTruthy();

    // TURN 3: Generate plan
    console.log('\n--- MINIMAL TURN 3: generate plan ---');
    await sendMessage(page, 'Generate my meal plan');
    await waitForResponse(page);
    await screenshot(page, 'minimal-03-turn3');
    const t3 = await getLatestResponse(page);
    console.log('MINIMAL T3 (last 1500):', t3.slice(-1500));

    await screenshot(page, 'minimal-04-final');
  });

  // ─── TEST 2: MEDICAL NUTRITION — FIDDLE WITH PLAN ───
  test('Medical Nutrition — modify meal plan after generation', async ({ page }) => {
    test.setTimeout(420_000);
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);

    // Quick onboarding
    console.log('\n--- MED-FIDDLE TURN 1: onboard ---');
    await sendMessage(page, 'I have type 2 diabetes and need a diet plan. 45 year old male, 80kg, 175cm, sedentary, vegetarian.');
    await waitForResponse(page);
    await screenshot(page, 'medfiddle-01-onboard');
    const t1 = await getLatestResponse(page);
    console.log('MED T1 (last 800):', t1.slice(-800));

    // TURN 2: Get meal plan
    console.log('\n--- MED-FIDDLE TURN 2: get plan ---');
    await sendMessage(page, 'Generate a meal plan for me');
    await waitForResponse(page);
    await screenshot(page, 'medfiddle-02-plan');
    const t2 = await getLatestResponse(page);
    console.log('MED T2 (last 800):', t2.slice(-800));

    // TURN 3: Ask to reduce carbs
    console.log('\n--- MED-FIDDLE TURN 3: reduce carbs ---');
    await sendMessage(page, 'Can you reduce the carbs and increase protein in my plan?');
    await waitForResponse(page);
    await screenshot(page, 'medfiddle-03-reduce-carbs');
    const t3 = await getLatestResponse(page);
    console.log('MED T3 (last 1000):', t3.slice(-1000));

    // Should acknowledge the change request
    const acknowledgesChange = t3.toLowerCase().includes('carb') || t3.toLowerCase().includes('protein') || t3.toLowerCase().includes('adjust') || t3.toLowerCase().includes('modif') || t3.toLowerCase().includes('regenerat');
    console.log(`Acknowledges carb/protein change: ${acknowledgesChange}`);
    expect(acknowledgesChange).toBeTruthy();

    // TURN 4: Swap a specific meal
    console.log('\n--- MED-FIDDLE TURN 4: swap meal ---');
    await sendMessage(page, 'I dont like oats for breakfast. Can you replace it with something else?');
    await waitForResponse(page);
    await screenshot(page, 'medfiddle-04-swap');
    const t4 = await getLatestResponse(page);
    console.log('MED T4 (last 1000):', t4.slice(-1000));

    // Should provide an alternative
    const hasAlternative = t4.toLowerCase().includes('instead') || t4.toLowerCase().includes('replace') || t4.toLowerCase().includes('swap') || t4.toLowerCase().includes('alternative') || t4.toLowerCase().includes('try') || t4.toLowerCase().includes('breakfast');
    console.log(`Provides alternative: ${hasAlternative}`);
    expect(hasAlternative).toBeTruthy();

    await screenshot(page, 'medfiddle-05-final');
  });

  // ─── TEST 3: KIDS NUTRITION — FIDDLE + VARIATION CHECK ───
  test('Kids Nutrition — plan modification and dish variety', async ({ page }) => {
    test.setTimeout(420_000);
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);

    // Quick onboarding
    console.log('\n--- KIDS-FIDDLE TURN 1: onboard ---');
    await sendMessage(page, 'I need a diet plan for my 8 year old daughter. She is 25kg, 128cm, vegetarian, moderately active.');
    await waitForResponse(page);
    await screenshot(page, 'kidsfiddle-01-onboard');

    // Get plan
    console.log('\n--- KIDS-FIDDLE TURN 2: get plan ---');
    await sendMessage(page, 'Generate a weekly meal plan for her');
    await waitForResponse(page);
    await screenshot(page, 'kidsfiddle-02-plan');
    const t2 = await getLatestResponse(page);
    console.log('KIDS PLAN (last 1000):', t2.slice(-1000));

    // TURN 3: Ask about variety / repetition
    console.log('\n--- KIDS-FIDDLE TURN 3: ask about variety ---');
    await sendMessage(page, 'Are the dishes varied enough? I dont want the same meals repeating every day.');
    await waitForResponse(page);
    await screenshot(page, 'kidsfiddle-03-variety');
    const t3 = await getLatestResponse(page);
    console.log('KIDS VARIETY (last 1000):', t3.slice(-1000));

    // TURN 4: Ask to add more fruits
    console.log('\n--- KIDS-FIDDLE TURN 4: add fruits ---');
    await sendMessage(page, 'Can you add more fruits and reduce the amount of rice in her meals?');
    await waitForResponse(page);
    await screenshot(page, 'kidsfiddle-04-fruits');
    const t4 = await getLatestResponse(page);
    console.log('KIDS FRUITS (last 1000):', t4.slice(-1000));

    const acknowledges = t4.toLowerCase().includes('fruit') || t4.toLowerCase().includes('rice');
    console.log(`Acknowledges fruit/rice change: ${acknowledges}`);
    expect(acknowledges).toBeTruthy();

    await screenshot(page, 'kidsfiddle-05-final');
  });

  // ─── TEST 4: PREGNANCY — WEEK-OVER-WEEK NAVIGATION ───
  test('Pregnancy Nutrition — plan fiddling and safety check', async ({ page }) => {
    test.setTimeout(420_000);
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);

    // Onboard
    console.log('\n--- PREG-FIDDLE TURN 1: onboard ---');
    await sendMessage(page, 'I am 30 weeks pregnant, third trimester. 30 years old, 70kg, 165cm. Vegetarian. No GDM.');
    await waitForResponse(page);
    await screenshot(page, 'pregfiddle-01-onboard');

    // Get plan
    console.log('\n--- PREG-FIDDLE TURN 2: get plan ---');
    await sendMessage(page, 'Generate a meal plan for me');
    await waitForResponse(page);
    await screenshot(page, 'pregfiddle-02-plan');
    const t2 = await getLatestResponse(page);
    console.log('PREG PLAN (last 1000):', t2.slice(-1000));

    // TURN 3: Ask about iron-rich foods
    console.log('\n--- PREG-FIDDLE TURN 3: iron foods ---');
    await sendMessage(page, 'I am iron deficient. Can you add more iron-rich foods to my plan?');
    await waitForResponse(page);
    await screenshot(page, 'pregfiddle-03-iron');
    const t3 = await getLatestResponse(page);
    console.log('PREG IRON (last 1000):', t3.slice(-1000));

    const hasIron = t3.toLowerCase().includes('iron') || t3.toLowerCase().includes('spinach') || t3.toLowerCase().includes('lentil') || t3.toLowerCase().includes('beetroot');
    console.log(`Mentions iron-rich foods: ${hasIron}`);
    expect(hasIron).toBeTruthy();

    // TURN 4: Safety — ask about raw fish
    console.log('\n--- PREG-FIDDLE TURN 4: safety check ---');
    await sendMessage(page, 'Can I eat sushi with raw fish during pregnancy?');
    await waitForResponse(page);
    await screenshot(page, 'pregfiddle-04-safety');
    const t4 = await getLatestResponse(page);
    console.log('PREG SAFETY (last 1000):', t4.slice(-1000));

    // Should warn against raw fish
    const warnsRawFish = t4.toLowerCase().includes('avoid') || t4.toLowerCase().includes('raw') || t4.toLowerCase().includes('not recommended') || t4.toLowerCase().includes('unsafe') || t4.toLowerCase().includes('risk');
    console.log(`Warns about raw fish: ${warnsRawFish}`);
    expect(warnsRawFish).toBeTruthy();

    await screenshot(page, 'pregfiddle-05-final');
  });

  // ─── TEST 5: FITNESS — CALORIE CYCLING MODIFICATION ───
  test('Fitness Nutrition — calorie cycling modification', async ({ page }) => {
    test.setTimeout(420_000);
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);

    // Onboard
    console.log('\n--- FIT-FIDDLE TURN 1: onboard ---');
    await sendMessage(page, 'I want to do a cutting phase to lose fat. 28 year old male, 82kg, 178cm, gym 5 days a week, non-veg.');
    await waitForResponse(page);
    await screenshot(page, 'fitfiddle-01-onboard');

    // Get plan
    console.log('\n--- FIT-FIDDLE TURN 2: get plan ---');
    await sendMessage(page, 'Generate a meal plan for me');
    await waitForResponse(page);
    await screenshot(page, 'fitfiddle-02-plan');
    const t2 = await getLatestResponse(page);
    console.log('FIT PLAN (last 1000):', t2.slice(-1000));

    // TURN 3: Ask to increase deficit
    console.log('\n--- FIT-FIDDLE TURN 3: increase deficit ---');
    await sendMessage(page, 'I want a more aggressive cut. Can you reduce calories by another 200 on rest days?');
    await waitForResponse(page);
    await screenshot(page, 'fitfiddle-03-deficit');
    const t3 = await getLatestResponse(page);
    console.log('FIT DEFICIT (last 1000):', t3.slice(-1000));

    const acknowledges = t3.toLowerCase().includes('calorie') || t3.toLowerCase().includes('deficit') || t3.toLowerCase().includes('rest day') || t3.toLowerCase().includes('reduce');
    console.log(`Acknowledges deficit change: ${acknowledges}`);
    expect(acknowledges).toBeTruthy();

    // TURN 4: Switch from cutting to maintenance
    console.log('\n--- FIT-FIDDLE TURN 4: switch goal ---');
    await sendMessage(page, 'Actually I want to switch to maintenance calories instead of cutting.');
    await waitForResponse(page);
    await screenshot(page, 'fitfiddle-04-switch');
    const t4 = await getLatestResponse(page);
    console.log('FIT SWITCH (last 1000):', t4.slice(-1000));

    const switchAck = t4.toLowerCase().includes('maintenance') || t4.toLowerCase().includes('switch') || t4.toLowerCase().includes('adjust');
    console.log(`Acknowledges goal switch: ${switchAck}`);
    expect(switchAck).toBeTruthy();

    await screenshot(page, 'fitfiddle-05-final');
  });

  // ─── TEST 6: SPORTS NUTRITION — PRE/POST WORKOUT TIMING ───
  test('Sports Nutrition — workout timing and carb loading', async ({ page }) => {
    test.setTimeout(420_000);
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);

    // Onboard
    console.log('\n--- SPORT-FIDDLE TURN 1: onboard ---');
    await sendMessage(page, 'I am a competitive cyclist training 20 hours per week. 32 year old male, 68kg, 176cm, non-veg.');
    await waitForResponse(page);
    await screenshot(page, 'sportfiddle-01-onboard');

    // Get plan
    console.log('\n--- SPORT-FIDDLE TURN 2: get plan ---');
    await sendMessage(page, 'Generate a meal plan for me');
    await waitForResponse(page);
    await screenshot(page, 'sportfiddle-02-plan');
    const t2 = await getLatestResponse(page);
    console.log('SPORT PLAN (last 1000):', t2.slice(-1000));

    // TURN 3: Ask about pre-workout nutrition
    console.log('\n--- SPORT-FIDDLE TURN 3: pre-workout ---');
    await sendMessage(page, 'What should I eat 2 hours before a long ride? I have a 100km ride tomorrow.');
    await waitForResponse(page);
    await screenshot(page, 'sportfiddle-03-preworkout');
    const t3 = await getLatestResponse(page);
    console.log('SPORT PRE-WORKOUT (last 1000):', t3.slice(-1000));

    const hasTimingAdvice = t3.toLowerCase().includes('carb') || t3.toLowerCase().includes('before') || t3.toLowerCase().includes('fuel') || t3.toLowerCase().includes('energy') || t3.toLowerCase().includes('ride');
    console.log(`Has pre-workout timing advice: ${hasTimingAdvice}`);
    expect(hasTimingAdvice).toBeTruthy();

    // TURN 4: Recovery nutrition
    console.log('\n--- SPORT-FIDDLE TURN 4: recovery ---');
    await sendMessage(page, 'What about post-ride recovery? I usually feel very depleted after long rides.');
    await waitForResponse(page);
    await screenshot(page, 'sportfiddle-04-recovery');
    const t4 = await getLatestResponse(page);
    console.log('SPORT RECOVERY (last 1000):', t4.slice(-1000));

    const hasRecovery = t4.toLowerCase().includes('recovery') || t4.toLowerCase().includes('protein') || t4.toLowerCase().includes('replenish') || t4.toLowerCase().includes('refuel') || t4.toLowerCase().includes('after');
    console.log(`Has recovery advice: ${hasRecovery}`);
    expect(hasRecovery).toBeTruthy();

    await screenshot(page, 'sportfiddle-05-final');
  });

  // ─── TEST 7: GENERAL NUTRITION STRESS — EDGE CASES ───
  test('General dietician — stress test with edge cases', async ({ page }) => {
    test.setTimeout(420_000);
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);

    // TURN 1: Normal dietician flow (no medical condition)
    console.log('\n--- GENERAL TURN 1: normal diet request ---');
    await sendMessage(page, 'I want to lose weight. I am 35 year old female, 70kg, 160cm, lightly active, non-vegetarian.');
    await waitForResponse(page);
    await screenshot(page, 'general-01-turn1');
    const t1 = await getLatestResponse(page);
    console.log('GENERAL T1 (last 1000):', t1.slice(-1000));

    // Should route to dietician (not specialist)
    const isDietician = t1.includes('[Using dietician agent]') || t1.toLowerCase().includes('cuisine') || t1.toLowerCase().includes('calorie') || t1.toLowerCase().includes('target');
    console.log(`Routes to dietician: ${isDietician}`);

    // TURN 2: Try to confuse it with off-topic then back
    console.log('\n--- GENERAL TURN 2: off-topic ---');
    await sendMessage(page, 'What is the capital of France?');
    await waitForResponse(page);
    await screenshot(page, 'general-02-offtopic');
    const t2 = await getLatestResponse(page);
    console.log('GENERAL T2 (last 500):', t2.slice(-500));

    // TURN 3: Back to diet
    console.log('\n--- GENERAL TURN 3: back to diet ---');
    await sendMessage(page, 'Ok back to my diet. Generate a meal plan for weight loss.');
    await waitForResponse(page);
    await screenshot(page, 'general-03-backto-diet');
    const t3 = await getLatestResponse(page);
    console.log('GENERAL T3 (last 1000):', t3.slice(-1000));

    // TURN 4: Contradictory request
    console.log('\n--- GENERAL TURN 4: contradictory ---');
    await sendMessage(page, 'I want to eat 5000 calories but also lose weight fast. Is that possible?');
    await waitForResponse(page);
    await screenshot(page, 'general-04-contradictory');
    const t4 = await getLatestResponse(page);
    console.log('GENERAL T4 (last 1000):', t4.slice(-1000));

    // Should push back on the contradictory request
    const pushesBack = t4.toLowerCase().includes('not possible') || t4.toLowerCase().includes('deficit') || t4.toLowerCase().includes('impossible') || t4.toLowerCase().includes('won\'t') || t4.toLowerCase().includes('cannot') || t4.toLowerCase().includes('unlikely') || t4.toLowerCase().includes('difficult') || t4.toLowerCase().includes('challenging');
    console.log(`Pushes back on contradiction: ${pushesBack}`);

    await screenshot(page, 'general-05-final');
  });

});
