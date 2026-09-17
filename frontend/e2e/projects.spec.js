import { test, expect } from '@playwright/test'
import { login } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await login(page)
})

test('lists projects as clickable cards with real data', async ({ page }) => {
  await page.goto('/projects')
  const cards = page.locator('a[href^="/projects/"]')
  await expect(cards.first()).toBeVisible()
  await expect(cards.first()).toContainText('%') // progress
})

test('opening a project card navigates to its detail page', async ({ page }) => {
  await page.goto('/projects')
  const firstCard = page.locator('a[href^="/projects/"]').first()
  const name = await firstCard.locator('h3').innerText()
  await firstCard.click()

  await expect(page).toHaveURL(/\/projects\/\d+$/)
  await expect(page.getByRole('heading', { name })).toBeVisible()
  await expect(page.getByText(/^Tasks/)).toBeVisible()
  await expect(page.getByText(/^Members/)).toBeVisible()
  await expect(page.getByText(/^Milestones/)).toBeVisible()
})

test('clicking a task inside a project opens its detail panel', async ({ page }) => {
  await page.goto('/projects')
  await page.locator('a[href^="/projects/"]').first().click()
  await expect(page).toHaveURL(/\/projects\/\d+$/)

  await page.getByTestId('task-row').first().click()

  await expect(page.getByText('Task', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Subtasks', exact: true })).toBeVisible()
})
