import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD, SEED_ADMIN_USERNAME } from './helpers.js'

// Checklist risk R-5, the Tasks page: the server filters, sorts and pages the list (50 at a time,
// "Show more" for the rest), counts the quick views, names each task's assignees and keeps the tasks
// of a project together. The page no longer reads every task to do this in the browser.

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
// The specs share one database and run side by side, so a count read a moment ago can already be
// stale when another spec creates or deletes a task. Poll until the two counts agree.
const agree = (counted, expected) => expect.poll(async () => (await counted()) - (await expected())).toBe(0)

test.describe('tasks list: API', () => {
  test('the summary counts each quick view, and a view narrows the page to exactly that many', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const views = ['all', 'today', 'upcoming', 'inprogress', 'completed', 'overdue']
    const summary = await getJson(request, admin, '/api/tasks/summary')
    expect(Object.keys(summary.viewCounts)).toEqual(views)
    expect(summary.assignees.length).toBeGreaterThan(0)
    for (const view of views) {
      await agree(
        async () => (await getJson(request, admin, '/api/tasks/summary')).viewCounts[view],
        async () => (await getJson(request, admin, '/api/tasks', { view, size: 1 })).total
      )
    }
    // the counts follow the other filters but not the view or the sort
    const completed = await getJson(request, admin, '/api/tasks/summary', { status: 'COMPLETED' })
    expect(completed.viewCounts.all).toBe(completed.viewCounts.completed)
    expect(completed.viewCounts.inprogress).toBe(0)
  })

  test('a view returns only its own tasks', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const open = (t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
    const get = async (view) => (await getJson(request, admin, '/api/tasks', { view, size: 200 })).items
    expect((await get('completed')).every((t) => t.status === 'COMPLETED')).toBe(true)
    expect((await get('inprogress')).every((t) => t.status === 'IN_PROGRESS')).toBe(true)
    expect((await get('overdue')).every((t) => t.overdue)).toBe(true)
    expect((await get('upcoming')).every((t) => open(t) && t.dueDate)).toBe(true)
    expect((await get('today')).every((t) => open(t) && t.dueDate)).toBe(true)
  })

  test('each task names its assignees, and unassigned and several assignees filter on them', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const { items } = await getJson(request, admin, '/api/tasks', { size: 200 })
    const assignments = await getJson(request, admin, '/api/task-assignees')
    const byTask = new Map()
    for (const a of assignments) byTask.set(a.task.id, [...(byTask.get(a.task.id) ?? []), a.user.id])
    // compare tasks that were not touched by another spec in between
    const settled = items.filter((t) => [...(t.assigneeIds ?? [])].sort().join() === [...(byTask.get(t.id) ?? [])].sort().join())
    expect(settled.length).toBeGreaterThan(items.length * 0.9)
    expect(items.some((t) => t.assigneeIds.length > 0)).toBe(true)

    const person = items.find((t) => t.assigneeIds.length > 0).assigneeIds[0]
    const mine = await getJson(request, admin, '/api/tasks', { assigneeId: person, size: 200 })
    expect(mine.items.length).toBeGreaterThan(0)
    expect(mine.items.every((t) => t.assigneeIds.includes(person))).toBe(true)

    const nobody = await getJson(request, admin, '/api/tasks', { unassigned: true, size: 200 })
    expect(nobody.items.every((t) => t.assigneeIds.length === 0)).toBe(true)
    // unassigned together with an assignee can match nothing
    expect((await getJson(request, admin, '/api/tasks', { unassigned: true, assigneeId: person, size: 1 })).total).toBe(0)
  })

  test('grouped by project: each project is one run, finished projects come last', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const { items } = await getJson(request, admin, '/api/tasks', { groupBy: 'project', sort: 'priority', size: 200 })
    const runs = []
    for (const t of items) if (runs.at(-1) !== t.project.id) runs.push(t.project.id)
    expect(new Set(runs).size).toBe(runs.length) // no project appears in two runs
    const progress = new Map(items.map((t) => [t.project.id, Number(t.project.progress ?? 0)]))
    const flags = runs.map((id) => (progress.get(id) >= 100 ? 1 : 0))
    expect(flags).toEqual([...flags].sort())
  })

  test('a bad view or groupBy is a 400', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    expect((await request.get('/api/tasks', { headers: admin, params: { view: 'soon' } })).status()).toBe(400)
    expect((await request.get('/api/tasks', { headers: admin, params: { groupBy: 'owner' } })).status()).toBe(400)
    expect((await request.get('/api/tasks/summary', { headers: admin, params: { due: 'soon' } })).status()).toBe(400)
  })

  test('a member sees counts and assignees only for the projects they belong to', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const chen = await apiLogin(request, 'dev.chen')
    const all = (await getJson(request, admin, '/api/tasks/summary')).viewCounts.all
    const his = (await getJson(request, chen, '/api/tasks/summary')).viewCounts.all
    expect(his).toBeGreaterThan(0)
    expect(his).toBeLessThan(all)
    await agree(async () => (await getJson(request, chen, '/api/tasks/summary')).viewCounts.all,
      async () => (await getJson(request, chen, '/api/tasks')).length)
  })
})

