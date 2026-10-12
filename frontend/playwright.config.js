import { defineConfig, devices } from '@playwright/test'

// E2E tests run against the app as a whole (frontend + backend + Postgres),
// so — unlike a typical Playwright setup — this does NOT spin up its own
// `webServer`. Start the full stack first (`docker compose up -d` from the
// repo root), then run tests against it here. FRONTEND_PORT lets this follow
// a non-default port the same way docker-compose.yml itself does.
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${process.env.FRONTEND_PORT || 5173}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // A CI runner has two cores and one shared backend, so fewer parallel browsers.
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['dot'], ['html', { open: 'never' }]] : 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
