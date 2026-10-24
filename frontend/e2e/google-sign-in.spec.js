import { test, expect } from '@playwright/test'
import { SEED_ADMIN_USERNAME, SEED_PASSWORD } from './helpers.js'

// "Sign in with Google" cannot be driven end to end here (a real Google account is needed), so this checks
// what can be checked against any stack: the server tells the sign-in page whether the feature is on, the
// button is shown only then, and every Google endpoint refuses what it should. The default stack has no
// GOOGLE_CLIENT_ID, which is the "off" half; started with one, the "on" half runs instead.

async function clientIdOf(request) {
  const response = await request.get('/api/auth/google/config')
  expect(response.status()).toBe(200)
  return (await response.json()).clientId
}

async function adminToken(request) {
  const response = await request.post('/api/auth/login', { data: { username: SEED_ADMIN_USERNAME, password: SEED_PASSWORD } })
  expect(response.status()).toBe(200)
  return (await response.json()).token
}

test('the sign-in page shows the Google button only when the server has a client ID', async ({ page, request }) => {
  const clientId = await clientIdOf(request)
  await page.goto('/login')
  await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible()
  if (clientId) {
    await expect(page.getByTestId('google-button')).toBeAttached()
  } else {
    await expect(page.getByTestId('google-button')).toHaveCount(0)
  }
})

test('a Google sign-in with a token that is not good is refused and starts no session', async ({ request }) => {
  const clientId = await clientIdOf(request)
  const response = await request.post('/api/auth/google', { data: { credential: 'not-a-google-token' } })

  expect(response.status()).toBe(clientId ? 400 : 404)
  expect(response.headers()['set-cookie']).toBeUndefined()
})

test('a Google sign-in without a token is a validation error', async ({ request }) => {
  const response = await request.post('/api/auth/google', { data: {} })

  expect(response.status()).toBe(400)
})

test('creating an account from Google needs a good token and a valid username, and starts no session', async ({ request }) => {
  const clientId = await clientIdOf(request)

  const badToken = await request.post('/api/auth/google/register', { data: { credential: 'not-a-google-token', username: 'google.tester' } })
  expect(badToken.status()).toBe(clientId ? 400 : 404)
  expect(badToken.headers()['set-cookie']).toBeUndefined()

  for (const username of ['ab', 'has space', 'a@b.com']) {
    const response = await request.post('/api/auth/google/register', { data: { credential: 'not-a-google-token', username } })
    expect(response.status()).toBe(400)
  }
})

test('every existing account has a password, and the first-password endpoint refuses it', async ({ request }) => {
  const headers = { Authorization: `Bearer ${await adminToken(request)}` }

  const profile = await request.get(`/api/users/username/${SEED_ADMIN_USERNAME}`, { headers })
  expect((await profile.json()).passwordSet).toBe(true)

  const unauthenticated = await request.post('/api/users/me/google/password', {
    data: { credential: 'x', newPassword: 'Password123!', confirmNewPassword: 'Password123!' },
  })
  expect(unauthenticated.status()).toBe(401)

  const weak = await request.post('/api/users/me/google/password', {
    headers,
    data: { credential: 'x', newPassword: 'weak', confirmNewPassword: 'weak' },
  })
  expect(weak.status()).toBe(400)

  const alreadySet = await request.post('/api/users/me/google/password', {
    headers,
    data: { credential: 'x', newPassword: 'Password123!', confirmNewPassword: 'Password123!' },
  })
  expect(alreadySet.status()).toBe(400)
  expect((await alreadySet.json()).message).toContain('already has a password')
})

test('connecting a Google account needs a signed-in user, the password and a good token', async ({ request }) => {
  const clientId = await clientIdOf(request)

  expect((await request.get('/api/users/me/google')).status()).toBe(401)
  expect((await request.post('/api/users/me/google', { data: { credential: 'x', currentPassword: 'y' } })).status()).toBe(401)

  const headers = { Authorization: `Bearer ${await adminToken(request)}` }
  const status = await request.get('/api/users/me/google', { headers })
  expect(status.status()).toBe(200)
  const body = await status.json()
  expect(body.enabled).toBe(Boolean(clientId))
  expect(typeof body.linked).toBe('boolean') // true when someone really connected Google to this account

  const wrongPassword = await request.post('/api/users/me/google', {
    headers,
    data: { credential: 'not-a-google-token', currentPassword: 'not-the-password' },
  })
  expect(wrongPassword.status()).toBe(400)
  expect((await wrongPassword.json()).message).toBe('Current password is incorrect')

  const badToken = await request.post('/api/users/me/google', {
    headers,
    data: { credential: 'not-a-google-token', currentPassword: SEED_PASSWORD },
  })
  expect(badToken.status()).toBe(clientId ? 400 : 404)
})
