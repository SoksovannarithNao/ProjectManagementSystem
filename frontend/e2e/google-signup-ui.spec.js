import { test, expect } from '@playwright/test'
import { login } from './helpers.js'

// The screens of "Sign in with Google" that follow Google's button: the username step of a new account, the
// same step on the Register page, and "Set a password" on Profile. A real Google account cannot be driven here, so
// Google's script is replaced by a stub whose button hands a fake token to the page, and the Google endpoints of
// the API are answered by the test. Everything else (sign-in, the profile, the dashboard) is the real stack.

const GSI_STUB = `window.google = { accounts: { id: {
  initialize(options) { window.__gsiCallback = options.callback },
  renderButton(element) {
    element.innerHTML = '<button type="button" data-testid="gsi-stub">Continue with Google</button>'
    element.firstChild.onclick = () => window.__gsiCallback({ credential: 'stub-token' })
  },
} } }`

async function stubGoogle(page) {
  await page.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: GSI_STUB })
  )
  await page.route('**/api/auth/google/config', (route) => route.fulfill({ json: { clientId: 'stub.apps.googleusercontent.com' } }))
}

const SIGNUP_OFFER = { signupRequired: true, email: 'sam.lee@gmail.com', name: 'Sam Lee' }

async function realSession(request, username) {
  const response = await request.post('/api/auth/login', { data: { username, password: 'DevPassword123!' } })
  expect(response.status()).toBe(200)
  return response.json()
}

test.describe('Google sign-up screens (stubbed Google and Google API)', () => {
  test('a new Google account chooses a username, a taken one is refused, then the account signs in', async ({ page, request }) => {
    const session = await realSession(request, 'pm.olivia')
    await stubGoogle(page)
    await page.route('**/api/auth/google', (route) => route.fulfill({ json: SIGNUP_OFFER }))
    let attempts = 0
    await page.route('**/api/auth/google/register', (route) => {
      attempts += 1
      const body = route.request().postDataJSON()
      expect(body).toEqual({ credential: 'stub-token', username: expect.any(String) })
      return attempts === 1
        ? route.fulfill({ status: 400, json: { status: 400, error: 'Bad Request', message: 'Username is already taken' } })
        : route.fulfill({ status: 201, json: session })
    })

    await page.goto('/login')
    await page.getByTestId('gsi-stub').click()

    await expect(page.getByRole('heading', { name: 'Choose a username' })).toBeVisible()
    await expect(page.getByTestId('google-signup-form')).toContainText('sam.lee@gmail.com')
    await expect(page.getByRole('button', { name: 'Create account' })).toBeDisabled()

    await page.getByLabel('Username').fill('pm.olivia')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('alert')).toHaveText('Username is already taken')
    await expect(page.getByRole('heading', { name: 'Choose a username' })).toBeVisible()

    await page.getByLabel('Username').fill('sam.lee')
    await page.getByRole('button', { name: 'Create account' }).click()
    await page.waitForURL('/')
    expect(attempts).toBe(2)
  })

  test('cancelling the username step goes back to the sign-in form', async ({ page }) => {
    await stubGoogle(page)
    await page.route('**/api/auth/google', (route) => route.fulfill({ json: SIGNUP_OFFER }))

    await page.goto('/login')
    await page.getByTestId('gsi-stub').click()
    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
  })

  test('an e-mail an account already uses is refused with the way forward, and nothing is offered', async ({ page }) => {
    await stubGoogle(page)
    await page.route('**/api/auth/google', (route) =>
      route.fulfill({
        status: 400,
        json: {
          status: 400,
          error: 'Bad Request',
          message: 'An account with this e-mail address already exists. Sign in with your password, then connect Google on your Profile page.',
        },
      })
    )

    await page.goto('/login')
    await page.getByTestId('gsi-stub').click()

    await expect(page.getByRole('alert')).toContainText('already exists')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await expect(page.getByTestId('google-signup-form')).toHaveCount(0)
  })

  test('the Create Account page offers Google too, and reaches the same username step', async ({ page }) => {
    await stubGoogle(page)
    await page.route('**/api/auth/google', (route) => route.fulfill({ json: SIGNUP_OFFER }))

    await page.goto('/register')
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible()
    await page.getByTestId('gsi-stub').click()

    await expect(page.getByRole('heading', { name: 'Choose a username' })).toBeVisible()
    await expect(page.getByTestId('google-signup-form')).toContainText('sam.lee@gmail.com')
  })

  test('with no client ID neither page shows a Google button', async ({ page }) => {
    await page.route('**/api/auth/google/config', (route) => route.fulfill({ json: { clientId: null } }))

    await page.goto('/login')
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible()
    await expect(page.getByTestId('google-button')).toHaveCount(0)
    await page.goto('/register')
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible()
    await expect(page.getByTestId('google-button')).toHaveCount(0)
  })

  test('an account Google created sets its first password on Profile, and keeps its Google connection until then', async ({ page }) => {
    await login(page, 'pm.olivia')
    await stubGoogle(page)
    await page.route('**/api/users/username/pm.olivia', async (route) => {
      const response = await route.fetch()
      await route.fulfill({ response, json: { ...(await response.json()), passwordSet: false } })
    })
    await page.route('**/api/users/me/google', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ json: { enabled: true, linked: true, email: 'olivia@gmail.com' } })
        : route.continue()
    )
    const sent = []
    await page.route('**/api/users/me/google/password', (route) => {
      sent.push(route.request().postDataJSON())
      return route.fulfill({ status: 204, body: '' })
    })

    await page.goto('/profile')
    const setPassword = page.getByTestId('set-password-section')
    await expect(setPassword).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Password', exact: true })).toHaveCount(0)
    await expect(page.getByTestId('google-section').getByRole('button', { name: 'Disconnect' })).toBeDisabled()
    await expect(page.getByTestId('google-section')).toContainText('Set a password first')

    // a weak password is refused in the page, before anything is sent
    await setPassword.getByLabel('New password', { exact: true }).fill('weak')
    await setPassword.getByLabel('Confirm new password').fill('weak')
    await setPassword.getByTestId('gsi-stub').click()
    await expect(setPassword.getByRole('alert')).toBeVisible()
    expect(sent).toHaveLength(0)

    await setPassword.getByLabel('New password', { exact: true }).fill('NewPassword123!')
    await setPassword.getByLabel('Confirm new password').fill('NewPassword123!')
    await setPassword.getByTestId('gsi-stub').click()
    await expect.poll(() => sent.length).toBe(1)
    expect(sent[0]).toEqual({ credential: 'stub-token', newPassword: 'NewPassword123!', confirmNewPassword: 'NewPassword123!' })
  })
})
