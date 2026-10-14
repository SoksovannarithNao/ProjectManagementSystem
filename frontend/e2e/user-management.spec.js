import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD, SEED_ADMIN_USERNAME } from './helpers.js'

// Administration > Users (#7, #59): an administrator edits an account, deactivates
// it and deletes it from the screen. Every test creates its own throwaway account
// through the API and deletes it again, so no seeded account is touched.

async function adminHeaders(request) {
  const r = await request.post('/api/auth/login', { data: { username: SEED_ADMIN_USERNAME, password: SEED_PASSWORD } })
  expect(r.ok()).toBeTruthy()
  return { Authorization: `Bearer ${(await r.json()).token}` }
}

async function createAccount(request, headers, suffix) {
  const r = await request.post('/api/users', {
    headers,
    data: {
      fullName: `Temp Person ${suffix}`,
      username: `temp.${suffix}`,
      email: `temp.${suffix}@example.com`,
      password: SEED_PASSWORD,
      accountStatus: 'ACTIVE',
    },
  })
  expect(r.status()).toBe(201)
  return r.json()
}

test.describe('user management screen', () => {
  test('an administrator edits an account, deactivates it, then deletes it', async ({ page, request }) => {
    const headers = await adminHeaders(request)
    const suffix = `${Date.now()}`
    const created = await createAccount(request, headers, suffix)
    try {
      await login(page)
      await page.goto('/admin/users')
      await page.getByPlaceholder('Search users').fill(`temp.${suffix}`)
      await expect(page.getByText(`@temp.${suffix}`)).toBeVisible()

      // edit the name and phone, and set the account Inactive
      await page.getByRole('button', { name: `Edit Temp Person ${suffix}` }).click()
      await page.getByLabel('Full name').fill(`Renamed Person ${suffix}`)
      await page.getByLabel('Phone number').fill('012 345 678')
      await page.getByLabel('Account status').selectOption('INACTIVE')
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(page.getByText(`Renamed Person ${suffix}`).first()).toBeVisible()
      await expect(page.getByText('Inactive')).toBeVisible()

      const saved = await (await request.get(`/api/users/${created.id}`, { headers })).json()
      expect(saved.fullName).toBe(`Renamed Person ${suffix}`)
      expect(saved.phoneNumber).toBe('012 345 678')
      expect(saved.accountStatus).toBe('INACTIVE')

      // an inactive account cannot sign in
      const signIn = await request.post('/api/auth/login', { data: { username: `temp.${suffix}`, password: SEED_PASSWORD } })
      expect(signIn.ok()).toBeFalsy()

      // delete it from the screen
      await page.getByRole('button', { name: `Delete Renamed Person ${suffix}` }).click()
      await page.getByRole('button', { name: 'Delete', exact: true }).click()
      await expect(page.getByText(`@temp.${suffix}`)).toHaveCount(0)
      expect((await request.get(`/api/users/${created.id}`, { headers })).status()).toBe(404)
    } finally {
      await request.delete(`/api/users/${created.id}`, { headers })
    }
  })

  test('an administrator has no delete button on their own row', async ({ page }) => {
    await login(page)
    await page.goto('/admin/users')
    await page.getByPlaceholder('Search users').fill(SEED_ADMIN_USERNAME)
    await expect(page.getByText(`@${SEED_ADMIN_USERNAME}`)).toBeVisible()
    await expect(page.getByRole('button', { name: /^Edit /i })).toHaveCount(1)
    await expect(page.getByRole('button', { name: /^Delete /i })).toHaveCount(0)
  })

  test('the server refuses to delete your own account', async ({ request }) => {
    const headers = await adminHeaders(request)
    const me = await (await request.get(`/api/users/username/${SEED_ADMIN_USERNAME}`, { headers })).json()
    const r = await request.delete(`/api/users/${me.id}`, { headers })
    expect(r.status()).toBe(400)
    expect((await r.json()).message).toBe('You cannot delete your own account')
  })

  test('a Team Member cannot edit or delete accounts', async ({ request }) => {
    const r = await request.post('/api/auth/login', { data: { username: 'dev.chen', password: SEED_PASSWORD } })
    const headers = { Authorization: `Bearer ${(await r.json()).token}` }
    const admin = await (await request.get(`/api/users/username/${SEED_ADMIN_USERNAME}`, { headers: await adminHeaders(request) })).json()
    expect((await request.delete(`/api/users/${admin.id}`, { headers })).status()).toBe(403)
  })
})
