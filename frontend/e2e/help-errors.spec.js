import { test, expect } from '@playwright/test'
import { login } from './helpers.js'

// The error page (one page for every HTTP status) and the Help & Support page.

test.describe('error page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('an unknown address shows a 404 inside the app, with a way back', async ({ page }) => {
    await page.goto('/this/page/does/not/exist')
    await expect(page.getByText('Page not found')).toBeVisible()
    await expect(page.getByText(/Error 404/)).toBeVisible()
    await expect(page.locator('aside')).toBeVisible() // still the normal app shell

    await page.getByRole('link', { name: 'Back to the dashboard' }).click()
    await expect(page).toHaveURL('/')
  })

  test('a project that does not exist (or is off limits) is also a 404', async ({ page }) => {
    await page.goto('/projects/999999999')
    await expect(page.getByText('Page not found')).toBeVisible()
    await expect(page.getByText(/Error 404/)).toBeVisible()
  })

  test('/error/:status explains each status, and offers "Try again" only where it can help', async ({ page }) => {
    const cases = [
      ['403', 'You do not have access to this page', false],
      ['429', 'Too many requests', false],
      ['500', 'Something went wrong', true],
      ['503', 'Service unavailable', true],
      ['0', 'Cannot reach the server', true],
    ]
    for (const [status, title, retry] of cases) {
      await page.goto(`/error/${status}`)
      await expect(page.getByText(title)).toBeVisible()
      if (status !== '0') await expect(page.getByText(new RegExp(`Error ${status}`))).toBeVisible()
      await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(retry ? 1 : 0)
    }
  })

  test('an unrecognised status still gets a readable page, and the page links to Help & Support', async ({ page }) => {
    await page.goto('/error/418')
    await expect(page.getByText('Something went wrong')).toBeVisible()
    await page.locator('main').getByRole('link', { name: /Help & Support/ }).click()
    await expect(page).toHaveURL('/help')
  })
})

test.describe('help and support page', () => {
  test('opens from the sidebar as a page of its own, not a pop-up', async ({ page }) => {
    await login(page, 'dev.chen')
    await page.locator('aside').getByRole('link', { name: /Help & Support/ }).click()
    await expect(page).toHaveURL('/help')
    await expect(page.getByRole('heading', { name: 'Help & Support' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    for (const section of ['Getting started', 'Projects and team', 'Work, approvals and reminders', 'Troubleshooting', 'Still stuck?']) {
      await expect(page.getByRole('heading', { name: section })).toBeVisible()
    }
    // answers are written from what the app does now: the password is on the Profile page
    await expect(page.getByText('How do I change my password?')).toBeVisible()
    await expect(page.getByText(/Open your Profile page and use the Password section/)).toBeVisible()
    await expect(page.locator('aside').getByRole('link', { name: /Help & Support/ })).toHaveAttribute('aria-current', 'page')
  })
})
