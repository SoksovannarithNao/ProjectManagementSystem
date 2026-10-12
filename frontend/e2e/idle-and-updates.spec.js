import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD } from './helpers.js'

// Step 2 of docs/checklist/partially_done.md: auto-logout (#8) and the comment, project and
// milestone notifications (#45).
//
// The auto-logout tests move the browser's clock with Playwright's fake clock instead of
// waiting 15 real minutes; the API calls still use the server's real time.

const apiLogin = async (request, username) => {
  const res = await request.post('/api/auth/login', { data: { username, password: SEED_PASSWORD } })
  expect(res.status()).toBe(200)
  return { Authorization: `Bearer ${(await res.json()).token}` }
}

const MINUTE = 60 * 1000

// The idle timer starts when the signed-in layout has rendered, so wait for that before
// moving the clock.
async function openTasks(page) {
  await page.goto('/tasks')
  await expect(page.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible()
  await page.waitForFunction(() => localStorage.getItem('taskflow.lastActive') !== null)
}

test.describe('auto-logout', () => {
  test('warns after 15 idle minutes, then signs out a minute later and says why', async ({ page }) => {
    await page.clock.install()
    await login(page, 'dev.chen')
    await openTasks(page)
    await expect(page.getByTestId('idle-warning')).toHaveCount(0)

    await page.clock.fastForward(15 * MINUTE + 2000)
    const warning = page.getByTestId('idle-warning')
    await expect(warning).toBeVisible()
    await expect(page.getByTestId('idle-seconds')).toContainText(/\d+ seconds?/)

    await page.clock.fastForward(61 * 1000)
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByTestId('idle-signed-out')).toContainText('no activity')
    expect(await page.evaluate(() => localStorage.getItem('taskflow.auth'))).toBeNull()
  })

  test('"Stay signed in" keeps the session and restarts the clock', async ({ page }) => {
    await page.clock.install()
    await login(page, 'dev.chen')
    await openTasks(page)

    await page.clock.fastForward(15 * MINUTE + 2000)
    await expect(page.getByTestId('idle-warning')).toBeVisible()
    await page.getByRole('button', { name: 'Stay signed in' }).click()
    await expect(page.getByTestId('idle-warning')).toHaveCount(0)

    // ten minutes later there is still no warning: the clock started again at the click
    await page.clock.fastForward(10 * MINUTE)
    await expect(page.getByTestId('idle-warning')).toHaveCount(0)
    await expect(page).toHaveURL(/\/tasks/)
  })

  test('activity restarts the clock before the warning', async ({ page }) => {
    await page.clock.install()
    await login(page, 'dev.chen')
    await openTasks(page)

    await page.clock.fastForward(14 * MINUTE)
    await page.mouse.move(200, 200)
    await page.mouse.move(260, 240)
    await page.clock.fastForward(14 * MINUTE)
    await expect(page.getByTestId('idle-warning')).toHaveCount(0)
    await expect(page).toHaveURL(/\/tasks/)
  })

  test('activity in another tab keeps this tab signed in', async ({ context, page }) => {
    await context.clock.install()
    await login(page, 'dev.chen')
    await openTasks(page)
    const other = await context.newPage()
    await openTasks(other)

    await context.clock.fastForward(14 * MINUTE)
    await other.mouse.move(120, 120)
    await other.mouse.move(180, 160)
    await context.clock.fastForward(14 * MINUTE)

    await expect(page.getByTestId('idle-warning')).toHaveCount(0)
    await expect(page).toHaveURL(/\/tasks/)
  })

  test('"Sign out now" signs out without the inactivity message', async ({ page }) => {
    await page.clock.install()
    await login(page, 'dev.chen')
    await openTasks(page)

    await page.clock.fastForward(15 * MINUTE + 2000)
    await page.getByRole('button', { name: 'Sign out now' }).click()
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByTestId('idle-signed-out')).toHaveCount(0)
  })
})

