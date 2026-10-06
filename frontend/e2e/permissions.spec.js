import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD } from './helpers.js'

// Regression tests for the permission/data-isolation fixes made on 2026-10-06:
//   - user and membership lookups are scoped to people/projects the caller can see
//   - a manager can't move a task or milestone into a project they don't manage
//   - a membership can't be re-pointed at another project or user
//   - a read-only VIEWER can't add comments or subtasks (API and UI)
//   - a deactivated account's already-issued token stops working
// Seed data (database/init/02-seed.sql): pm.olivia OWNER of PRJ-2001 (not a
// member of PRJ-2002); qa.zoe is a VIEWER of PRJ-2010; newuser is on no project.
// Everything a test creates is deleted in afterEach (or finally).

async function auth(request, username) {
  const r = await request.post('/api/auth/login', { data: { username, password: SEED_PASSWORD } })
  expect(r.ok(), `login ${username}`).toBeTruthy()
  return { Authorization: `Bearer ${(await r.json()).token}` }
}

async function projectIdByCode(request, headers, code) {
  const projects = await (await request.get('/api/projects', { headers })).json()
  return projects.find((p) => p.projectCode === code)?.id
}

test.describe.configure({ mode: 'serial' })

test.describe('permissions and data isolation', () => {
  const createdTasks = []
  const createdMilestones = []

  test.afterEach(async ({ request }) => {
    const admin = await auth(request, 'admin.system')
    for (const id of createdTasks.splice(0)) await request.delete(`/api/tasks/${id}`, { headers: admin })
    for (const id of createdMilestones.splice(0)) await request.delete(`/api/milestones/${id}`, { headers: admin })
  })

  // ---- user and membership lookups ------------------------------------

  test('a user with no projects cannot read other users, but can read themself', async ({ request }) => {
    const admin = await auth(request, 'admin.system')
    const all = await (await request.get('/api/users', { headers: admin })).json()
    const adminUser = all.find((u) => u.username === 'admin.system')
    const olivia = all.find((u) => u.username === 'pm.olivia')
    const stranger = await auth(request, 'newuser')

    expect((await request.get(`/api/users/${adminUser.id}`, { headers: stranger })).status()).toBe(404)
    expect((await request.get('/api/users/username/pm.olivia', { headers: stranger })).status()).toBe(404)
    expect((await request.get(`/api/project-members/user/${olivia.id}`, { headers: stranger })).status()).toBe(200)
    expect(await (await request.get(`/api/project-members/user/${olivia.id}`, { headers: stranger })).json()).toEqual([])

    const self = await request.get('/api/users/username/newuser', { headers: stranger })
    expect(self.status()).toBe(200)
    expect((await self.json()).username).toBe('newuser')
  })

  test('a nonexistent user and a hidden user look identical (no account enumeration via lookup)', async ({ request }) => {
    const stranger = await auth(request, 'newuser')
    const hidden = await request.get('/api/users/username/pm.olivia', { headers: stranger })
    const missing = await request.get('/api/users/username/definitely_not_a_user', { headers: stranger })
    expect(hidden.status()).toBe(404)
    expect(missing.status()).toBe(404)
    expect((await hidden.json()).message).toBe((await missing.json()).message)
  })

  test('teammates and administrators can still look each other up; memberships are limited to shared projects', async ({ request }) => {
    const olivia = await auth(request, 'pm.olivia')
    const admin = await auth(request, 'admin.system')

    // dev.chen shares PRJ-2001 with pm.olivia
    const chen = await request.get('/api/users/username/dev.chen', { headers: olivia })
    expect(chen.status()).toBe(200)
    const chenId = (await chen.json()).id

    const visible = await (await request.get(`/api/project-members/user/${chenId}`, { headers: olivia })).json()
    const oliviaProjects = await (await request.get('/api/projects', { headers: olivia })).json()
    const oliviaProjectIds = new Set(oliviaProjects.map((p) => p.id))
    expect(visible.length).toBeGreaterThan(0)
    for (const row of visible) {
      expect(oliviaProjectIds.has(row.project.id)).toBe(true) // only projects olivia belongs to
      expect(row.status).toBe('ACTIVE')
    }

    // an administrator still sees every membership (dev.chen is also on PRJ-2005, which olivia is not on)
    const everything = await (await request.get(`/api/project-members/user/${chenId}`, { headers: admin })).json()
    expect(everything.length).toBeGreaterThan(visible.length)
  })

  // ---- moving things between projects ---------------------------------

  test('an owner cannot move a task into a project they do not belong to', async ({ request }) => {
    const olivia = await auth(request, 'pm.olivia')
    const admin = await auth(request, 'admin.system')
    const p1 = await projectIdByCode(request, olivia, 'PRJ-2001')
    const p2 = await projectIdByCode(request, admin, 'PRJ-2002')
    expect(await projectIdByCode(request, olivia, 'PRJ-2002')).toBeUndefined() // not visible to her

    const body = { projectId: p1, title: 'E2E move test', startDate: '2026-10-06', dueDate: '2026-10-07', priority: 'LOW', status: 'TO_DO' }
    const created = await request.post('/api/tasks', { headers: olivia, data: body })
    expect(created.status()).toBe(201)
    const task = await created.json()
    createdTasks.push(task.id)

    const moved = await request.put(`/api/tasks/${task.id}`, { headers: olivia, data: { ...body, projectId: p2 } })
    expect(moved.status()).toBe(403)

    const after = await (await request.get(`/api/tasks/${task.id}`, { headers: olivia })).json()
    expect(after.project.id).toBe(p1)

    // ...but editing the same task in place still works
    const renamed = await request.put(`/api/tasks/${task.id}`, { headers: olivia, data: { ...body, title: 'E2E renamed' } })
    expect(renamed.status()).toBe(200)
    expect((await renamed.json()).title).toBe('E2E renamed')
  })

  test('an owner cannot move a milestone into another project, nor re-point a membership', async ({ request }) => {
    const olivia = await auth(request, 'pm.olivia')
    const admin = await auth(request, 'admin.system')
    const p1 = await projectIdByCode(request, olivia, 'PRJ-2001')
    const p2 = await projectIdByCode(request, admin, 'PRJ-2002')

    const created = await request.post('/api/milestones', {
      headers: olivia,
      data: { projectId: p1, title: 'E2E milestone', dueDate: '2026-11-01' },
    })
    expect(created.status()).toBe(201)
    const ms = await created.json()
    createdMilestones.push(ms.id)
    const moved = await request.put(`/api/milestones/${ms.id}`, {
      headers: olivia,
      data: { projectId: p2, title: 'E2E milestone', dueDate: '2026-11-01' },
    })
    expect(moved.status()).toBe(403)

    // membership rows keep their project and user; only the role may change
    const members = await (await request.get(`/api/project-members/project/${p1}`, { headers: olivia })).json()
    const chen = members.find((m) => m.user.username === 'dev.chen')
    const repoint = await request.put(`/api/project-members/${chen.id}`, {
      headers: olivia,
      data: { projectId: p2, userId: chen.user.id, projectRole: chen.projectRole },
    })
    expect(repoint.status()).toBe(400)
    expect((await repoint.json()).message).toContain('cannot be changed')
    const handOver = await request.put(`/api/project-members/${chen.id}`, {
      headers: olivia,
      data: { projectId: p1, userId: members.find((m) => m.user.username === 'pm.olivia').user.id, projectRole: chen.projectRole },
    })
    expect(handOver.status()).toBe(400)
  })

  // ---- read-only viewers -----------------------------------------------

  test('a VIEWER can read comments and subtasks but cannot add them (API)', async ({ request }) => {
    const zoe = await auth(request, 'qa.zoe')
    const projectId = await projectIdByCode(request, zoe, 'PRJ-2010')
    const tasks = await (await request.get(`/api/tasks/project/${projectId}`, { headers: zoe })).json()
    const taskId = tasks[0].id

    expect((await request.get(`/api/comments/task/${taskId}`, { headers: zoe })).status()).toBe(200)
    expect((await request.get(`/api/subtasks/task/${taskId}`, { headers: zoe })).status()).toBe(200)

    const comment = await request.post('/api/comments', { headers: zoe, data: { taskId, message: 'viewer comment' } })
    expect(comment.status()).toBe(403)
    const subtask = await request.post('/api/subtasks', { headers: zoe, data: { taskId, title: 'viewer subtask' } })
    expect(subtask.status()).toBe(403)
    // and still cannot create a task
    const task = await request.post('/api/tasks', {
      headers: zoe,
      data: { projectId, title: 'viewer task', startDate: '2026-10-06', dueDate: '2026-10-07' },
    })
    expect(task.status()).toBe(403)
  })

  test('an owner and a member can still comment and add subtasks', async ({ request }) => {
    const olivia = await auth(request, 'pm.olivia')
    const chen = await auth(request, 'dev.chen') // a MEMBER of PRJ-2001
    const p1 = await projectIdByCode(request, olivia, 'PRJ-2001')

    // A task of this test's own, so nothing is added to a seeded task's history; deleting it
    // (in afterEach) removes the comments and subtasks with it.
    const created = await request.post('/api/tasks', {
      headers: olivia,
      data: { projectId: p1, title: 'E2E comment target', startDate: '2026-10-06', dueDate: '2026-10-07', priority: 'LOW', status: 'TO_DO' },
    })
    expect(created.status()).toBe(201)
    const taskId = (await created.json()).id
    createdTasks.push(taskId)

    for (const [who, headers] of [['owner', olivia], ['member', chen]]) {
      const comment = await request.post('/api/comments', { headers, data: { taskId, message: `e2e ${who} comment` } })
      expect(comment.status(), `${who} comment`).toBe(201)
      const subtask = await request.post('/api/subtasks', { headers, data: { taskId, title: `e2e ${who} subtask` } })
      expect(subtask.status(), `${who} subtask`).toBe(201)
    }
  })

  test('the task panel hides the comment box and subtask controls from a VIEWER', async ({ page, request }) => {
    const zoe = await auth(request, 'qa.zoe')
    const projectId = await projectIdByCode(request, zoe, 'PRJ-2010')

    await login(page, 'qa.zoe')
    await page.goto(`/projects/${projectId}`)
    await page.getByTestId('task-row').first().click()
    await expect(page.getByText('Task', { exact: true })).toBeVisible()
    await expect(page.getByPlaceholder('Add a comment...')).toHaveCount(0)
    await expect(page.getByPlaceholder('Add a subtask...')).toHaveCount(0)

    await page.evaluate(() => localStorage.clear())
    await login(page, 'pm.olivia')
    await page.goto(`/projects/${await projectIdByCode(request, await auth(request, 'pm.olivia'), 'PRJ-2001')}`)
    await page.getByTestId('task-row').first().click()
    await expect(page.getByPlaceholder('Add a comment...')).toBeVisible()
    await expect(page.getByPlaceholder('Add a subtask...')).toBeVisible()
  })

  // ---- deactivated accounts ----------------------------------------------

  test('a token issued before an account was suspended stops working, and works again once it is reactivated', async ({ request }) => {
    const admin = await auth(request, 'admin.system')
    const all = await (await request.get('/api/users', { headers: admin })).json()
    const target = all.find((u) => u.username === 'newuser')
    const body = (status) => ({
      fullName: target.fullName,
      username: target.username,
      email: target.email,
      accountStatus: status,
    })

    const tokenBefore = await auth(request, 'newuser')
    expect((await request.get('/api/users/username/newuser', { headers: tokenBefore })).status()).toBe(200)

    try {
      const suspended = await request.put(`/api/users/${target.id}`, { headers: admin, data: body('SUSPENDED') })
      expect(suspended.status()).toBe(200)

      // the already-issued token is rejected right away (401, empty body)...
      expect((await request.get('/api/users/username/newuser', { headers: tokenBefore })).status()).toBe(401)
      // ...and so is a fresh login
      const relogin = await request.post('/api/auth/login', { data: { username: 'newuser', password: SEED_PASSWORD } })
      expect(relogin.status()).toBe(401)
    } finally {
      const restored = await request.put(`/api/users/${target.id}`, { headers: admin, data: body('ACTIVE') })
      expect(restored.status()).toBe(200)
    }

    // the same token is accepted again after reactivation (it never expired)
    expect((await request.get('/api/users/username/newuser', { headers: tokenBefore })).status()).toBe(200)
  })
})
