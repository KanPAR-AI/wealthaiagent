/**
 * Specialist Nutrition — Debug run with screenshots after every message.
 */

import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';

const SCREENSHOT_DIR = '/tmp/specialist-e2e-screenshots';

// Ensure screenshot dir exists
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

async function getAllMessages(page: Page): Promise<string[]> {
  // Get all message blocks from the chat
  const messages = await page.locator('[data-radix-scroll-area-viewport] .prose, [data-radix-scroll-area-viewport] [class*="message"]').allTextContents();
  return messages;
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

test.describe('Specialist Nutrition — Debug with Screenshots', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/chataiagent/');
    await page.waitForTimeout(2000);

    const isLoginPage = await page.getByText('Continue with Email').isVisible().catch(() => false);
    if (isLoginPage) {
      await signInWithEmail(page, 'ravipradeep89@gmail.com', 'papa1210');
    }
    await screenshot(page, '00-after-login');
  });

  test('Medical Nutrition — full debug flow', async ({ page }) => {
    // Navigate to new chat
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);
    await screenshot(page, '01-new-chat');

    // TURN 1: Send diabetes message
    console.log('\n--- TURN 1: Sending diabetes onboarding message ---');
    await sendMessage(page, 'I have type 2 diabetes and need a diet plan. I am a 45 year old male, 80kg, 175cm, sedentary, vegetarian.');
    await waitForResponse(page);
    await screenshot(page, '02-turn1-response');

    const turn1Text = await getLatestResponse(page);
    console.log('\n=== TURN 1 RESPONSE (last 2000 chars) ===');
    console.log(turn1Text.slice(-2000));
    console.log('=== END TURN 1 ===\n');

    // Check if cuisine widget appeared
    const hasCuisineWidget = turn1Text.toLowerCase().includes('cuisine');
    console.log(`Cuisine mentioned in Turn 1: ${hasCuisineWidget}`);

    // TURN 2: Send medications
    console.log('\n--- TURN 2: Sending medications ---');
    await sendMessage(page, 'I take metformin 500mg twice daily. My HbA1c is 7.2, fasting sugar is 140.');
    await waitForResponse(page);
    await screenshot(page, '03-turn2-response');

    const turn2Text = await getLatestResponse(page);
    console.log('\n=== TURN 2 RESPONSE (last 2000 chars) ===');
    console.log(turn2Text.slice(-2000));
    console.log('=== END TURN 2 ===\n');

    // Check if cuisine appeared again
    const turn2HasCuisine = turn2Text.toLowerCase().includes('cuisine');
    console.log(`Cuisine mentioned in Turn 2: ${turn2HasCuisine}`);

    // TURN 3: Request meal plan
    console.log('\n--- TURN 3: Requesting meal plan ---');
    await sendMessage(page, 'Generate a meal plan for me');
    await waitForResponse(page);
    await screenshot(page, '04-turn3-response');

    const turn3Text = await getLatestResponse(page);
    console.log('\n=== TURN 3 RESPONSE (last 2000 chars) ===');
    console.log(turn3Text.slice(-2000));
    console.log('=== END TURN 3 ===\n');

    // Check if cuisine appeared yet again
    const turn3HasCuisine = turn3Text.toLowerCase().includes('cuisine');
    console.log(`Cuisine mentioned in Turn 3: ${turn3HasCuisine}`);

    // Final full chat dump
    console.log('\n========= FULL CHAT TEXT =========');
    const fullText = await getLatestResponse(page);
    console.log(fullText);
    console.log('========= END FULL CHAT =========\n');

    // Take a final full-page screenshot
    await scrollToBottom(page);
    await screenshot(page, '05-final-state');
  });

});
