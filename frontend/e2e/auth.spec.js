import { test, expect } from '@playwright/test'
import { login } from './helpers.js'

test('signs in with valid credentials and lands on the dashboard', async ({ page }) => {
  await login(page)
  await expect(page.getByRole('heading', { name: /hello,/i })).toBeVisible()
})

test('shows an error for an invalid password', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel(/username/i).fill('admin.system')
  await page.getByLabel(/password/i).fill('not-the-real-password')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByText(/invalid|incorrect|failed/i)).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

test('redirects an unauthenticated visitor away from a protected page', async ({ page }) => {
  await page.goto('/projects')
  await expect(page).toHaveURL(/\/login/)
})
