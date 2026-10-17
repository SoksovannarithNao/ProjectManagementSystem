import { test, expect } from '@playwright/test'
import { SEED_PASSWORD } from './helpers.js'

// An administrator's sign-in has a second step: the right password e-mails a 6-digit code and the session
// starts only after it is entered. Everyone else signs in as before.
//
// This needs a backend started with ADMIN_2FA_ENABLED=true and the local Mailpit (the code is read from its
// API), so it is skipped in the normal run, where the setting is off and every other spec signs in as the
// administrator with the password alone:
//   ADMIN_2FA_ENABLED=true docker compose up -d backend
//   E2E_ADMIN_2FA=1 npx playwright test admin-two-factor
//   docker compose up -d backend        (back to the default)

const MAILPIT = process.env.MAILPIT_URL || 'http://localhost:8025'
const ADMIN = 'admin.system'
const ADMIN_EMAIL = 'admin.system@taskflow.dev'

test.skip(process.env.E2E_ADMIN_2FA !== '1', 'needs ADMIN_2FA_ENABLED=true on the backend (see the comment at the top)')

// The newest sign-in code mailed to the administrator, read from Mailpit.
async function latestSignInCode(request) {
  const list = await (await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${ADMIN_EMAIL} subject:"sign-in code"`)}`)).json()
  expect(list.messages.length).toBeGreaterThan(0)
  const message = await (await request.get(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json()
  const code = /sign-in code is: (\d{6})/.exec(message.Text)?.[1]
  expect(code).toBeTruthy()
  return code
}

test.describe('administrator sign-in code', () => {
  // One administrator, one live code at a time: the tests must not run in parallel with each other.
  test.describe.configure({ mode: 'serial' })

  test('the password alone starts no session', async ({ request }) => {
    const res = await request.post('/api/auth/login', { data: { username: ADMIN, password: SEED_PASSWORD } })
    expect(res.status()).toBe(202)
    const body = await res.json()
    expect(body).toMatchObject({ twoFactorRequired: true, username: ADMIN, maskedEmail: 'a***@taskflow.dev' })
    expect(body.token).toBeUndefined()
    expect(res.headers()['set-cookie']).toBeUndefined()
  })

  test('a wrong code is refused and the right one starts the session', async ({ request }) => {
    await request.post('/api/auth/login', { data: { username: ADMIN, password: SEED_PASSWORD } })
    const code = await latestSignInCode(request)
    const wrong = code === '000000' ? '111111' : '000000'

    const bad = await request.post('/api/auth/login/verify', { data: { username: ADMIN, otp: wrong } })
    expect(bad.status()).toBe(400)

    const good = await request.post('/api/auth/login/verify', { data: { username: ADMIN, otp: code } })
    expect(good.status()).toBe(200)
    expect(await good.json()).toMatchObject({ username: ADMIN, role: 'ADMINISTRATOR' })

    // a code is single-use
    const again = await request.post('/api/auth/login/verify', { data: { username: ADMIN, otp: code } })
    expect(again.status()).toBe(400)
  })

  test('a non-administrator signs in with the password alone', async ({ request }) => {
    const res = await request.post('/api/auth/login', { data: { username: 'dev.chen', password: SEED_PASSWORD } })
    expect(res.status()).toBe(200)
    expect((await res.json()).token).toBeTruthy()
  })

  test('the sign-in page asks for the code, then opens the app', async ({ page, request }) => {
    await page.goto('/login')
    await page.getByLabel(/username or email/i).fill(ADMIN)
    await page.getByLabel(/password/i).fill(SEED_PASSWORD)
    await page.getByRole('button', { name: /^sign in$/i }).click()

    await expect(page.getByRole('heading', { name: /enter your sign-in code/i })).toBeVisible()
    await expect(page.getByText('a***@taskflow.dev')).toBeVisible()
    await expect(page.getByRole('button', { name: /verify and sign in/i })).toBeDisabled()

    await page.getByLabel(/sign-in code/i).fill(await latestSignInCode(request))
    await page.getByRole('button', { name: /verify and sign in/i }).click()
    await page.waitForURL('/')
    await expect(page.getByRole('heading', { name: /hello,/i })).toBeVisible()
  })

  test('Back returns to the password form', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/username or email/i).fill(ADMIN)
    await page.getByLabel(/password/i).fill(SEED_PASSWORD)
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page.getByRole('heading', { name: /enter your sign-in code/i })).toBeVisible()

    await page.getByRole('button', { name: /back to sign in/i }).click()
    await expect(page.getByRole('heading', { name: /^sign in$/i })).toBeVisible()
  })
})
