import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD, SEED_ADMIN_USERNAME } from './helpers.js'

// Checklist risk R-5, the Calendar and Projects pages: the Calendar reads only the tasks and milestones
// due in the days on screen (dueFrom / dueTo), and the project cards read their task counts from
// GET /api/tasks/project-stats. Neither page reads every task any more.

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
const isoDay = (offsetDays) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
// The specs share one database and run side by side, so a count read a moment ago can already be
// stale when another spec creates or deletes a task. Poll until the two agree.
const agree = (counted, expected) =>
  expect.poll(async () => JSON.stringify(await counted()) === JSON.stringify(await expected())).toBe(true)

test.describe('calendar window and project counts: API', () => {
  test('tasks due in a window: both days included, undated ones left out, bad dates are 400', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const all = await getJson(request, admin, '/api/tasks')
    const dated = all.filter((t) => t.dueDate).map((t) => t.dueDate).sort()
    expect(dated.length).toBeGreaterThan(10)
    const from = dated[Math.floor(dated.length / 3)]
    const to = dated[Math.floor((2 * dated.length) / 3)]

    const window = await getJson(request, admin, '/api/tasks', { dueFrom: from, dueTo: to })
    expect(window.length).toBeGreaterThan(0)
    expect(window.every((t) => t.dueDate >= from && t.dueDate <= to)).toBe(true)
    // the same as filtering the whole list by hand (boundary days included)
    await agree(
      async () => (await getJson(request, admin, '/api/tasks', { dueFrom: from, dueTo: to })).map((t) => t.id).sort((a, b) => a - b),
      async () => (await getJson(request, admin, '/api/tasks')).filter((t) => t.dueDate && t.dueDate >= from && t.dueDate <= to).map((t) => t.id).sort((a, b) => a - b)
    )
    // a one-day window, and open ends
    const oneDay = await getJson(request, admin, '/api/tasks', { dueFrom: from, dueTo: from })
    expect(oneDay.every((t) => t.dueDate === from)).toBe(true)
    expect((await getJson(request, admin, '/api/tasks', { dueFrom: to })).every((t) => t.dueDate >= to)).toBe(true)
    expect((await getJson(request, admin, '/api/tasks', { dueTo: from })).every((t) => t.dueDate && t.dueDate <= from)).toBe(true)

    for (const params of [{ dueFrom: 'soon' }, { dueTo: '2026-13-45' }, { dueFrom: to, dueTo: from }]) {
      expect((await request.get('/api/tasks', { headers: admin, params })).status(), JSON.stringify(params)).toBe(400)
    }
  })

  test('milestones due in a window, and a member sees only their projects', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const chen = await apiLogin(request, 'dev.chen')
    const all = await getJson(request, admin, '/api/milestones')
    const dated = all.filter((m) => m.dueDate).map((m) => m.dueDate).sort()
    expect(dated.length).toBeGreaterThan(3)
    const from = dated[1]
    const to = dated[dated.length - 2]

    const window = await getJson(request, admin, '/api/milestones', { dueFrom: from, dueTo: to })
    expect(window.every((m) => m.dueDate >= from && m.dueDate <= to)).toBe(true)
    expect(window.length).toBeLessThan(all.length)
    const hisWindow = await getJson(request, chen, '/api/milestones', { dueFrom: from, dueTo: to })
    const hisAll = await getJson(request, chen, '/api/milestones')
    expect(hisAll.length).toBeLessThan(all.length)
    expect(hisWindow.every((m) => hisAll.some((h) => h.id === m.id))).toBe(true)
    expect((await request.get('/api/milestones', { headers: admin, params: { dueFrom: to, dueTo: from } })).status()).toBe(400)
    expect((await request.get('/api/milestones', { headers: admin, params: { dueFrom: 'soon' } })).status()).toBe(400)
  })

  test('project-stats: counts per project (cancelled left out), and only the projects the caller is in', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const chen = await apiLogin(request, 'dev.chen')
    const expected = async (headers) => {
      const tasks = await getJson(request, headers, '/api/tasks')
      const byProject = new Map()
      for (const t of tasks) {
        const e = byProject.get(t.project.id) ?? { projectId: t.project.id, total: 0, completed: 0, overdue: 0 }
        if (t.status !== 'CANCELLED') e.total += 1
        if (t.status === 'COMPLETED') e.completed += 1
        if (t.overdue) e.overdue += 1
        byProject.set(t.project.id, e)
      }
      return [...byProject.values()].sort((a, b) => a.projectId - b.projectId)
    }
    const counted = async (headers) =>
      (await getJson(request, headers, '/api/tasks/project-stats')).sort((a, b) => a.projectId - b.projectId)

    const adminStats = await counted(admin)
    expect(adminStats.length).toBeGreaterThan(3)
    expect(Object.keys(adminStats[0]).sort()).toEqual(['completed', 'overdue', 'projectId', 'total'])
    await agree(() => counted(admin), () => expected(admin))
    await agree(() => counted(chen), () => expected(chen))
    expect((await counted(chen)).length).toBeLessThan(adminStats.length)
  })
})

