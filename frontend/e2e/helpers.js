// Every seeded user (database/init/02-seed.sql) shares this bcrypt hash —
// plaintext "DevPassword123!", development/test credentials only, never a
// real secret. `admin.system` is the one seeded system ADMINISTRATOR.
export const SEED_PASSWORD = 'DevPassword123!'
export const SEED_ADMIN_USERNAME = 'admin.system'

export async function login(page, username = SEED_ADMIN_USERNAME, password = SEED_PASSWORD) {
  await page.goto('/login')
  await page.getByLabel(/username/i).fill(username)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await page.waitForURL('/')
}
