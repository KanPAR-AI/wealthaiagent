import { test, expect } from '@playwright/test';

const EMAIL = 'ravipradeep89@gmail.com';
const PASSWORD = 'papa1210';

// The "Control Centre" entry point lives in the chat sidebar footer (pinned,
// mt-auto) on every AppLayout screen (chat/new/...), giving a discoverable
// path to the Memory OS (/memory). Visible to any signed-in, non-anonymous
// user — mirrors the memory.read gate (ADR-001).
test('Control Centre nav entry is discoverable and navigates to /memory', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/chataiagent/');
  await page.getByRole('button', { name: /Continue with Email/i }).click();
  await page.getByPlaceholder('Email address').fill(EMAIL);
  await page.getByPlaceholder('Password').fill(PASSWORD);
  await page.getByRole('button', { name: /^Sign In$/ }).click();
  await expect.poll(() => page.url(), { timeout: 30_000 }).not.toMatch(/\/$|login/i);

  await page.goto('/chataiagent/new');
  const link = page.getByRole('link', { name: /Control Centre/i });
  await expect(link).toBeVisible({ timeout: 15_000 });
  await expect(link).toHaveAttribute('href', '/chataiagent/memory');
  await link.scrollIntoViewIfNeeded();
  // Activate the anchor via keyboard (real anchor activation; avoids the
  // pointer hit-test on the nested Radix SidebarMenuButton).
  await link.focus();
  await page.keyboard.press('Enter');
  // /memory index redirects to overview
  await expect.poll(() => page.url(), { timeout: 15_000 }).toMatch(/\/memory\/overview/);
  // the memory page chrome renders (assistant opener floats on every screen)
  await expect(page.getByTestId('memory-assistant-open')).toBeVisible({ timeout: 15_000 });
});