test.describe('tasks list: the page', () => {
  test('shows 50 tasks, then the rest on request, with the quick-view counts from the server', async ({ page, request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const total = (await getJson(request, admin, '/api/tasks', { size: 1 })).total
    expect(total).toBeGreaterThan(50) // the demo data has more than one page of tasks

    await login(page)
    await page.goto('/tasks')
    const rows = page.getByTestId('task-row')
    await expect(rows).toHaveCount(50)
    const more = page.getByTestId('tasks-show-more')
    await expect(more).toContainText(/Show more \(\d+ more\)/)
    await expect(page.getByTestId('quick-view-all')).toContainText(/\d+/)

    await more.click()
    await expect.poll(async () => rows.count()).toBeGreaterThan(50)
    await expect(page.getByText(/^\d+ tasks across all your projects$/)).toBeVisible()

    // a quick view changes the list and starts again from its first page
    await page.getByTestId('quick-view-overdue').click()
    await expect(page.getByText(/\d+ matching tasks?/)).toBeVisible()
    await expect(rows.first()).toBeVisible()
    await expect(rows.filter({ hasNotText: 'Overdue' })).toHaveCount(0)
  })

  test('opening a task reads that project only for the dependency picker, never every task', async ({ page }) => {
    const reads = []
    page.on('request', (r) => {
      const url = new URL(r.url())
      if (r.method() === 'GET' && url.pathname === '/api/tasks') reads.push(url.search)
    })
    await login(page)
    await page.goto('/tasks')
    await expect(page.getByTestId('task-row').first()).toBeVisible()
    await page.getByTestId('task-row').first().click()
    await expect(page.getByRole('heading', { name: 'Depends on' })).toBeVisible()
    await page.waitForLoadState('networkidle')
    // every read of the task list is the page's own (paged), none is the whole list
    expect(reads.length).toBeGreaterThan(0)
    expect(reads.every((q) => q.includes('page=0') && q.includes('size=50'))).toBe(true)
  })

  test('search and the unassigned / assignee filters run on the server', async ({ page, request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const pm = await apiLogin(request, 'pm.olivia')
    const stamp = `${Date.now()}`
    const projectRes = await request.post('/api/projects', {
      headers: pm,
      data: { name: `e2e tasklist ${stamp}`, priority: 'LOW', status: 'IN_PROGRESS', startDate: '2026-01-01', endDate: '2099-12-31' },
    })
    expect(projectRes.status()).toBe(201)
    const project = await projectRes.json()
    try {
      const taskRes = await request.post('/api/tasks', {
        headers: pm,
        data: { projectId: project.id, title: `Lonely task ${stamp}`, priority: 'LOW', status: 'TODO', startDate: '2026-01-05', dueDate: '2099-01-01' },
      })
      expect(taskRes.status()).toBe(201)
      expect(await getJson(request, admin, `/api/tasks/${(await taskRes.json()).id}`)).toMatchObject({ assigneeIds: [] })

      await login(page)
      await page.goto('/tasks')
      await page.getByPlaceholder('Search tasks').fill(stamp)
      const rows = page.getByTestId('task-row')
      await expect(rows).toHaveCount(1)
      await expect(page.getByText('1 matching task', { exact: true })).toBeVisible()

      await page.getByRole('button', { name: /^Filter/ }).click()
      await page.getByLabel('Assignee').selectOption('unassigned')
      await expect(rows).toHaveCount(1)
      await page.getByLabel('Assignee').selectOption({ index: 2 }) // a named person: nobody holds this task
      await expect(rows).toHaveCount(0)
      await expect(page.getByText('No tasks match your search/filters')).toBeVisible()
    } finally {
      await request.delete(`/api/projects/${project.id}`, { headers: pm })
    }
  })
})
