import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD, SEED_ADMIN_USERNAME } from './helpers.js'

// Checklist risk R-5, the Dashboard: the activity chart's daily figures come from
// GET /api/dashboard/task-activity and the "Due & Overdue" card from a short page of tasks, so the page
// no longer reads every task or every assignment.

const apiLogin = async (request, username) => {
  const res = await request.post('/api/auth/login', { data: { username, password: SEED_PASSWORD } })
  expect(res.status()).toBe(200)
  return { Authorization: `Bearer ${(await res.json()).token}` }
}
const getJson = async (request, headers, path, params = {}) => {
  const res = await request.get(path, { headers, params })
  expect(res.status(), path).toBe(200)
  return res.json()
}
// The specs share one database and run side by side, so a figure read a moment ago can already be stale
// when another spec creates or finishes a task. Poll until the two agree.
const agree = (counted, expected) =>
  expect.poll(async () => JSON.stringify(await counted()) === JSON.stringify(await expected())).toBe(true)
const utcDay = (iso) => iso.slice(0, 10) // the zone is asked for as UTC, so the day is the UTC date

test.describe('dashboard activity: API', () => {
  test('one row per day, oldest first, ending today, with created and completed counts that match the tasks', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const days = 30
    const rows = await getJson(request, admin, '/api/dashboard/task-activity', { days, zone: 'UTC' })
    expect(rows).toHaveLength(days)
    expect(Object.keys(rows[0]).sort()).toEqual(['completed', 'created', 'date', 'overdue'])
    const dates = rows.map((r) => r.date)
    expect(dates).toEqual([...dates].sort())
    expect(new Set(dates).size).toBe(days)
    expect(dates.at(-1)).toBe(new Date().toISOString().slice(0, 10))

    const expected = async () => {
      const tasks = await getJson(request, admin, '/api/tasks')
      const first = dates[0]
      const last = dates.at(-1)
      const inWindow = (iso) => iso && utcDay(iso) >= first && utcDay(iso) <= last
      return {
        created: tasks.filter((t) => inWindow(t.createdAt)).length,
        completed: tasks.filter((t) => inWindow(t.completedAt)).length,
      }
    }
    await agree(
      async () => {
        const fresh = await getJson(request, admin, '/api/dashboard/task-activity', { days, zone: 'UTC' })
        return { created: fresh.reduce((n, r) => n + r.created, 0), completed: fresh.reduce((n, r) => n + r.completed, 0) }
      },
      expected
    )
  })

  test('the overdue figure for today equals the dashboard statistics', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    await agree(
      async () => (await getJson(request, admin, '/api/dashboard/task-activity', { days: 7, zone: 'UTC' })).at(-1).overdue,
      async () => (await getJson(request, admin, '/api/dashboard/stats')).tasks.overdue
    )
  })

  test('a member sees only their projects, and one project can be asked for', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const chen = await apiLogin(request, 'dev.chen')
    const total = async (headers, params = {}) =>
      (await getJson(request, headers, '/api/dashboard/task-activity', { days: 366, zone: 'UTC', ...params })).reduce((n, r) => n + r.created, 0)
    expect(await total(chen)).toBeLessThan(await total(admin))

    const chenProjects = await getJson(request, chen, '/api/projects')
    const one = chenProjects[0].id
    expect(await total(chen, { projectId: one })).toBeLessThanOrEqual(await total(chen))
    // a project the caller is not in is a 404, as everywhere
    const all = await getJson(request, admin, '/api/projects')
    const mine = new Set(chenProjects.map((p) => p.id))
    const foreign = all.find((p) => !mine.has(p.id))
    expect((await request.get('/api/dashboard/task-activity', { headers: chen, params: { projectId: foreign.id } })).status()).toBe(404)
  })

  test('a window outside 1 to 366 days, or a zone that does not exist, is a 400', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    for (const params of [{ days: 0 }, { days: 367 }, { days: 'many' }, { days: 7, zone: 'Mars/Olympus' }]) {
      expect((await request.get('/api/dashboard/task-activity', { headers: admin, params })).status(), JSON.stringify(params)).toBe(400)
    }
  })

  test('the due-soon list: open tasks with a due date, earliest first, each with its assignees', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const page = await getJson(request, admin, '/api/tasks', {
      status: ['TODO', 'IN_PROGRESS', 'IN_REVIEW'], dueFrom: '1970-01-01', sort: 'dueDate', page: 0, size: 7,
    })
    expect(page.items.length).toBeGreaterThan(0)
    expect(page.items.length).toBeLessThanOrEqual(7)
    expect(page.items.every((t) => t.dueDate && ['TODO', 'IN_PROGRESS', 'IN_REVIEW'].includes(t.status))).toBe(true)
    const dues = page.items.map((t) => t.dueDate)
    expect(dues).toEqual([...dues].sort())
    expect(page.items.every((t) => Array.isArray(t.assigneeIds))).toBe(true)
  })
})

test.describe('dashboard activity: the page', () => {
  test('reads the daily figures from the server, again for another period, and never every task', async ({ page }) => {
    const taskReads = []
    const activityReads = []
    const assignmentReads = []
    page.on('request', (r) => {
      const url = new URL(r.url())
      if (r.method() !== 'GET') return
      if (url.pathname === '/api/tasks') taskReads.push(url.search)
      if (url.pathname === '/api/dashboard/task-activity') activityReads.push(url.searchParams)
      if (url.pathname === '/api/task-assignees') assignmentReads.push(url.search)
    })
    await login(page)
    await expect(page.getByTestId('dashboard-stats')).toBeVisible()
    await expect.poll(() => activityReads.length).toBeGreaterThan(0)
    expect(activityReads[0].get('days')).toBe('7')
    expect(activityReads[0].get('zone')).toBeTruthy()

    await page.getByRole('button', { name: /This Week/ }).click()
    await page.getByRole('button', { name: 'This Month' }).click()
    await expect.poll(() => activityReads.some((p) => p.get('days') === '30')).toBe(true)

    await expect(page.getByText('Due & Overdue')).toBeVisible()
    await page.waitForLoadState('networkidle')
    // the only task read is the short page for "Due & Overdue", and nothing reads the whole assignment list
    expect(taskReads.length).toBeGreaterThan(0)
    expect(taskReads.every((q) => q.includes('size=7') && q.includes('sort=dueDate'))).toBe(true)
    expect(assignmentReads).toEqual([])
  })
})
