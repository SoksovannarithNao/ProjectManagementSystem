import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD, SEED_ADMIN_USERNAME } from './helpers.js'

// Checklist risk R-4: the sign-in session. The access token is short-lived and lives in the
// browser's memory only; what keeps a person signed in is a refresh token in an httpOnly cookie
// (its hash is in refresh_tokens), which is deleted on sign-out and when the password changes,
// and refused once the account is no longer active.

const MINUTE = 60 * 1000
const COOKIE = 'taskflow_refresh'

const apiLogin = async (request, username, password = SEED_PASSWORD) => {
  const res = await request.post('/api/auth/login', { data: { username, password } })
  expect(res.status()).toBe(200)
  return res
}
const bearer = async (res) => ({ Authorization: `Bearer ${(await res.json()).token}` })
// The raw refresh cookie of a login response, to replay it later by hand.
const refreshCookieOf = (res) => /taskflow_refresh=([^;]+)/.exec(res.headers()['set-cookie'])[1]
const refreshWith = (request, value) => request.post('/api/auth/refresh', { headers: { Cookie: `${COOKIE}=${value}` } })

test.describe('session: browser', () => {
  test('the access token is never stored: storage keeps who signed in, the cookie is httpOnly, and a reload stays signed in', async ({ page, context }) => {
    await login(page, 'dev.chen')

    const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('taskflow.auth')))
    expect(stored).toEqual({ username: 'dev.chen', role: expect.anything() })
    expect(await page.evaluate(() => globalThis.document.cookie)).not.toContain(COOKIE)

    const cookie = (await context.cookies()).find((c) => c.name === COOKIE)
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/api/auth' })

    // the access token is gone after a reload, and the cookie brings the session back
    await page.reload()
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByTestId('dashboard-stats')).toBeVisible()
  })

  test('an access token that has run out is renewed silently and the request is repeated', async ({ page }) => {
    await login(page, 'dev.chen')

    let refused = false
    await page.route('**/api/projects', async (route) => {
      if (!refused) {
        refused = true
        await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'expired' }) })
      } else {
        await route.continue()
      }
    })
    const refreshed = page.waitForResponse((r) => r.url().endsWith('/api/auth/refresh') && r.status() === 200)

    await page.goto('/projects')
    await refreshed
    await expect(page.locator('a[href^="/projects/"]').first()).toBeVisible()
    await expect(page).toHaveURL(/\/projects$/)
    expect(refused).toBe(true)
  })

  test('signing out ends the session on the server: the old cookie no longer works', async ({ page, context, request }) => {
    await page.clock.install()
    await login(page, 'dev.chen')
    await page.goto('/tasks')
    await expect(page.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible()
    await page.waitForFunction(() => localStorage.getItem('taskflow.lastActive') !== null)
    const before = (await context.cookies()).find((c) => c.name === COOKIE).value
    expect((await refreshWith(request, before)).status()).toBe(200)

    await page.clock.fastForward(15 * MINUTE + 2000)
    await page.getByRole('button', { name: 'Sign out now' }).click()
    await expect(page).toHaveURL(/\/login/)

    // The page reaches /login as soon as the sign-out starts; the server's reply (which clears the
    // cookie) can arrive a moment later, so wait for it.
    await expect.poll(async () => (await context.cookies()).find((c) => c.name === COOKIE)).toBeUndefined()
    expect(await page.evaluate(() => localStorage.getItem('taskflow.auth'))).toBeNull()
    expect((await refreshWith(request, before)).status()).toBe(401)
  })

  test('without a live session a reload goes to the sign-in page', async ({ page, context }) => {
    await login(page, 'dev.chen')
    await context.clearCookies() // the refresh cookie is gone (expired, or cleared by the person)

    await page.reload()
    await expect(page).toHaveURL(/\/login/)
    expect(await page.evaluate(() => localStorage.getItem('taskflow.auth'))).toBeNull()
  })
})

test.describe('session: API', () => {
  test('sign-in sets the cookie, refresh trades it for a new token, and anything else is refused', async ({ request }) => {
    const res = await apiLogin(request, 'dev.chen')
    const body = await res.json()
    expect(body).toMatchObject({ username: 'dev.chen', role: expect.anything() })
    expect(Object.keys(body).sort()).toEqual(['role', 'token', 'username']) // the refresh token is not in the body
    expect(res.headers()['set-cookie']).toMatch(/HttpOnly/i)
    expect(res.headers()['set-cookie']).toMatch(/SameSite=Strict/i)
    expect(res.headers()['set-cookie']).toMatch(/Path=\/api\/auth/i)
    const cookie = refreshCookieOf(res)

    const refreshed = await refreshWith(request, cookie)
    expect(refreshed.status()).toBe(200)
    const fresh = await refreshed.json()
    expect(fresh.username).toBe('dev.chen')
    // the new access token works
    expect((await request.get('/api/users/me/permissions', { headers: { Authorization: `Bearer ${fresh.token}` } })).status()).toBe(200)

    expect((await request.post('/api/auth/refresh', { headers: { Cookie: '' } })).status()).toBe(401)
    expect((await refreshWith(request, 'not-a-real-token')).status()).toBe(401)
  })

  test('a changed password, a reset password and a suspended account each end the sessions', async ({ request }) => {
    const admin = await bearer(await apiLogin(request, SEED_ADMIN_USERNAME))
    const stamp = `${Date.now()}`
    const username = `session.${stamp}`
    const created = await request.post('/api/users', {
      headers: admin,
      data: { fullName: `Session Person ${stamp}`, username, email: `${username}@example.com`, password: SEED_PASSWORD, accountStatus: 'ACTIVE' },
    })
    expect(created.status()).toBe(201)
    const id = (await created.json()).id
    const edit = (extra) => ({ fullName: `Session Person ${stamp}`, username, email: `${username}@example.com`, accountStatus: 'ACTIVE', ...extra })
    try {
      // 1. the person changes their own password
      let res = await apiLogin(request, username)
      let cookie = refreshCookieOf(res)
      expect((await refreshWith(request, cookie)).status()).toBe(200)
      const changed = await request.put('/api/users/me/password', {
        headers: await bearer(res),
        data: { currentPassword: SEED_PASSWORD, newPassword: 'ChangedPassw0rd!', confirmNewPassword: 'ChangedPassw0rd!' },
      })
      expect(changed.status()).toBe(200)
      expect((await refreshWith(request, cookie)).status()).toBe(401)

      // 2. an administrator resets the password
      res = await apiLogin(request, username, 'ChangedPassw0rd!')
      cookie = refreshCookieOf(res)
      expect((await refreshWith(request, cookie)).status()).toBe(200)
      expect((await request.put(`/api/users/${id}`, { headers: admin, data: edit({ password: 'ResetPassw0rd!' }) })).status()).toBe(200)
      expect((await refreshWith(request, cookie)).status()).toBe(401)

      // 3. an administrator suspends the account: its cookie stops working even though it has not expired
      res = await apiLogin(request, username, 'ResetPassw0rd!')
      cookie = refreshCookieOf(res)
      expect((await refreshWith(request, cookie)).status()).toBe(200)
      expect((await request.put(`/api/users/${id}`, { headers: admin, data: edit({ accountStatus: 'SUSPENDED' }) })).status()).toBe(200)
      expect((await refreshWith(request, cookie)).status()).toBe(401)
    } finally {
      await request.delete(`/api/users/${id}`, { headers: admin })
    }
  })
})
