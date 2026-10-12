import { test, expect } from '@playwright/test'

// Self-registration with an emailed one-time code (ADR 0008). The backend sends the
// code to Mailpit, the local mail catcher, so the test reads it from there like a user
// would read their inbox.
const MAILPIT = process.env.E2E_MAILPIT_URL || `http://localhost:${process.env.MAILPIT_UI_PORT || 8025}`

async function otpFor(request, email) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const found = await (await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json()
    if (found.messages?.length) {
      const message = await (await request.get(`${MAILPIT}/api/v1/message/${found.messages[0].ID}`)).json()
      const code = /\b(\d{6})\b/.exec(message.Text)
      if (code) return code[1]
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`No verification email arrived for ${email}`)
}

async function fillRegistration(page, { username, email, password, confirmPassword = password }) {
  await page.goto('/register')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Email').fill(email)
  // The first password label also wraps the live requirements checklist, so a label
  // lookup is ambiguous; the two new-password inputs are the password and its confirmation.
  const passwordFields = page.locator('input[autocomplete="new-password"]')
  await passwordFields.nth(0).fill(password)
  await passwordFields.nth(1).fill(confirmPassword)
  await page.getByRole('button', { name: 'Create Account' }).click()
}

const unique = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`

test.describe('Registration', () => {
  test('a new person registers, verifies the emailed code and signs in', async ({ page, request }) => {
    const id = unique()
    const account = { username: `new.${id}`, email: `new.${id}@example.test`, password: 'Sup3rSecret!pw' }

    await fillRegistration(page, account)
    await expect(page.getByRole('heading', { name: 'Verify Your Email' })).toBeVisible()
    await expect(page.getByText(account.email)).toBeVisible()

    await page.getByLabel('OTP').fill(await otpFor(request, account.email))
    await page.getByRole('button', { name: 'Verify' }).click()
    await expect(page.getByRole('heading', { name: 'Account verified' })).toBeVisible()

    await page.getByRole('link', { name: 'Continue to Sign In' }).click()
    await page.getByLabel(/username/i).fill(account.username)
    await page.getByLabel(/password/i).fill(account.password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('/')
    await expect(page.getByRole('heading', { name: /hello,/i })).toBeVisible()
  })

  test('a wrong code is refused and the account stays unverified', async ({ page }) => {
    const id = unique()
    await fillRegistration(page, { username: `wrong.${id}`, email: `wrong.${id}@example.test`, password: 'Sup3rSecret!pw' })
    await expect(page.getByRole('heading', { name: 'Verify Your Email' })).toBeVisible()

    await page.getByLabel('OTP').fill('000000')
    await page.getByRole('button', { name: 'Verify' }).click()

    await expect(page.getByRole('heading', { name: 'Account verified' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Verify Your Email' })).toBeVisible()
    await expect(page.locator('p.text-danger-ink')).toBeVisible()
  })

  test('an unverified account cannot sign in yet', async ({ page }) => {
    const id = unique()
    const password = 'Sup3rSecret!pw'
    await fillRegistration(page, { username: `pending.${id}`, email: `pending.${id}@example.test`, password })
    await expect(page.getByRole('heading', { name: 'Verify Your Email' })).toBeVisible()

    await page.goto('/login')
    await page.getByLabel(/username/i).fill(`pending.${id}`)
    await page.getByLabel(/password/i).fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByText(/verif|invalid|not active|incorrect/i).first()).toBeVisible()
  })

  test('a password that is too weak, or does not match, is refused', async ({ page }) => {
    const id = unique()
    await fillRegistration(page, { username: `weak.${id}`, email: `weak.${id}@example.test`, password: 'password' })
    await expect(page).toHaveURL(/\/register/)
    await expect(page.locator('p.text-danger-ink')).toBeVisible()

    await fillRegistration(page, {
      username: `mismatch.${id}`,
      email: `mismatch.${id}@example.test`,
      password: 'Sup3rSecret!pw',
      confirmPassword: 'Different1!pw',
    })
    await expect(page).toHaveURL(/\/register/)
    await expect(page.locator('p.text-danger-ink')).toBeVisible()
  })

  test('a username that is already taken is refused', async ({ page }) => {
    const id = unique()
    await fillRegistration(page, { username: 'admin.system', email: `dup.${id}@example.test`, password: 'Sup3rSecret!pw' })
    await expect(page).toHaveURL(/\/register/)
    await expect(page.locator('p.text-danger-ink')).toBeVisible()
  })
})
