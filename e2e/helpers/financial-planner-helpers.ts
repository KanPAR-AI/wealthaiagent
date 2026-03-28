import { Page, expect } from '@playwright/test'

/** Sign in with email/password via the Login page. */
export async function signInWithEmail(page: Page, email: string, password: string) {
  const emailButton = page.getByText('Continue with Email')
  await emailButton.waitFor({ state: 'visible', timeout: 10_000 })
  await emailButton.click()
  await page.waitForTimeout(500)

  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').filter({ hasText: /Sign In/i }).click()
  await page.waitForURL('**/chat**', { timeout: 15_000 })
  await page.waitForTimeout(1000)
}

/** Send a message in the chat input and wait for assistant response */
export async function sendMessage(page: Page, text: string) {
  const input = page.locator('textarea, input[type="text"]').last()
  await input.fill(text)
  await input.press('Enter')
  // Wait for assistant response to start streaming
  await page.waitForTimeout(2000)
}

/** Wait for a specific widget type to appear in the chat */
export async function waitForWidget(page: Page, widgetSelector: string, timeout = 30_000) {
  await page.locator(widgetSelector).first().waitFor({ state: 'visible', timeout })
}

/** Complete onboarding flow with specified profile */
export async function completeOnboarding(
  page: Page,
  options: { age?: number; income?: number; expenses?: number } = {},
) {
  // Wait for onboarding profile widget
  await page.waitForTimeout(3000)

  // The onboarding widget should appear with sliders
  const continueBtn = page.locator('button').filter({ hasText: /Continue/i })
  if (await continueBtn.isVisible()) {
    // Adjust sliders if needed (default values are fine for basic tests)
    await continueBtn.first().click()
    await page.waitForTimeout(2000)
  }
}

/** Select goals in the goal picker widget */
export async function selectGoals(page: Page, goalCount = 2) {
  // Click on goal tiles
  const goalButtons = page.locator('button').filter({ hasText: /Fund|Purchase|Retirement|Education|Wedding|Car|Vacation|Wealth|Debt|Business|Custom/i })
  const count = await goalButtons.count()
  const toSelect = Math.min(goalCount, count)

  for (let i = 0; i < toSelect; i++) {
    await goalButtons.nth(i).click()
    await page.waitForTimeout(300)
  }

  // Click continue
  const continueBtn = page.locator('button').filter({ hasText: /Continue with/i })
  if (await continueBtn.isVisible()) {
    await continueBtn.click()
    await page.waitForTimeout(2000)
  }
}

/** Set a range slider to a specific value */
export async function setSliderValue(page: Page, sliderLabel: string, value: number) {
  // Find the slider by its label text
  const slider = page.locator(`input[type="range"]`).filter({
    has: page.locator(`text="${sliderLabel}"`),
  })
  if (await slider.isVisible()) {
    await slider.fill(String(value))
  }
}
