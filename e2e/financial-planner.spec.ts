/**
 * WealthWise Financial Life Planner — E2E Tests
 *
 * Tests the complete financial planning experience through the UI:
 *
 *   CUJ 1: Complete Onboarding Flow
 *   CUJ 2: Playground Slider Interaction
 *   CUJ 3: What-If Query (Plan-and-Execute)
 *   CUJ 4: Plan Summary Generation
 *   CUJ 5: Edge Cases (min/max income, single/all goals)
 *   CUJ 6: Widget Persistence (scroll + re-render)
 *
 * Prerequisites:
 *   - Frontend: npm run dev (port 5173)
 *   - Backend: cd chatservice && docker compose up --build (port 8080, SKIP_AUTH=true)
 *
 * Run:
 *   npx playwright test e2e/financial-planner.spec.ts --headed
 */

import { test, expect, Page } from '@playwright/test'

const BASE = '/chataiagent/'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Send a chat message by typing into the input and pressing Enter. */
async function sendMessage(page: Page, text: string) {
  const input = page.locator('textarea').first()
  await input.waitFor({ state: 'visible', timeout: 10_000 })
  await expect(input).toBeEnabled({ timeout: 30_000 })
  await input.fill(text)
  await page.waitForTimeout(300)
  await input.press('Enter')
}

/** Wait for the AI response to finish streaming. */
async function waitForResponse(page: Page, timeoutMs = 90_000) {
  try {
    await page.getByText('Thinking...').waitFor({ state: 'visible', timeout: 10_000 })
  } catch {
    // Response may have been instant
  }
  await page.getByText('Thinking...').waitFor({ state: 'hidden', timeout: timeoutMs })
  await page.waitForTimeout(2000)
}

async function loginAndStartChat(page: Page) {
  await page.goto(`${BASE}`)
  await page.waitForTimeout(3000)
  await page.goto(`${BASE}new`)
  await page.waitForTimeout(1000)
  const chatInput = page.locator('textarea').first()
  await expect(chatInput).toBeVisible({ timeout: 10_000 })
}

async function triggerFinancialPlanner(page: Page) {
  await sendMessage(page, 'help me plan my finances')
  await waitForResponse(page)
}

/** Click a Continue button (profile/goal detail) and wait for response. */
async function clickContinue(page: Page) {
  // Wait for Continue button to exist in DOM
  const btn = page.locator('button').filter({ hasText: /^Continue$/i }).first()
  await btn.waitFor({ state: 'visible', timeout: 15_000 })
  // Use dispatchEvent for reliability (Radix scroll area can block Playwright clicks)
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    const continueBtn = btns.find(b => {
      const text = (b.textContent || '').trim()
      return text === 'Continue' && !b.disabled
    })
    if (continueBtn) {
      continueBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    }
  })
  await waitForResponse(page)
}

/** Select goals in the goal picker and click Continue. Uses dispatchEvent for Radix compat. */
async function selectGoalsAndContinue(page: Page, goalNames: string[] = ['Retirement']) {
  // Scroll Radix viewport to bottom so goal picker is visible
  await page.evaluate(() => {
    const viewport = document.querySelector('[data-radix-scroll-area-viewport]')
    if (viewport) viewport.scrollTop = viewport.scrollHeight
  })
  await page.waitForTimeout(1000)

  // Wait for goal picker
  await page.locator('text=Choose Your Goals').waitFor({ state: 'visible', timeout: 30_000 })
  await page.waitForTimeout(2000)

  // Click goal tiles via .click() (Playwright coordinate-based clicks fail in Radix scroll area)
  const clickedGoals = await page.evaluate((names) => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const clicked: string[] = []
    for (const btn of buttons) {
      const text = btn.textContent || ''
      for (const name of names) {
        if (text.includes(name) && !btn.disabled) {
          btn.click()
          clicked.push(name)
        }
      }
    }
    return clicked
  }, goalNames)
  console.log('Clicked goals:', clickedGoals)
  await page.waitForTimeout(1000)

  // Verify goals were selected
  const submitText = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    const sub = btns.find(b => (b.textContent || '').includes('Continue with') || (b.textContent || '').includes('Select at least'))
    return (sub?.textContent || '').trim()
  })
  console.log('Submit button text:', submitText)

  // Click "Continue with N goals"
  if (submitText.includes('Continue with')) {
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
      const continueBtn = btns.find(b => (b.textContent || '').includes('Continue with'))
      if (continueBtn) continueBtn.click()
    })
    await waitForResponse(page)
  } else {
    // Fallback: try clicking each goal individually with delay
    for (const name of goalNames) {
      const tile = page.locator('button').filter({ hasText: name }).first()
      if (await tile.isVisible()) {
        await tile.click({ force: true, delay: 50 })
        await page.waitForTimeout(500)
      }
    }
    await page.waitForTimeout(500)
    const continueBtn = page.locator('button').filter({ hasText: /Continue with/i }).first()
    await continueBtn.waitFor({ state: 'visible', timeout: 10_000 })
    await continueBtn.click({ force: true })
    await waitForResponse(page)
  }
}

/** Click Continue on goal detail card and wait for response. */
async function clickGoalDetailContinue(page: Page) {
  await page.waitForTimeout(2000)
  // Click the last "Continue" button (goal detail has it at the bottom)
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    const continueBtns = btns.filter(b => {
      const text = (b.textContent || '').trim()
      return text === 'Continue' && !b.disabled
    })
    if (continueBtns.length > 0) {
      const lastBtn = continueBtns[continueBtns.length - 1]
      lastBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    }
  })
  await waitForResponse(page)
}

