import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD, SEED_ADMIN_USERNAME } from './helpers.js'

// The top bar's theme control is the same one-click toggle as on the public pages: each click steps
// Light -> Dark -> System, and in the signed-in app the choice is also saved to the account. The test
// uses a throw-away account, so no seeded user's saved theme is touched.

async function adminHeaders(request) {
  const r = await request.post('/api/auth/login', { data: { username: SEED_ADMIN_USERNAME, password: SEED_PASSWORD } })
  expect(r.ok()).toBeTruthy()
  return { Authorization: `Bearer ${(await r.json()).token}` }
}

test.describe('theme toggle in the signed-in app', () => {
  let headers
  let account
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`

  test.beforeEach(async ({ request }) => {
    headers = await adminHeaders(request)
    const r = await request.post('/api/users', {
      headers,
      data: {
        fullName: `Theme Person ${suffix}`,
        username: `theme.${suffix}`,
        email: `theme.${suffix}@example.com`,
        password: SEED_PASSWORD,
        accountStatus: 'ACTIVE',
      },
    })
    expect(r.status()).toBe(201)
    account = await r.json()
  })

  test.afterEach(async ({ request }) => {
    await request.delete(`/api/users/${account.id}`, { headers })
  })

  const savedTheme = async (request) => (await (await request.get(`/api/users/${account.id}`, { headers })).json()).themePreference

  test('one button steps Light, Dark, System, applies at once and is saved to the account', async ({ page, request }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await login(page, account.username)
    const html = page.locator('html')
    const toggle = page.getByRole('button', { name: /^Theme:/ })

    // a new account starts on System: no data-theme attribute, the label offers Light next
    await expect(toggle).toHaveAccessibleName('Theme: System. Switch to Light')
    await expect(html).not.toHaveAttribute('data-theme', /.+/)

    await toggle.click()
    await expect(html).toHaveAttribute('data-theme', 'light')
    await expect(toggle).toHaveAccessibleName('Theme: Light. Switch to Dark')
    await expect.poll(() => savedTheme(request)).toBe('LIGHT')

    await toggle.click()
    await expect(html).toHaveAttribute('data-theme', 'dark')
    await expect(toggle).toHaveAccessibleName('Theme: Dark. Switch to System')
    await expect.poll(() => savedTheme(request)).toBe('DARK')

    // it survives a reload (the saved preference wins after the page loads)
    await page.reload()
    await expect(html).toHaveAttribute('data-theme', 'dark')

    await toggle.click()
    await expect(html).not.toHaveAttribute('data-theme', /.+/)
    await expect(toggle).toHaveAccessibleName('Theme: System. Switch to Light')
    await expect.poll(() => savedTheme(request)).toBe('SYSTEM')
  })

  test('the old three-item menu is gone: there is just the one button', async ({ page }) => {
    await login(page, account.username)
    await page.getByRole('button', { name: /^Theme:/ }).click()
    await expect(page.getByRole('button', { name: 'Light', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Theme/ })).toHaveCount(1)
  })
})
