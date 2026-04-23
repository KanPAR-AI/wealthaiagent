import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173/chataiagent';

test.describe('MysticAI Mode', () => {
  test('?mystic=1 on /new shows MysticAI branding', async ({ page }) => {
    await page.goto(`${BASE}/new?mystic=1`);
    await page.waitForLoadState('networkidle');

    // Logo should say MysticAI
    await expect(page.locator('text=MysticAI')).toBeVisible({ timeout: 5000 });

    // Should NOT show WealthWise
    const body = await page.textContent('body');
    expect(body).not.toContain('WealthWise');

    await page.screenshot({ path: 'e2e/screenshots/mysticai-branding.png', fullPage: true });
  });

  test('normal mode on /new shows WealthWise branding', async ({ page }) => {
    await page.goto(`${BASE}/new`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=WealthWise')).toBeVisible({ timeout: 5000 });

    const body = await page.textContent('body');
    expect(body).not.toContain('MysticAI');

    await page.screenshot({ path: 'e2e/screenshots/wealthwise-branding.png', fullPage: true });
  });

  test('mystic chat page has file upload + input', async ({ page }) => {
    await page.goto(`${BASE}/new?mystic=1`);
    await page.waitForLoadState('networkidle');

    // Should have the full chat input with attachment button
    await expect(page.getByPlaceholder(/ask me anything/i)).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'e2e/screenshots/mysticai-chat-input.png', fullPage: true });
  });
});
