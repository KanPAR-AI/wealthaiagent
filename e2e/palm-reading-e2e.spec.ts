import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173/chataiagent';
const PALM_IMAGE = '/tmp/real_palm.png';

test.setTimeout(180000); // 3 min global timeout

test.describe('Palm Reading E2E', () => {

  test('Full flow: MysticAI → upload palm → analysis → follow-up', async ({ page }) => {
    // 1. Open MysticAI mode
    await page.goto(`${BASE}/new?mystic=1`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=MysticAI')).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/palm-01-mysticai-home.png' });

    // 2. Click the attachment button to upload palm image
    const attachBtn = page.locator('button:has(svg), label').filter({ hasText: '' }).locator('svg').first();
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(PALM_IMAGE);

    // 3. Wait for upload to complete (no more "Loading...")
    await page.waitForFunction(() => {
      return !document.body.textContent?.includes('Loading...');
    }, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e/screenshots/palm-02-uploaded.png' });

    // 4. Type message and send
    const input = page.getByPlaceholder(/ask me anything/i);
    await input.fill('Analyze my palm lines please');

    // Find and click the send/submit button
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/palm-03-sent.png', fullPage: true });

    // 5. Wait for AI response (palm analysis takes 15-45s with Gemini Pro)
    console.log('Waiting for palm analysis response...');

    // Wait for any sign of response
    const responseAppeared = await Promise.race([
      page.waitForSelector('text=Hand Shape', { timeout: 90000 }).then(() => 'analysis'),
      page.waitForSelector('text=Analyzing your palm', { timeout: 90000 }).then(() => 'analyzing'),
      page.waitForSelector('text=upload a clear photo', { timeout: 90000 }).then(() => 'ask_upload'),
      page.waitForSelector('text=Namaste', { timeout: 90000 }).then(() => 'greeting'),
      new Promise(r => setTimeout(r, 90000)).then(() => 'timeout'),
    ]);
    console.log('Response type:', responseAppeared);

    // Wait extra for streaming to finish
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'e2e/screenshots/palm-04-response.png', fullPage: true });

    // 6. Verify content quality
    const bodyText = await page.textContent('body') || '';

    // MUST NOT show raw JSON
    expect(bodyText).not.toContain('"type": "palm_analysis"');

    // MUST NOT show agent routing tag
    expect(bodyText).not.toContain('[Using astrology_ai agent]');

    // MUST have some response
    expect(bodyText.length).toBeGreaterThan(200);

    console.log('Body text length:', bodyText.length);
    console.log('Has Hand Shape:', bodyText.includes('Hand Shape'));
    console.log('Has Heart Line:', bodyText.includes('Heart Line'));
    console.log('Has Mount:', bodyText.includes('Mount'));

    // 7. Scroll to see full response
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'e2e/screenshots/palm-05-scrolled.png', fullPage: true });

    // 8. Send follow-up
    const input2 = page.getByPlaceholder(/ask me anything/i);
    if (await input2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await input2.fill('I am 38 male, tell me about my career from the palm');
      await page.keyboard.press('Enter');
      console.log('Follow-up sent, waiting...');

      await page.waitForTimeout(25000);
      await page.screenshot({ path: 'e2e/screenshots/palm-06-followup.png', fullPage: true });

      const afterFollowup = await page.textContent('body') || '';
      // Follow-up should have substantial content
      console.log('After followup length:', afterFollowup.length);
      expect(afterFollowup.length).toBeGreaterThan(1000);
    }

    console.log('✅ Palm reading E2E complete');
  });

  test('Agent dropdown has MysticAI option', async ({ page }) => {
    await page.goto(`${BASE}/new`);
    await page.waitForLoadState('networkidle');

    // Click Smart Routing dropdown
    const trigger = page.locator('text=Smart Routing');
    await trigger.click();
    await page.waitForTimeout(500);

    // Scroll dropdown to find MysticAI at bottom
    const dropdown = page.locator('[class*="overflow-y-auto"]');
    if (await dropdown.isVisible()) {
      await dropdown.evaluate(el => el.scrollTop = el.scrollHeight);
    }
    await page.waitForTimeout(300);

    await expect(page.locator('text=MysticAI')).toBeVisible({ timeout: 3000 });
    await page.screenshot({ path: 'e2e/screenshots/palm-07-dropdown-mysticai.png' });

    // Click MysticAI
    await page.locator('text=MysticAI').click();
    await page.waitForTimeout(500);

    // Verify dark theme applied
    const bgColor = await page.evaluate(() => document.body.style.background);
    expect(bgColor).toContain('#0a0612');
    await page.screenshot({ path: 'e2e/screenshots/palm-08-mysticai-selected.png' });
  });
});
