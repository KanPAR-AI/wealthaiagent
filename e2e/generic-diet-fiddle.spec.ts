/**
 * Generic Diet Plan — full onboarding + meal plan + fiddling.
 * Tests both the weight_management flow (weight loss) and
 * the plain dietician flow (healthy eating).
 * Screenshots after every message, verify content.
 */

import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';

const SCREENSHOT_DIR = '/tmp/generic-diet-screenshots';

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
  } catch { /* instant */ }
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

/** Try to click a widget button; return true if clicked */
async function tryClickWidget(page: Page, text: string, timeout = 5000): Promise<boolean> {
  try {
    const btn = page.getByRole('button', { name: text }).first();
    await btn.waitFor({ state: 'visible', timeout });
    await btn.click();
    await page.waitForTimeout(500);
    return true;
  } catch {
    return false;
  }
}

test.describe('Generic Diet Plan — Full Flow + Fiddling', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/chataiagent/');
    await page.waitForTimeout(2000);
    const isLoginPage = await page.getByText('Continue with Email').isVisible().catch(() => false);
    if (isLoginPage) {
      await signInWithEmail(page);
    }
  });

  test('Weight loss flow → strategy → plan → fiddle (swap, reduce carbs, snack, regen, switch diet)', async ({ page }) => {
    test.setTimeout(600_000);
    await page.goto('/chataiagent/new');
    await page.waitForTimeout(2000);
    await screenshot(page, '00-new-chat');

    // ─── TURN 1: Weight loss request with profile ───
    console.log('\n=== TURN 1: Weight loss request ===');
    await sendMessage(page, 'I want to lose weight. I am a 32 year old female, 68kg, 162cm, lightly active.');
    await waitForResponse(page);
    await screenshot(page, '01-turn1-profile');
    let text = await getLatestResponse(page);
    console.log('T1 (last 1200):', text.slice(-1200));

    // Should route to weight_management or dietician — both are valid
    const routedCorrectly = text.includes('[Using weight_management agent]') || text.includes('[Using dietician agent]');
    console.log(`Routed correctly: ${routedCorrectly}`);
    expect(routedCorrectly).toBeTruthy();

    // ─── TURN 2: Select strategy ───
    console.log('\n=== TURN 2: Select strategy ===');
    // Weight management shows strategy widget: Calorie Deficit, IF 16:8, Keto, High Protein
    const clickedStrategy = await tryClickWidget(page, 'Calorie Deficit');
    if (clickedStrategy) {
      await waitForResponse(page);
    } else {
      await sendMessage(page, 'Calorie Deficit');
      await waitForResponse(page);
    }
    await screenshot(page, '02-turn2-strategy');
    text = await getLatestResponse(page);
    console.log('T2 (last 1200):', text.slice(-1200));

    // Should ask for dietary preference or show targets
    const hasProgress = text.toLowerCase().includes('vegetarian') || text.toLowerCase().includes('preference') ||
                         text.toLowerCase().includes('calorie') || text.toLowerCase().includes('target') ||
                         text.toLowerCase().includes('deficit');
    console.log(`Strategy accepted: ${hasProgress}`);
    expect(hasProgress).toBeTruthy();

    // ─── TURN 3: Select diet preference ───
    console.log('\n=== TURN 3: Diet preference ===');
    const clickedVeg = await tryClickWidget(page, 'Vegetarian');
    if (clickedVeg) {
      await waitForResponse(page);
    } else {
      await sendMessage(page, 'Vegetarian');
      await waitForResponse(page);
    }
    await screenshot(page, '03-turn3-diet-pref');
    text = await getLatestResponse(page);
    console.log('T3 (last 1200):', text.slice(-1200));

    // ─── TURN 4: Select cuisines ───
    console.log('\n=== TURN 4: Cuisine selection ===');
    // Try clicking cuisine buttons, or just type
    const hasCuisineWidget = text.toLowerCase().includes('cuisine');
    if (hasCuisineWidget) {
      const clickedNI = await tryClickWidget(page, 'North Indian', 3000);
      const clickedSI = await tryClickWidget(page, 'South Indian', 2000);
      const clickedContinue = await tryClickWidget(page, 'Continue', 3000);
      if (clickedContinue) {
        await waitForResponse(page);
      } else if (clickedNI || clickedSI) {
        // Might need to send Continue as text
        await sendMessage(page, 'Continue');
        await waitForResponse(page);
      } else {
        await sendMessage(page, 'North Indian and South Indian');
        await waitForResponse(page);
      }
    } else {
      await sendMessage(page, 'North Indian and South Indian cuisines');
      await waitForResponse(page);
    }
    await screenshot(page, '04-turn4-cuisine');
    text = await getLatestResponse(page);
    console.log('T4 (last 1200):', text.slice(-1200));

    // ─── TURN 5: Generate meal plan ───
    console.log('\n=== TURN 5: Generate meal plan ===');
    await sendMessage(page, 'Generate my meal plan');
    await waitForResponse(page, 180_000);
    await screenshot(page, '05-turn5-mealplan');
    text = await getLatestResponse(page);
    console.log('T5 (last 1500):', text.slice(-1500));

    const hasMealPlan = text.toLowerCase().includes('meal plan') || text.toLowerCase().includes('breakfast') ||
                         text.toLowerCase().includes('nutrient') || text.toLowerCase().includes('calori') ||
                         text.toLowerCase().includes('day 1') || text.toLowerCase().includes('ready');
    console.log(`Meal plan generated: ${hasMealPlan}`);
    expect(hasMealPlan).toBeTruthy();

    // ─── TURN 6: FIDDLE — Reduce carbs ───
    console.log('\n=== TURN 6: Reduce carbs, increase protein ===');
    await sendMessage(page, 'Reduce carbs by 20g and increase protein by 15g');
    await waitForResponse(page, 180_000);
    await screenshot(page, '06-turn6-reduce-carbs');
    text = await getLatestResponse(page);
    console.log('T6 (last 1200):', text.slice(-1200));

    const ackCarbs = text.toLowerCase().includes('carb') || text.toLowerCase().includes('protein') ||
                      text.toLowerCase().includes('target') || text.toLowerCase().includes('regenerat') ||
                      text.toLowerCase().includes('updated');
    console.log(`Acknowledges macro change: ${ackCarbs}`);
    expect(ackCarbs).toBeTruthy();

    // ─── TURN 7: FIDDLE — Swap breakfast ───
    console.log('\n=== TURN 7: Swap breakfast ===');
    await sendMessage(page, 'I dont like idli for breakfast. Can you suggest something else?');
    await waitForResponse(page, 180_000);
    await screenshot(page, '07-turn7-swap-breakfast');
    text = await getLatestResponse(page);
    console.log('T7 (last 1200):', text.slice(-1200));

    const ackSwap = text.toLowerCase().includes('breakfast') || text.toLowerCase().includes('replace') ||
                     text.toLowerCase().includes('instead') || text.toLowerCase().includes('alternative') ||
                     text.toLowerCase().includes('swap') || text.toLowerCase().includes('idli');
    console.log(`Handles breakfast swap: ${ackSwap}`);
    expect(ackSwap).toBeTruthy();

    // ─── TURN 8: FIDDLE — Add evening snack ───
    console.log('\n=== TURN 8: Add evening snack ===');
    await sendMessage(page, 'Add a healthy evening snack around 150 calories with protein');
    await waitForResponse(page, 180_000);
    await screenshot(page, '08-turn8-add-snack');
    text = await getLatestResponse(page);
    console.log('T8 (last 1200):', text.slice(-1200));

    const ackSnack = text.toLowerCase().includes('snack') || text.toLowerCase().includes('evening') ||
                      text.toLowerCase().includes('protein') || text.toLowerCase().includes('150');
    console.log(`Adds snack: ${ackSnack}`);
    expect(ackSnack).toBeTruthy();

    // ─── TURN 9: FIDDLE — Regenerate full plan ───
    console.log('\n=== TURN 9: Regenerate plan ===');
    await sendMessage(page, 'Regenerate my entire meal plan with all these changes');
    await waitForResponse(page, 180_000);
    await screenshot(page, '09-turn9-regenerate');
    text = await getLatestResponse(page);
    console.log('T9 (last 1500):', text.slice(-1500));

    const regenerated = text.toLowerCase().includes('meal plan') || text.toLowerCase().includes('ready') ||
                         text.toLowerCase().includes('regenerat') || text.toLowerCase().includes('new plan') ||
                         text.toLowerCase().includes('nutrient') || text.toLowerCase().includes('calori');
    console.log(`Plan regenerated: ${regenerated}`);
    expect(regenerated).toBeTruthy();

    // ─── TURN 10: FIDDLE — Switch to non-veg ───
    console.log('\n=== TURN 10: Switch to non-veg ===');
    await sendMessage(page, 'Switch to non-veg diet. Add eggs and chicken to my plan and regenerate.');
    await waitForResponse(page, 180_000);
    await screenshot(page, '10-turn10-nonveg');
    text = await getLatestResponse(page);
    console.log('T10 (last 1200):', text.slice(-1200));

    const ackNonVeg = text.toLowerCase().includes('non-veg') || text.toLowerCase().includes('chicken') ||
                       text.toLowerCase().includes('egg') || text.toLowerCase().includes('non veg') ||
                       text.toLowerCase().includes('preference') || text.toLowerCase().includes('diet');
    console.log(`Handles non-veg switch: ${ackNonVeg}`);
    expect(ackNonVeg).toBeTruthy();

    await screenshot(page, '11-final');
    console.log('\n=== FULL TEST COMPLETE — 10 turns ===');
  });
});
