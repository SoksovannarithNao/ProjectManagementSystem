import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD, SEED_ADMIN_USERNAME } from './helpers.js'

// Checklist risk R-5: the project, task and notification lists can be read a page at a time
// (?page and ?size), and the notification bell loads its history a page at a time ("Show more").
// Without ?page or ?size every list answers as before: the whole list.

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
// stale when another spec creates or deletes a project or task. Poll until the two counts agree.
const agree = (counted, expected) => expect.poll(async () => (await counted()) - (await expected())).toBe(0)

test.describe('paging: API', () => {
  test('projects: a page, its total, the order, and the whole list when nothing is asked', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const all = await getJson(request, admin, '/api/projects')
    expect(Array.isArray(all)).toBe(true)
    expect(all.length).toBeGreaterThan(3)

    const first = await getJson(request, admin, '/api/projects', { page: 0, size: 3 })
    const second = await getJson(request, admin, '/api/projects', { page: 1, size: 3 })
    expect(Object.keys(first).sort()).toEqual(['items', 'page', 'size', 'total'])
    expect(first).toMatchObject({ page: 0, size: 3 })
    await agree(async () => (await getJson(request, admin, '/api/projects', { page: 0, size: 3 })).total,
      async () => (await getJson(request, admin, '/api/projects')).length)
    expect(first.items).toHaveLength(3)
    // pages follow each other without overlap, in id order when no sort is asked for
    const ids = [...first.items, ...second.items].map((p) => p.id)
    expect(ids).toEqual([...ids].sort((a, b) => a - b))
    expect(new Set(ids).size).toBe(ids.length)

    // size alone means page 0; a page past the end is empty but still reports the total
    expect((await getJson(request, admin, '/api/projects', { size: 2 })).items).toHaveLength(2)
    const beyond = await getJson(request, admin, '/api/projects', { page: 99, size: 3 })
    expect(beyond.items).toEqual([])
    await agree(async () => (await getJson(request, admin, '/api/projects', { page: 99, size: 3 })).total,
      async () => (await getJson(request, admin, '/api/projects')).length)

    // search, filter and sort apply first: the total counts only what matches
    const byName = await getJson(request, admin, '/api/projects', { page: 0, size: 2, sort: 'name' })
    const names = byName.items.map((p) => p.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })))
    await agree(async () => (await getJson(request, admin, '/api/projects', { status: 'IN_PROGRESS', size: 1 })).total,
      async () => (await getJson(request, admin, '/api/projects', { status: 'IN_PROGRESS' })).length)
  })

  test('tasks: pages of what the caller may see, filtered first', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const chen = await apiLogin(request, 'dev.chen')
    const allAdmin = await getJson(request, admin, '/api/tasks')
    const allChen = await getJson(request, chen, '/api/tasks')
    expect(allChen.length).toBeLessThan(allAdmin.length) // a member sees only their projects

    const page = await getJson(request, chen, '/api/tasks', { page: 0, size: 5 })
    // the total never counts what the caller cannot see
    await agree(async () => (await getJson(request, chen, '/api/tasks', { page: 0, size: 5 })).total,
      async () => (await getJson(request, chen, '/api/tasks')).length)
    expect(page.items).toHaveLength(5)
    const chenIds = new Set(allChen.map((t) => t.id))
    expect(page.items.every((t) => chenIds.has(t.id))).toBe(true)

    const filtered = await getJson(request, chen, '/api/tasks', { status: 'IN_PROGRESS', page: 0, size: 2, sort: 'dueDate' })
    await agree(async () => (await getJson(request, chen, '/api/tasks', { status: 'IN_PROGRESS', size: 1 })).total,
      async () => (await getJson(request, chen, '/api/tasks')).filter((t) => t.status === 'IN_PROGRESS').length)
    expect(filtered.items.every((t) => t.status === 'IN_PROGRESS')).toBe(true)
    const dues = filtered.items.map((t) => t.dueDate)
    expect(dues).toEqual([...dues].sort())
  })

  test('a bad page or size is a 400', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    for (const path of ['/api/projects', '/api/tasks', '/api/notifications']) {
      for (const params of [{ size: 0 }, { size: 201 }, { page: -1 }]) {
        expect((await request.get(path, { headers: admin, params })).status(), `${path} ${JSON.stringify(params)}`).toBe(400)
      }
    }
    expect((await request.get('/api/tasks', { headers: admin, params: { size: 'many' } })).status()).toBe(400)
  })
})

test.describe('paging: the notification bell', () => {
  test('shows the newest 20 and loads the older ones on request', async ({ page, request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const pm = await apiLogin(request, 'pm.olivia')
    const stamp = `${Date.now()}`
    const username = `paging.${stamp}`
    const created = await request.post('/api/users', {
      headers: admin,
      data: { fullName: `Paging Person ${stamp}`, username, email: `${username}@example.com`, password: SEED_PASSWORD, accountStatus: 'ACTIVE' },
    })
    expect(created.status()).toBe(201)
    const userId = (await created.json()).id
    const projectRes = await request.post('/api/projects', {
      headers: pm,
      data: { name: `e2e paging ${stamp}`, priority: 'LOW', status: 'IN_PROGRESS', startDate: '2026-01-01', endDate: '2099-12-31' },
    })
    expect(projectRes.status()).toBe(201)
    const project = await projectRes.json()
    try {
      // the person joins the project, then 22 tasks are assigned to them: 22 + 1 notifications
      expect((await request.post('/api/project-members/invite', { headers: pm, data: { projectId: project.id, username, projectRole: 'MEMBER' } })).status()).toBe(201)
      const theirs = await apiLogin(request, username)
      expect((await request.post(`/api/project-members/project/${project.id}/accept`, { headers: theirs })).status()).toBe(200)
      for (let i = 1; i <= 22; i++) {
        const t = await request.post('/api/tasks', {
          headers: pm,
          data: { projectId: project.id, title: `Paging task ${i}`, priority: 'LOW', status: 'TODO', startDate: '2026-01-05', dueDate: '2099-01-01' },
        })
        expect(t.status()).toBe(201)
        const assigned = await request.post('/api/task-assignees', { headers: pm, data: { taskId: (await t.json()).id, userId } })
        expect(assigned.status()).toBe(201)
      }
      const total = (await getJson(request, theirs, '/api/notifications')).length
      expect(total).toBeGreaterThan(20)
      const apiPage = await getJson(request, theirs, '/api/notifications', { page: 0, size: 20 })
      expect(apiPage).toMatchObject({ total, page: 0, size: 20 })
      expect(apiPage.items).toHaveLength(20)
      const dates = apiPage.items.map((n) => n.createdAt)
      expect(dates).toEqual([...dates].sort().reverse()) // newest first
      const unread = (await getJson(request, theirs, '/api/notifications/unread-count')).count

      await login(page, username)
      await page.getByRole('button', { name: 'Notifications' }).click()
      const items = page.getByRole('button', { name: 'Dismiss notification' })
      await expect(items).toHaveCount(20)
      const more = page.getByRole('button', { name: `Show more (${total - 20} older)` })
      await expect(more).toBeVisible()

      await more.click()
      await expect(items).toHaveCount(total)
      await expect(page.getByRole('button', { name: /^Show more/ })).toHaveCount(0)
      // the unread dot comes from the server's count, not from what is loaded
      expect(unread).toBe(total)
    } finally {
      await request.delete(`/api/projects/${project.id}`, { headers: pm })
      await request.delete(`/api/users/${userId}`, { headers: admin })
    }
  })
})
