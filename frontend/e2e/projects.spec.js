import { test, expect } from '@playwright/test'
import { login } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await login(page)
})

test('lists projects as clickable cards with real data', async ({ page }) => {
  await page.goto('/projects')
  const cards = page.locator('a[href^="/projects/"]')
  await expect(cards.first()).toBeVisible()
  await expect(cards.first()).toContainText('%') // progress
})

test('opening a project card navigates to its detail page', async ({ page }) => {
  await page.goto('/projects')
  const firstCard = page.locator('a[href^="/projects/"]').first()
  const name = await firstCard.locator('h3').innerText()
  await firstCard.click()

  await expect(page).toHaveURL(/\/projects\/\d+$/)
  await expect(page.getByRole('heading', { name })).toBeVisible()
  // A role query, not getByText: the sidebar's "Tasks" nav link would also
  // match a bare text selector, and only this section heading is meant here.
  await expect(page.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible()
  await expect(page.getByText(/^Members/)).toBeVisible()
  await expect(page.getByText(/^Milestones/)).toBeVisible()
})

test('clicking a task inside a project opens its detail panel', async ({ page }) => {
  await page.goto('/projects')
  await page.locator('a[href^="/projects/"]', { hasText: 'Website Redesign' }).click()
  await expect(page).toHaveURL(/\/projects\/\d+$/)

  await page.getByTestId('task-row').first().click()

  await expect(page.getByText('Task', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Subtasks', exact: true })).toBeVisible()
})

// A person who has just created a project is its Owner at once: the project's page offers the
// Owner's controls (Add member ...) without signing in again or reloading. The permission list
// is read at sign-in, so creating a project has to read it again.
test('a Project Manager sees Add member on the project they have just created, without a reload', async ({ page, request }) => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const name = `owner rights ${stamp}`
  await login(page, 'pm.olivia')
  await page.goto('/projects')
  try {
    await page.getByRole('button', { name: 'New Project' }).click()
    const form = page.locator('#new-project-form')
    await form.locator('input[type="text"]').first().fill(name)
    const dates = form.locator('input[type="date"]')
    await dates.nth(0).fill('2026-10-01')
    await dates.nth(1).fill('2026-12-31')
    await page.getByRole('button', { name: 'Create Project' }).click()

    await page.locator('a[href^="/projects/"]', { hasText: name }).click()
    await expect(page).toHaveURL(/\/projects\/\d+$/)
    await expect(page.getByRole('heading', { name })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add member' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible()
  } finally {
    const admin = await request.post('/api/auth/login', { data: { username: 'admin.system', password: 'DevPassword123!' } })
    const headers = { Authorization: `Bearer ${(await admin.json()).token}` }
    const list = await (await request.get('/api/projects', { headers })).json()
    for (const p of list.filter((x) => x.name === name)) await request.delete(`/api/projects/${p.id}`, { headers })
  }
})

// A project with many tasks does not make the page endless: the task list scrolls inside its card.
test('the task list on a project page scrolls inside its card instead of growing the page', async ({ page }) => {
  await page.goto('/projects')
  await page.locator('a[href^="/projects/"]', { hasText: 'Website Redesign' }).click()
  const list = page.getByTestId('project-task-list')
  await expect(list).toBeVisible()
  await expect
    .poll(() => list.evaluate((el) => ({ scrolls: el.scrollHeight > el.clientHeight, height: el.clientHeight })))
    .toEqual({ scrolls: true, height: 440 })
})

// The Members and Milestones cards sit side by side and are always the same size, whatever each holds.
test('the Members and Milestones cards on a project page are the same size', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/projects')
  await page.locator('a[href^="/projects/"]', { hasText: 'Website Redesign' }).click()
  const members = page.getByTestId('project-members-card')
  const milestones = page.getByTestId('project-milestones-card')
  await expect(members).toBeVisible()
  await expect(milestones).toBeVisible()
  const [m, ms] = [await members.boundingBox(), await milestones.boundingBox()]
  expect(Math.round(m.width)).toBe(Math.round(ms.width))
  expect(Math.round(m.height)).toBe(Math.round(ms.height))
  expect(Math.round(m.y)).toBe(Math.round(ms.y))
})

// The status, priority, Delayed and overdue pills in a project's Overview are one size, on a wide screen and on a phone.
test('the status, priority, delayed and overdue pills on a project page are the same size', async ({ page, request }) => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const login1 = await request.post('/api/auth/login', { data: { username: 'pm.olivia', password: 'DevPassword123!' } })
  const headers = { Authorization: `Bearer ${(await login1.json()).token}` }
  // an unfinished project whose end date has passed (so it is Delayed) with a task that is overdue
  const project = await (
    await request.post('/api/projects', {
      headers,
      data: { name: `pills ${stamp}`, priority: 'HIGH', status: 'IN_PROGRESS', startDate: '2026-01-01', endDate: '2026-02-01' },
    })
  ).json()
  try {
    await request.post('/api/tasks', {
      headers,
      data: { projectId: project.id, title: `late ${stamp}`, priority: 'LOW', status: 'TODO', startDate: '2026-01-05', dueDate: '2026-01-20' },
    })
    await login(page, 'pm.olivia')
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      await page.setViewportSize({ width, height })
      await page.goto(`/projects/${project.id}`)
      await expect(page.getByTestId('delayed-badge')).toBeVisible()
      const row = page.getByLabel('Project status').locator('xpath=..')
      const boxes = await row.locator('xpath=./*').evaluateAll((els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect()
          return { text: (e.textContent || '').trim().slice(0, 20), h: Math.round(r.height), gap: e.ownerDocument.defaultView.getComputedStyle(e).columnGap }
        })
      )
      expect(boxes.length).toBeGreaterThanOrEqual(4) // status, priority, Delayed, overdue
      expect(new Set(boxes.map((b) => b.h)).size, JSON.stringify(boxes)).toBe(1)
      expect(new Set(boxes.map((b) => b.gap)).size, JSON.stringify(boxes)).toBe(1)
    }
  } finally {
    await request.delete(`/api/projects/${project.id}`, { headers })
  }
})
