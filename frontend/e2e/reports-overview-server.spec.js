import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD, SEED_ADMIN_USERNAME } from './helpers.js'

// Checklist risk R-5, Reports Overview: the stat cards, the Task Completion chart and Team Productivity
// come from the server (the task summary and the dashboard's activity endpoint, both for the chosen
// project), so the page no longer reads every task or every assignment.

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

// What the page used to work out in the browser, from the plain task list.
const figuresFrom = (tasks) => {
  const completedBy = {}
  for (const t of tasks) {
    if (t.status !== 'COMPLETED') continue
    for (const id of t.assigneeIds) completedBy[id] = (completedBy[id] ?? 0) + 1
  }
  return {
    all: tasks.length,
    inprogress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    completed: tasks.filter((t) => t.status === 'COMPLETED').length,
    overdue: tasks.filter((t) => t.overdue).length,
    completedBy,
  }
}

test.describe('reports overview: API', () => {
  test('the task summary of a project gives the counts and who completed what, as the tasks themselves add up', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const projects = await getJson(request, admin, '/api/projects')
    const withTasks = []
    for (const p of projects) {
      if ((await getJson(request, admin, '/api/tasks', { projectId: p.id, size: 1 })).total > 0) withTasks.push(p)
    }
    expect(withTasks.length).toBeGreaterThan(2)

    for (const project of withTasks.slice(0, 3)) {
      await agree(
        async () => {
          const s = await getJson(request, admin, '/api/tasks/summary', { projectId: project.id })
          return { ...Object.fromEntries(['all', 'inprogress', 'completed', 'overdue'].map((k) => [k, s.viewCounts[k]])), completedBy: s.completedByAssignee }
        },
        async () => figuresFrom((await getJson(request, admin, '/api/tasks', { projectId: project.id })))
      )
    }
  })

  test('without a project it covers everything the caller may see, and a member sees only their own projects', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const chen = await apiLogin(request, 'dev.chen')
    for (const headers of [admin, chen]) {
      await agree(
        async () => {
          const s = await getJson(request, headers, '/api/tasks/summary')
          return { ...Object.fromEntries(['all', 'inprogress', 'completed', 'overdue'].map((k) => [k, s.viewCounts[k]])), completedBy: s.completedByAssignee }
        },
        async () => figuresFrom((await getJson(request, headers, '/api/tasks')))
      )
    }
    const all = (await getJson(request, admin, '/api/tasks/summary')).viewCounts.all
    const his = (await getJson(request, chen, '/api/tasks/summary')).viewCounts.all
    expect(his).toBeLessThan(all)
  })

  test('the daily chart of one project counts only that project', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const projects = await getJson(request, admin, '/api/projects')
    const project = projects[0]
    const createdIn = async (params) =>
      (await getJson(request, admin, '/api/dashboard/task-activity', { days: 366, zone: 'UTC', ...params })).reduce((n, r) => n + r.created, 0)
    await agree(
      async () => createdIn({ projectId: project.id }),
      async () => {
        const tasks = await getJson(request, admin, '/api/tasks', { projectId: project.id })
        const since = new Date()
        since.setUTCDate(since.getUTCDate() - 365)
        const first = since.toISOString().slice(0, 10)
        return tasks.filter((t) => t.createdAt && t.createdAt.slice(0, 10) >= first).length
      }
    )
    expect(await createdIn({ projectId: project.id })).toBeLessThanOrEqual(await createdIn({}))
  })
})

test.describe('reports overview: the page', () => {
  test('shows the server figures, for a chosen project too, and never reads every task or assignment', async ({ page, request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const projects = await getJson(request, admin, '/api/projects')
    let project = null
    for (const p of projects) {
      const total = (await getJson(request, admin, '/api/tasks', { projectId: p.id, size: 1 })).total
      if (total > 0 && total < (await getJson(request, admin, '/api/tasks', { size: 1 })).total) {
        project = p
        break
      }
    }
    expect(project, 'a project that holds some of the tasks').toBeTruthy()

    const reads = { tasks: [], assignments: [], summary: [], activity: [] }
    page.on('request', (r) => {
      const url = new URL(r.url())
      if (r.method() !== 'GET') return
      if (url.pathname === '/api/tasks') reads.tasks.push(url.search)
      if (url.pathname === '/api/task-assignees') reads.assignments.push(url.search)
      if (url.pathname === '/api/tasks/summary') reads.summary.push(url.searchParams)
      if (url.pathname === '/api/dashboard/task-activity') reads.activity.push(url.searchParams)
    })
    const card = (label) => page.getByText(label, { exact: true }).locator('xpath=..')

    await login(page)
    await page.goto('/reports')
    await expect(page.getByText('Total Tasks', { exact: true })).toBeVisible()
    const everything = (await getJson(request, admin, '/api/tasks/summary')).viewCounts
    await expect(card('Total Tasks')).toContainText(String(everything.all))
    await expect(card('Completed')).toContainText(String(everything.completed))

    await page.getByRole('button', { name: /Filter/ }).click()
    await page.getByRole('button', { name: project.name, exact: true }).click()
    const mine = (await getJson(request, admin, '/api/tasks/summary', { projectId: project.id })).viewCounts
    await expect(card('Total Tasks')).toContainText(String(mine.all))
    await expect.poll(() => reads.summary.some((p) => p.get('projectId') === String(project.id))).toBe(true)
    await expect.poll(() => reads.activity.some((p) => p.get('projectId') === String(project.id))).toBe(true)

    await page.waitForLoadState('networkidle')
    expect(reads.tasks).toEqual([]) // no read of the task list at all on this page
    expect(reads.assignments).toEqual([])
  })
})
