import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD } from './helpers.js'

// Change-plan batch 1: sign-in by e-mail, project/task filters and sorting,
// the Completed / In Review labels, own position & department, unknown API
// paths answering 404.

const apiLogin = async (request, username) => {
  const res = await request.post('/api/auth/login', { data: { username, password: SEED_PASSWORD } })
  expect(res.status()).toBe(200)
  return { Authorization: `Bearer ${(await res.json()).token}` }
}

test.describe('sign-in by username or e-mail', () => {
  test('the login form accepts the e-mail address of an account', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByLabel(/username or email/i)).toBeVisible()
    await page.getByLabel(/username or email/i).fill('admin.system@taskflow.dev')
    await page.getByLabel(/password/i).fill(SEED_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.waitForURL('/')
    await expect(page.getByRole('heading', { name: /hello,/i })).toBeVisible()
  })

  test('the API accepts an e-mail (any letter case) and still refuses a wrong password', async ({ request }) => {
    const ok = await request.post('/api/auth/login', {
      data: { username: 'Admin.System@TaskFlow.dev', password: SEED_PASSWORD },
    })
    expect(ok.status()).toBe(200)
    expect((await ok.json()).username).toBe('admin.system')

    const bad = await request.post('/api/auth/login', {
      data: { username: 'admin.system@taskflow.dev', password: 'not-the-real-password' },
    })
    expect(bad.status()).toBe(401)
  })
})

test('an unknown API path answers 404, not 500', async ({ request }) => {
  const headers = await apiLogin(request, 'admin.system')
  const res = await request.get('/api/definitely-not-an-endpoint', { headers })
  expect(res.status()).toBe(404)
})

test.describe('task status labels', () => {
  test('Kanban columns are To Do / In Progress / In Review / Completed', async ({ page }) => {
    await login(page)
    await page.goto('/kanban')
    for (const title of ['To Do', 'In Progress', 'In Review', 'Completed']) {
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible()
    }
    await expect(page.getByText('Done', { exact: true })).toHaveCount(0)
  })

  test('the Tasks page groups by status with the specification names', async ({ page }) => {
    await login(page)
    await page.goto('/tasks')
    await expect(page.getByText(/^In Progress · \d+$/).first()).toBeVisible()
    await expect(page.getByText(/^Doing/)).toHaveCount(0)
    await expect(page.getByText(/^Done · /)).toHaveCount(0)
  })

  test('the API stores the first status as TODO', async ({ request }) => {
    const headers = await apiLogin(request, 'admin.system')
    const tasks = await (await request.get('/api/tasks', { headers })).json()
    const statuses = new Set(tasks.map((t) => t.status))
    expect(statuses.has('TO_DO')).toBe(false)
    expect(statuses.has('TODO')).toBe(true)
  })
})

test.describe('project filters and sorting', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/projects')
    await expect(page.locator('a[href^="/projects/"]').first()).toBeVisible()
  })

  test('filter by priority narrows the cards and Clear brings them back', async ({ page }) => {
    const cards = page.locator('a[href^="/projects/"]')
    const total = await cards.count()

    await page.getByRole('button', { name: /^Filter/ }).click()
    await page.getByLabel('Critical').check()
    await page.keyboard.press('Escape')

    await expect(page.getByRole('button', { name: /^Filter \(1\)/ })).toBeVisible()
    const filtered = await cards.count()
    expect(filtered).toBeLessThan(total)
    for (const text of await cards.allInnerTexts()) expect(text).toMatch(/critical/i)

    await page.getByRole('button', { name: /^Filter/ }).click()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(cards).toHaveCount(total)
  })

  test('filter by status and by project manager combine (AND)', async ({ page }) => {
    const cards = page.locator('a[href^="/projects/"]')
    const total = await cards.count()
    await page.getByRole('button', { name: /^Filter/ }).click()
    await page.getByLabel('Active', { exact: true }).check()
    const manager = page.getByLabel('Project manager')
    const optionCount = await manager.locator('option').count()
    expect(optionCount).toBeGreaterThan(2)
    await manager.selectOption({ index: 1 })
    await page.keyboard.press('Escape')

    await expect(page.getByRole('button', { name: /^Filter \(2\)/ })).toBeVisible()
    expect(await cards.count()).toBeLessThan(total)
  })

  test('sort by name puts the cards in alphabetical order', async ({ page }) => {
    await page.getByRole('button', { name: /^Sort/ }).click()
    await page.getByRole('button', { name: /^Name/ }).click()
    const names = await page.locator('a[href^="/projects/"] h3').allInnerTexts()
    expect(names.length).toBeGreaterThan(1)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })

  test('search also matches the project manager', async ({ page }) => {
    const cards = page.locator('a[href^="/projects/"]')
    const total = await cards.count()
    await page.getByPlaceholder('Search projects').fill('Olivia Bennett')
    await expect.poll(async () => cards.count()).toBeLessThan(total)
    expect(await cards.count()).toBeGreaterThan(0)
  })
})

