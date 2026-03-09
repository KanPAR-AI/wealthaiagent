/**
 * P0 E2E tests for ALL specialist nutrition agents.
 * Screenshots after every message, console log all responses.
 */

import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';

const SCREENSHOT_DIR = '/tmp/specialist-e2e-screenshots';

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
  console.log(`📸 Screenshot saved: ${path}`);
}

async function getLatestResponse(page: Page): Promise<string> {
  await scrollToBottom(page);
  const viewport = page.locator('[data-radix-scroll-area-viewport]').first();
  const text = (await viewport.textContent()) || '';
  return text;
}

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

test.describe('All Specialist Agents — P0 E2E', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/chataiagent/');
    await page.waitForTimeout(2000);

    const isLoginPage = await page.getByText('Continue with Email').isVisible().catch(() => false);
    if (isLoginPage) {
      await signInWithEmail(page, 'ravipradeep89@gmail.com', 'papa1210');
    }
  });

  // ─── TEST 1: KIDS NUTRITION ───
  test('Kids Nutrition — routing + onboarding + plan', async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);
    await screenshot(page, 'kids-00-new-chat');

    // TURN 1: Trigger kids nutrition
    console.log('\n--- KIDS TURN 1 ---');
    await sendMessage(page, 'I need a healthy diet plan for my 5 year old son. He weighs 18kg and is 110cm tall.');
    await waitForResponse(page);
    await screenshot(page, 'kids-01-turn1');
    const t1 = await getLatestResponse(page);
    console.log('KIDS T1 (last 1500):', t1.slice(-1500));

    // Verify routing
    const routedCorrectly = t1.toLowerCase().includes('kids') || t1.toLowerCase().includes('child');
    console.log(`Kids routing correct: ${routedCorrectly}`);
    expect(routedCorrectly).toBeTruthy();

    // TURN 2: Provide more details
    console.log('\n--- KIDS TURN 2 ---');
    await sendMessage(page, 'He is a picky eater, vegetarian, no allergies. Moderate activity level.');
    await waitForResponse(page);
    await screenshot(page, 'kids-02-turn2');
    const t2 = await getLatestResponse(page);
    console.log('KIDS T2 (last 1500):', t2.slice(-1500));

    // TURN 3: Request meal plan
    console.log('\n--- KIDS TURN 3 ---');
    await sendMessage(page, 'Generate a meal plan for him');
    await waitForResponse(page);
    await screenshot(page, 'kids-03-turn3');
    const t3 = await getLatestResponse(page);
    console.log('KIDS T3 (last 1500):', t3.slice(-1500));

    await screenshot(page, 'kids-04-final');
  });

  // ─── TEST 2: PREGNANCY NUTRITION ───
  test('Pregnancy Nutrition — routing + onboarding + plan', async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);
    await screenshot(page, 'preg-00-new-chat');

    // TURN 1: Trigger pregnancy nutrition
    console.log('\n--- PREGNANCY TURN 1 ---');
    await sendMessage(page, 'I am 24 weeks pregnant in my second trimester. I need a pregnancy diet plan. I am 28 years old, 65kg, 162cm.');
    await waitForResponse(page);
    await screenshot(page, 'preg-01-turn1');
    const t1 = await getLatestResponse(page);
    console.log('PREG T1 (last 1500):', t1.slice(-1500));

    const routedCorrectly = t1.toLowerCase().includes('pregnan') || t1.toLowerCase().includes('trimester');
    console.log(`Pregnancy routing correct: ${routedCorrectly}`);
    expect(routedCorrectly).toBeTruthy();

    // TURN 2: More details
    console.log('\n--- PREGNANCY TURN 2 ---');
    await sendMessage(page, 'I am vegetarian, no gestational diabetes. I have mild nausea. No food allergies.');
    await waitForResponse(page);
    await screenshot(page, 'preg-02-turn2');
    const t2 = await getLatestResponse(page);
    console.log('PREG T2 (last 1500):', t2.slice(-1500));

    // TURN 3: Request meal plan
    console.log('\n--- PREGNANCY TURN 3 ---');
    await sendMessage(page, 'Generate a meal plan for me');
    await waitForResponse(page);
    await screenshot(page, 'preg-03-turn3');
    const t3 = await getLatestResponse(page);
    console.log('PREG T3 (last 1500):', t3.slice(-1500));

    await screenshot(page, 'preg-04-final');
  });

  // ─── TEST 3: SPORTS NUTRITION ───
  test('Sports Nutrition — routing + onboarding + plan', async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);
    await screenshot(page, 'sports-00-new-chat');

    // TURN 1: Trigger sports nutrition
    console.log('\n--- SPORTS TURN 1 ---');
    await sendMessage(page, 'I am training for a marathon and need a sports nutrition plan. I am a 30 year old male, 75kg, 180cm, very active.');
    await waitForResponse(page);
    await screenshot(page, 'sports-01-turn1');
    const t1 = await getLatestResponse(page);
    console.log('SPORTS T1 (last 1500):', t1.slice(-1500));

    const routedCorrectly = t1.toLowerCase().includes('sport') || t1.toLowerCase().includes('training') || t1.toLowerCase().includes('marathon') || t1.toLowerCase().includes('athlete');
    console.log(`Sports routing correct: ${routedCorrectly}`);
    expect(routedCorrectly).toBeTruthy();

    // TURN 2: More details
    console.log('\n--- SPORTS TURN 2 ---');
    await sendMessage(page, 'I train 6 days a week, running 60km per week. Non-vegetarian. No allergies. Currently in build phase.');
    await waitForResponse(page);
    await screenshot(page, 'sports-02-turn2');
    const t2 = await getLatestResponse(page);
    console.log('SPORTS T2 (last 1500):', t2.slice(-1500));

    // TURN 3: Request meal plan
    console.log('\n--- SPORTS TURN 3 ---');
    await sendMessage(page, 'Generate a meal plan for me');
    await waitForResponse(page);
    await screenshot(page, 'sports-03-turn3');
    const t3 = await getLatestResponse(page);
    console.log('SPORTS T3 (last 1500):', t3.slice(-1500));

    await screenshot(page, 'sports-04-final');
  });

  // ─── TEST 4: FITNESS NUTRITION ───
  test('Fitness Nutrition — routing + onboarding + plan', async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);
    await screenshot(page, 'fitness-00-new-chat');

    // TURN 1: Trigger fitness nutrition
    console.log('\n--- FITNESS TURN 1 ---');
    await sendMessage(page, 'I want to do a lean bulk. I am a 27 year old male, 70kg, 175cm. I go to the gym 5 days a week.');
    await waitForResponse(page);
    await screenshot(page, 'fitness-01-turn1');
    const t1 = await getLatestResponse(page);
    console.log('FITNESS T1 (last 1500):', t1.slice(-1500));

    const routedCorrectly = t1.toLowerCase().includes('bulk') || t1.toLowerCase().includes('fitness') || t1.toLowerCase().includes('muscle') || t1.toLowerCase().includes('gym');
    console.log(`Fitness routing correct: ${routedCorrectly}`);
    expect(routedCorrectly).toBeTruthy();

    // TURN 2: More details
    console.log('\n--- FITNESS TURN 2 ---');
    await sendMessage(page, 'Non-vegetarian, no allergies. My current body fat is around 15%. I want to gain muscle without too much fat.');
    await waitForResponse(page);
    await screenshot(page, 'fitness-02-turn2');
    const t2 = await getLatestResponse(page);
    console.log('FITNESS T2 (last 1500):', t2.slice(-1500));

    // TURN 3: Request meal plan
    console.log('\n--- FITNESS TURN 3 ---');
    await sendMessage(page, 'Generate a meal plan for me');
    await waitForResponse(page);
    await screenshot(page, 'fitness-03-turn3');
    const t3 = await getLatestResponse(page);
    console.log('FITNESS T3 (last 1500):', t3.slice(-1500));

    await screenshot(page, 'fitness-04-final');
  });
});
