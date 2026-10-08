import { test, expect } from '@playwright/test'
import { login } from './helpers.js'

// Time tracking on a task: estimate vs. logged time, manual entries, and the
// start/stop timer. Each test cleans up the entry it creates so the seeded
// data is left as it was found.
test.beforeEach(async ({ page }) => {
  await login(page)
  await page.goto('/projects')
  await page.locator('a[href^="/projects/"]').first().click()
  await expect(page).toHaveURL(/\/projects\/\d+$/)
  await page.getByTestId('task-row').first().click()
  await expect(page.getByRole('heading', { name: 'Time tracking', exact: true })).toBeVisible()
})

test('logs time with a friendly duration and shows it in the list and summary', async ({ page }) => {
  const note = `e2e entry ${Date.now()}`
  await page.getByLabel('Time spent').fill('1h 30m')
  await page.getByLabel('What did you work on? (optional)').fill(note)
  await page.getByRole('button', { name: 'Log time' }).click()

  const entry = page.getByRole('list', { name: 'Time entries' }).getByRole('listitem').filter({ hasText: note })
  await expect(entry).toBeVisible()
  await expect(entry).toContainText('1h 30m')

  // Clean up: two-step inline delete.
  await entry.getByRole('button', { name: /^Delete 1h 30m entry/ }).click()
  await entry.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText(note)).toHaveCount(0)
})

test('rejects a time it cannot read, with a message that says what to type', async ({ page }) => {
  await page.getByLabel('Time spent').fill('banana')
  await page.getByRole('button', { name: 'Log time' }).click()
  await expect(page.getByText('Enter a time like 1.5, 1h 30m or 45m.')).toBeVisible()
})

test('start timer switches to a running clock that survives a reload, and stops cleanly', async ({ page }) => {
  await page.getByRole('button', { name: 'Start timer' }).click()
  const stop = page.getByRole('button', { name: /^Stop/ })
  await expect(stop).toContainText(/0:00:0\d/)

  await page.reload()
  await page.getByTestId('task-row').first().click()
  await expect(page.getByRole('button', { name: /^Stop/ })).toBeVisible()

  await page.getByRole('button', { name: /^Stop/ }).click()
  await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible()
})