test.describe('task filters', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/tasks')
    await expect(page.getByTestId('task-row').first()).toBeVisible()
  })

  test('filter by status shows only that status', async ({ page }) => {
    const rows = page.getByTestId('task-row')
    const total = await rows.count()
    await page.getByRole('button', { name: /^Filter/ }).click()
    await page.getByLabel('In Review', { exact: true }).check()
    await page.keyboard.press('Escape')

    await expect(page.getByText(/^In Review · \d+$/).first()).toBeVisible()
    await expect(page.getByText(/^To Do · \d+$/)).toHaveCount(0)
    await expect(page.getByText(/^In Progress · \d+$/)).toHaveCount(0)
    expect(await rows.count()).toBeLessThan(total)
  })

  test('filter by assignee and by due date combine', async ({ page }) => {
    const rows = page.getByTestId('task-row')
    const total = await rows.count()
    await page.getByRole('button', { name: /^Filter/ }).click()
    await page.getByLabel('Assignee').selectOption({ index: 2 })
    await expect(page.getByRole('button', { name: /^Filter \(1\)/ })).toBeVisible()
    const byAssignee = await rows.count()
    expect(byAssignee).toBeLessThan(total)

    await page.getByLabel('Due date').selectOption('overdue')
    await expect(page.getByRole('button', { name: /^Filter \(2\)/ })).toBeVisible()
    expect(await rows.count()).toBeLessThanOrEqual(byAssignee)

    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(rows).toHaveCount(total)
  })
})

test.describe('own position and department', () => {
  test('a user can pick them from the managed lists on the Profile page', async ({ page, request }) => {
    const username = 'dev.mia'
    await login(page, username)
    await page.goto('/profile')

    const position = page.getByLabel('Position')
    const department = page.getByLabel('Department')
    await expect(position).toBeVisible()
    await expect.poll(() => position.locator('option').count()).toBeGreaterThan(2)
    await expect.poll(() => department.locator('option').count()).toBeGreaterThan(2)
    // No "+ Add New": only an administrator creates list entries.
    await expect(position.locator('option', { hasText: 'Add New' })).toHaveCount(0)

    const headers = await apiLogin(request, username)
    const before = await (await request.get(`/api/users/username/${username}`, { headers })).json()
    const optionValues = async (select) => select.locator('option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean))
    const pick = async (select, current) => (await optionValues(select)).find((v) => v !== String(current))

    const nextPosition = await pick(position, before.positionId)
    const nextDepartment = await pick(department, before.departmentId)
    try {
      await position.selectOption(nextPosition)
      await department.selectOption(nextDepartment)
      await page.getByRole('button', { name: 'Save Changes' }).click()
      await expect(page.getByText('Profile updated')).toBeVisible()

      const after = await (await request.get(`/api/users/username/${username}`, { headers })).json()
      expect(String(after.positionId)).toBe(nextPosition)
      expect(String(after.departmentId)).toBe(nextDepartment)
    } finally {
      // Put the seeded values back so the suite can run again.
      await request.put('/api/users/me', {
        headers,
        data: {
          fullName: before.fullName,
          email: before.email,
          gender: before.gender,
          dateOfBirth: before.dateOfBirth,
          phoneNumber: before.phoneNumber,
          positionId: before.positionId,
          departmentId: before.departmentId,
        },
      })
    }
  })

  test('an id outside the managed list is refused', async ({ request }) => {
    const headers = await apiLogin(request, 'dev.mia')
    const me = await (await request.get('/api/users/username/dev.mia', { headers })).json()
    const res = await request.put('/api/users/me', {
      headers,
      data: { fullName: me.fullName, email: me.email, positionId: 999999 },
    })
    expect(res.status()).toBe(404)
  })
})
