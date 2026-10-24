/* global document, window, getComputedStyle -- evaluated inside the browser page */
import { test, expect } from '@playwright/test'
import { login } from './helpers.js'

// The pages anyone can open without signing in: the home page at "/", /privacy-policy and /terms-of-service.
// They are the three URLs given to the Google OAuth consent screen, so each must load from a direct address,
// survive a refresh, and never redirect to sign-in.

const CONTACT = 'sovannarithnao@gmail.com'

test.describe('public pages (signed out)', () => {
  test('the home page introduces TaskFlow and leads to sign in and register', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/plan the work/i)
    await expect(page.getByText(/project and task management web application/i).first()).toBeVisible()

    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toHaveAttribute('href', '/login')
    await expect(page.getByRole('link', { name: 'Create account' }).first()).toHaveAttribute('href', '/register')
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy-policy')
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms-of-service')
  })

  for (const [path, heading, mustMention] of [
    ['/privacy-policy', 'Privacy Policy', /Google API Services User Data Policy/],
    ['/terms-of-service', 'Terms of Service', /Acceptable use/],
  ]) {
    test(`${path} opens directly, survives a refresh and needs no sign-in`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      await expect(page.getByText(mustMention).first()).toBeVisible()
      await expect(page.getByRole('link', { name: CONTACT }).first()).toHaveAttribute('href', `mailto:${CONTACT}`)
      await expect(page).toHaveTitle(new RegExp(heading))

      await page.reload()
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    })
  }

  test('the privacy policy states how Google OAuth is really used', async ({ page }) => {
    await page.goto('/privacy-policy')
    const google = page.locator('#google')
    await expect(google).toContainText('optional')
    await expect(google).toContainText('Google can create one for you')
    await expect(google).toContainText('never attached to an account just because')
    await expect(google).toContainText('gmail.send')
    await expect(google).toContainText('does not read')
  })

  test('the legal pages link to each other, and sign in and register link to them', async ({ page }) => {
    await page.goto('/privacy-policy')
    await page.getByRole('contentinfo').getByRole('link', { name: 'Terms of Service' }).click()
    await expect(page).toHaveURL(/\/terms-of-service$/)
    await page.getByRole('contentinfo').getByRole('link', { name: 'Privacy Policy' }).click()
    await expect(page).toHaveURL(/\/privacy-policy$/)

    await page.goto('/login')
    await expect(page.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy-policy')
    await expect(page.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms-of-service')
    await page.goto('/register')
    await expect(page.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy-policy')
    await expect(page.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms-of-service')
  })

  test('the on-this-page list jumps to a section', async ({ page }) => {
    await page.goto('/terms-of-service')
    await page.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Acceptable use' }).click()
    await expect(page).toHaveURL(/#acceptable-use$/)
    await expect(page.locator('#acceptable-use')).toBeInViewport()
  })

  test('other protected addresses still lead to sign in', async ({ page }) => {
    await page.goto('/projects')
    await expect(page).toHaveURL(/\/login$/)
  })
})

test.describe('public pages: themes, layout and keyboard', () => {
  const canvas = (page) => page.locator('div.bg-canvas').first().evaluate((el) => getComputedStyle(el).backgroundColor)

  test('they follow the light and the dark theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/privacy-policy')
    const light = await canvas(page)
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.reload()
    const dark = await canvas(page)
    expect(light).toBe('rgb(245, 246, 248)')
    expect(dark).toBe('rgb(28, 28, 30)')
  })

  test('the theme button switches Light, Dark and System', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    const html = page.locator('html')
    await page.getByRole('button', { name: /^Theme:/ }).click()
    const first = await html.getAttribute('data-theme')
    await page.getByRole('button', { name: /^Theme:/ }).click()
    const second = await html.getAttribute('data-theme')
    expect(first).not.toBe(second)
  })

  test('on a phone-width screen nothing scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    for (const path of ['/', '/privacy-policy', '/terms-of-service']) {
      await page.goto(path)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0)
      await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible()
    }
  })

  test('the first Tab stop is a skip link to the content', async ({ page }) => {
    await page.goto('/terms-of-service')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Skip to content' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#main$/)
  })

  test('each page has one main landmark and one h1', async ({ page }) => {
    for (const path of ['/', '/privacy-policy', '/terms-of-service']) {
      await page.goto(path)
      await expect(page.getByRole('main')).toHaveCount(1)
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    }
  })
})

test.describe('public pages (signed in)', () => {
  test('a signed-in person still gets the dashboard at "/", and can open the legal pages', async ({ page }) => {
    await login(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /hello,/i })).toBeVisible()

    await page.goto('/privacy-policy')
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible()
    await expect(page.getByRole('link', { name: /^Open TaskFlow$/ })).toBeVisible()
  })
})