// Everything below runs in one throw-away project owned by pm.olivia, with lead.owen as its
// Team Leader and dev.chen and dev.mia as Team Members; deleting the project removes its
// notifications too.
test.describe('comment, project and milestone notifications', () => {
  test.describe.configure({ mode: 'serial' })

  const stamp = Date.now()
  let pm, chen, mia, owen
  let project, task, milestone

  const idOf = async (request, headers, username) =>
    (await (await request.get(`/api/users/username/${username}`, { headers })).json()).id

  const mine = async (request, headers, type) =>
    (await (await request.get('/api/notifications', { headers })).json()).filter(
      (n) => n.type === type && n.projectId === project.id
    )

  test.beforeAll(async ({ request }) => {
    pm = await apiLogin(request, 'pm.olivia')
    chen = await apiLogin(request, 'dev.chen')
    mia = await apiLogin(request, 'dev.mia')
    owen = await apiLogin(request, 'lead.owen')

    const created = await request.post('/api/projects', {
      headers: pm,
      data: { name: `E2E updates ${stamp}`, startDate: '2026-01-01', endDate: '2027-12-31', priority: 'LOW', status: 'IN_PROGRESS' },
    })
    expect(created.status()).toBe(201)
    project = await created.json()

    for (const [headers, username, role] of [[chen, 'dev.chen', 'MEMBER'], [mia, 'dev.mia', 'MEMBER'], [owen, 'lead.owen', 'ADMIN']]) {
      const userId = await idOf(request, pm, username)
      const added = await request.post('/api/project-members', { headers: pm, data: { projectId: project.id, userId, projectRole: role } })
      expect(added.status(), `add ${username}`).toBe(201)
      void headers
    }

    const t = await request.post('/api/tasks', {
      headers: pm,
      data: { projectId: project.id, title: `E2E task ${stamp}`, priority: 'LOW', status: 'TODO', startDate: '2026-01-01', dueDate: '2027-06-30' },
    })
    expect(t.status()).toBe(201)
    task = await t.json()
    const assigned = await request.post('/api/task-assignees', { headers: pm, data: { taskId: task.id, userId: await idOf(request, pm, 'dev.chen') } })
    expect(assigned.status()).toBe(201)

    const m = await request.post('/api/milestones', {
      headers: pm,
      data: { projectId: project.id, title: `E2E milestone ${stamp}`, dueDate: '2027-03-01' },
    })
    expect(m.status()).toBe(201)
    milestone = await m.json()
    const linked = await request.put(`/api/tasks/${task.id}`, {
      headers: pm,
      data: { projectId: project.id, title: task.title, priority: 'LOW', status: 'TODO', startDate: task.startDate, dueDate: task.dueDate, milestoneId: milestone.id },
    })
    expect(linked.status()).toBe(200)
  })

  test.afterAll(async ({ request }) => {
    if (project) await request.delete(`/api/projects/${project.id}`, { headers: pm })
  })

  test('a comment reaches the assignee, the Owner and the Team Leader - not the author, not an outsider to the task', async ({ request }) => {
    const res = await request.post('/api/comments', { headers: mia, data: { taskId: task.id, message: 'Please add the footer' } })
    expect(res.status()).toBe(201)

    for (const [who, headers] of [['dev.chen (assignee)', chen], ['pm.olivia (Owner)', pm], ['lead.owen (Team Leader)', owen]]) {
      const got = await mine(request, headers, 'COMMENT_ADDED')
      expect(got, who).toHaveLength(1)
      expect(got[0].title).toBe('New comment')
      expect(got[0].message).toContain('commented on')
      expect(got[0].message).toContain(task.title)
      expect(got[0].message).toContain('Please add the footer')
      expect(got[0].taskId).toBe(task.id)
    }
    expect(await mine(request, mia, 'COMMENT_ADDED'), 'the author is not told about their own comment').toHaveLength(0)
  })

  test('a reply also reaches the author of the comment it answers', async ({ request }) => {
    const comments = await (await request.get(`/api/comments/task/${task.id}`, { headers: pm })).json()
    const root = comments.find((c) => c.message === 'Please add the footer')
    const reply = await request.post('/api/comments', { headers: chen, data: { taskId: task.id, message: 'Footer added', parentCommentId: root.id } })
    expect(reply.status()).toBe(201)

    const toMia = await mine(request, mia, 'COMMENT_ADDED')
    expect(toMia).toHaveLength(1)
    expect(toMia[0].title).toBe('New reply')
    expect(toMia[0].message).toContain('replied on')
    // the Owner has the comment and now the reply; the replier (an assignee) has only the comment
    expect(await mine(request, pm, 'COMMENT_ADDED')).toHaveLength(2)
    expect(await mine(request, chen, 'COMMENT_ADDED')).toHaveLength(1)
  })

  test('editing a project tells the people with work in it; saving without changes tells nobody', async ({ request }) => {
    const body = { name: project.name, startDate: project.startDate, endDate: project.endDate, priority: 'LOW', status: 'IN_PROGRESS' }

    expect((await request.put(`/api/projects/${project.id}`, { headers: pm, data: body })).status()).toBe(200)
    expect(await mine(request, chen, 'PROJECT_UPDATED'), 'nothing changed').toHaveLength(0)

    const edited = await request.put(`/api/projects/${project.id}`, { headers: pm, data: { ...body, description: 'New scope', priority: 'HIGH' } })
    expect(edited.status()).toBe(200)

    const toChen = await mine(request, chen, 'PROJECT_UPDATED')
    expect(toChen).toHaveLength(1)
    expect(toChen[0].title).toBe('Project updated')
    expect(toChen[0].message).toContain('priority')
    expect(toChen[0].message).toContain('description')
    expect(await mine(request, owen, 'PROJECT_UPDATED'), 'the Team Leader').toHaveLength(1)
    expect(await mine(request, pm, 'PROJECT_UPDATED'), 'the person who edited it').toHaveLength(0)
    // a Team Member with no task here is not told
    expect(await mine(request, mia, 'PROJECT_UPDATED')).toHaveLength(0)
  })

  test('completing a project is announced as completed', async ({ request }) => {
    const done = await request.put(`/api/projects/${project.id}`, {
      headers: pm,
      data: { name: project.name, startDate: project.startDate, endDate: project.endDate, priority: 'HIGH', description: 'New scope', status: 'COMPLETED' },
    })
    expect(done.status()).toBe(200)

    const titles = (await mine(request, chen, 'PROJECT_UPDATED')).map((n) => n.title)
    expect(titles).toContain('Project completed')
    // reopen so the throw-away project ends in a normal state
    await request.put(`/api/projects/${project.id}`, {
      headers: pm,
      data: { name: project.name, startDate: project.startDate, endDate: project.endDate, priority: 'HIGH', description: 'New scope', status: 'IN_PROGRESS' },
    })
  })

  test('editing a milestone tells the assignees of its tasks and the leaders; completing it says so', async ({ request }) => {
    const base = { projectId: project.id, title: milestone.title, dueDate: milestone.dueDate, status: 'PENDING' }

    expect((await request.put(`/api/milestones/${milestone.id}`, { headers: pm, data: base })).status()).toBe(200)
    expect(await mine(request, chen, 'MILESTONE_UPDATED'), 'nothing changed').toHaveLength(0)

    await request.put(`/api/milestones/${milestone.id}`, { headers: pm, data: { ...base, dueDate: '2027-04-01', description: 'Moved' } })
    const toChen = await mine(request, chen, 'MILESTONE_UPDATED')
    expect(toChen).toHaveLength(1)
    expect(toChen[0].title).toBe('Milestone updated')
    expect(toChen[0].message).toContain(milestone.title)
    expect(toChen[0].message).toContain('due date')
    expect(await mine(request, owen, 'MILESTONE_UPDATED')).toHaveLength(1)
    expect(await mine(request, pm, 'MILESTONE_UPDATED'), 'the editor').toHaveLength(0)
    expect(await mine(request, mia, 'MILESTONE_UPDATED'), 'no task of hers is linked').toHaveLength(0)

    await request.put(`/api/milestones/${milestone.id}`, { headers: pm, data: { ...base, dueDate: '2027-04-01', description: 'Moved', status: 'COMPLETED' } })
    const titles = (await mine(request, chen, 'MILESTONE_UPDATED')).map((n) => n.title)
    expect(titles).toContain('Milestone completed')
  })

  test('UI: the bell shows the comment notification', async ({ page }) => {
    await login(page, 'dev.chen')
    await page.getByRole('button', { name: 'Notifications' }).click()
    await expect(page.getByText('New comment').first()).toBeVisible()
    await expect(page.getByText(new RegExp(`commented on "E2E task ${stamp}"`)).first()).toBeVisible()
  })
})