test.describe('calendar window and project counts: the pages', () => {
  test('the Calendar asks only for the days on screen, and reads a new window when you move on', async ({ page, request }) => {
    const pm = await apiLogin(request, 'pm.olivia')
    const stamp = `${Date.now()}`
    const projectRes = await request.post('/api/projects', {
      headers: pm,
      data: { name: `e2e calendar ${stamp}`, priority: 'LOW', status: 'IN_PROGRESS', startDate: '2026-01-01', endDate: '2099-12-31' },
    })
    expect(projectRes.status()).toBe(201)
    const project = await projectRes.json()
    try {
      // a task due about five weeks from now: outside the first window shown, inside a later one
      const due = isoDay(37)
      const taskRes = await request.post('/api/tasks', {
        headers: pm,
        data: { projectId: project.id, title: `Far away ${stamp}`, priority: 'LOW', status: 'TODO', startDate: '2026-01-05', dueDate: due },
      })
      expect(taskRes.status()).toBe(201)

      const taskRequests = []
      page.on('request', (r) => {
        const url = new URL(r.url())
        if (r.method() === 'GET' && url.pathname === '/api/tasks') taskRequests.push(url.searchParams)
      })
      await login(page)
      await page.goto('/calendar')
      await expect(page.getByRole('button', { name: 'Next month' })).toBeVisible()
      await expect.poll(() => taskRequests.length).toBeGreaterThan(0)
      // every read of the task list carries a window; nothing reads them all
      expect(taskRequests.every((p) => p.get('dueFrom') && p.get('dueTo'))).toBe(true)
      await expect(page.getByRole('button', { name: new RegExp(`Far away ${stamp}`) })).toHaveCount(0)

      const target = new Date(`${due}T00:00:00`)
      const label = target.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      for (let i = 0; i < 3 && !(await page.getByText(label, { exact: true }).isVisible()); i++) {
        await page.getByRole('button', { name: 'Next month' }).click()
      }
      await expect(page.getByText(label, { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: new RegExp(`Far away ${stamp}`) }).first()).toBeVisible()
      expect(taskRequests.length).toBeGreaterThan(1)
      expect(taskRequests.every((p) => p.get('dueFrom') && p.get('dueTo'))).toBe(true)
    } finally {
      await request.delete(`/api/projects/${project.id}`, { headers: pm })
    }
  })

  test('the Projects page reads the task counts, not the tasks', async ({ page }) => {
    const seen = []
    page.on('request', (r) => {
      const url = new URL(r.url())
      if (r.method() === 'GET' && url.pathname.startsWith('/api/tasks')) seen.push(url.pathname)
    })
    await login(page)
    await page.goto('/projects')
    await expect(page.locator('a[href^="/projects/"]').first()).toBeVisible()
    await expect(page.getByText(/^\d+\/\d+ tasks$/).first()).toBeVisible()
    expect(seen).toContain('/api/tasks/project-stats')
    expect(seen).not.toContain('/api/tasks')
  })
})