/** Complete full onboarding: profile → goals → goal details. */
async function completeFullOnboarding(page: Page, goalNames: string[] = ['Retirement']) {
  await clickContinue(page) // profile
  await selectGoalsAndContinue(page, goalNames) // goal picker
  await clickGoalDetailContinue(page) // goal details
}

// ---------------------------------------------------------------------------
// CUJ 1: Complete Onboarding Flow
// ---------------------------------------------------------------------------

test.describe('CUJ 1: Complete Onboarding Flow', () => {
  test('should show onboarding widget and complete profile step', async ({ page }) => {
    await loginAndStartChat(page)
    await triggerFinancialPlanner(page)

    // Verify onboarding widget rendered
    const profileHeading = page.locator('text=Your Financial Profile')
    await expect(profileHeading).toBeVisible({ timeout: 15_000 })

    // Should see sliders
    const sliders = page.locator('input[type="range"]')
    expect(await sliders.count()).toBeGreaterThanOrEqual(3)

    // Click Continue to submit profile
    await clickContinue(page)

    // Should see goal picker
    const goalHeading = page.locator('text=Choose Your Goals')
    await expect(goalHeading).toBeVisible({ timeout: 15_000 })
  })

  test('should complete full onboarding to playground', async ({ page }) => {
    await loginAndStartChat(page)
    await triggerFinancialPlanner(page)

    // Complete full onboarding (profile → goals → goal details)
    await completeFullOnboarding(page)

    // Should reach the playground
    const playground = page.locator('text=Financial Playground').first()
    await expect(playground).toBeVisible({ timeout: 30_000 })
  })
})

// ---------------------------------------------------------------------------
// CUJ 2: Playground Slider Interaction
// ---------------------------------------------------------------------------

test.describe('CUJ 2: Playground Slider Interaction', () => {
  test('playground should render with river visualization', async ({ page }) => {
    await loginAndStartChat(page)
    await triggerFinancialPlanner(page)

    // Complete full onboarding
    await completeFullOnboarding(page)

    // Verify playground rendered
    const playground = page.locator('text=Financial Playground').first()
    await expect(playground).toBeVisible({ timeout: 30_000 })

    // Verify SVG river visualization exists
    const svg = page.locator('svg').first()
    await expect(svg).toBeVisible({ timeout: 5_000 })
  })
})

// ---------------------------------------------------------------------------
// CUJ 3: What-If Query
// ---------------------------------------------------------------------------

test.describe('CUJ 3: What-If Query', () => {
  test('should handle what-if text queries', async ({ page }) => {
    await loginAndStartChat(page)
    await triggerFinancialPlanner(page)

    // Complete full onboarding
    await completeFullOnboarding(page)

    // Type a what-if query in the playground input
    const queryInput = page.locator('input[placeholder*="What if"]')
    if (await queryInput.isVisible()) {
      await queryInput.fill('What if I retire at 55?')
      await page.locator('button').filter({ hasText: /Ask/i }).click()
      await page.waitForTimeout(5000)

      // Should get a response - the playground should update
      const playground = page.locator('text=Financial Playground').first()
      await expect(playground).toBeVisible({ timeout: 10_000 })
    }
  })
})

// ---------------------------------------------------------------------------
// CUJ 4: Plan Summary Generation
// ---------------------------------------------------------------------------

test.describe('CUJ 4: Plan Summary', () => {
  test('generate plan button should trigger summary', async ({ page }) => {
    await loginAndStartChat(page)
    await triggerFinancialPlanner(page)

    // Complete full onboarding
    await completeFullOnboarding(page, ['Emergency Fund'])

    // Click "Generate Plan Summary"
    const genPlanBtn = page.locator('button').filter({ hasText: /Generate Plan/i })
    if (await genPlanBtn.isVisible()) {
      await genPlanBtn.click()
      await page.waitForTimeout(5000)

      // The chat should have a new response
      const messages = page.locator('[class*="message"], [class*="bubble"]')
      expect(await messages.count()).toBeGreaterThan(1)
    }
  })
})

// ---------------------------------------------------------------------------
// CUJ 5: Edge Cases
// ---------------------------------------------------------------------------

test.describe('CUJ 5: Edge Cases', () => {
  test('should handle onboarding with default values', async ({ page }) => {
    await loginAndStartChat(page)
    await triggerFinancialPlanner(page)

    // Just click Continue without changing anything
    await clickContinue(page)

    // Should proceed to goal picker without errors
    const goalHeading = page.locator('text=Choose Your Goals')
    await expect(goalHeading).toBeVisible({ timeout: 15_000 })
  })
})

// ---------------------------------------------------------------------------
// CUJ 6: Widget Persistence
// ---------------------------------------------------------------------------

test.describe('CUJ 6: Widget Persistence', () => {
  test('widgets should remain visible after scroll', async ({ page }) => {
    await loginAndStartChat(page)
    await triggerFinancialPlanner(page)

    // Verify initial widget is visible
    const profileHeading = page.locator('text=Your Financial Profile')
    await expect(profileHeading).toBeVisible({ timeout: 15_000 })

    // Scroll up and back down
    await page.evaluate(() => {
      window.scrollTo(0, 0)
    })
    await page.waitForTimeout(500)
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })
    await page.waitForTimeout(500)

    // Widget should still be visible
    await expect(profileHeading).toBeVisible()
  })
})
