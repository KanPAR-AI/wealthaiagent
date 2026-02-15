import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config for YourFinAdvisor.
 *
 * Usage (on-demand, NOT CI):
 *   npx playwright test              # Run all E2E tests
 *   npx playwright test --headed     # Watch the browser
 *   npx playwright test --ui         # Interactive UI mode
 *   npx playwright test --debug      # Step-through debugger
 *
 * Prerequisites:
 *   - Frontend running:  npm run dev  (port 5173)
 *   - Backend running:   ./start-all.sh  (ports 8080 + 8000)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,   // run tests sequentially — each is a long multi-turn flow
  forbidOnly: true,
  retries: 0,             // on-demand tests, no retries
  workers: 1,

  // Generous timeout — LLM responses can take 30-60s
  timeout: 180_000,       // 3 min per test
  expect: {
    timeout: 60_000,      // 1 min for expect assertions
  },

  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
