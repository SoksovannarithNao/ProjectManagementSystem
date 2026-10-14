import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD } from './helpers.js'

// Change-plan batch 2: the task approval workflow (assignment-brief.md B3.8, D-05).
// Project 1 (Website Redesign): pm.olivia is the Owner, lead.owen a Team Leader,
// dev.chen / dev.mia Team Members. Each test creates its own task and removes it.

const apiLogin = async (request, username) => {
  const res = await request.post('/api/auth/login', { data: { username, password: SEED_PASSWORD } })
  expect(res.status()).toBe(200)
  return { Authorization: `Bearer ${(await res.json()).token}` }
}

const userId = async (request, headers, username) =>
  (await (await request.get(`/api/users/username/${username}`, { headers })).json()).id

async function setup(request) {
  const pm = await apiLogin(request, 'pm.olivia')
  const leader = await apiLogin(request, 'lead.owen')
  const chen = await apiLogin(request, 'dev.chen')
  const projects = await (await request.get('/api/projects', { headers: pm })).json()
  const project = projects.find((p) => p.name === 'Website Redesign')
  expect(project, 'seeded project "Website Redesign"').toBeTruthy()
  return { pm, leader, chen, project }
}

const taskBody = (project, title, status = 'IN_PROGRESS') => ({
  projectId: project.id,
  title,
  priority: 'LOW',
  status,
  startDate: project.startDate,
  dueDate: project.endDate,
})

async function newTask(request, ctx, title, { status = 'IN_PROGRESS', assignTo = 'dev.chen' } = {}) {
  const created = await request.post('/api/tasks', { headers: ctx.pm, data: taskBody(ctx.project, title, 'TODO') })
  expect(created.status()).toBe(201)
  const task = await created.json()
  if (assignTo) {
    const uid = await userId(request, ctx.pm, assignTo)
    expect((await request.post('/api/task-assignees', { headers: ctx.pm, data: { taskId: task.id, userId: uid } })).status()).toBe(201)
  }
  if (status !== 'TODO') {
    const moved = await request.put(`/api/tasks/${task.id}`, { headers: ctx.pm, data: taskBody(ctx.project, title, status) })
    expect(moved.status()).toBe(200)
  }
  return task
}

const getTask = async (request, headers, id) => (await request.get(`/api/tasks/${id}`, { headers })).json()
const decide = (request, headers, id, data) => request.post(`/api/tasks/${id}/approval/decision`, { headers, data })
const notificationsOf = async (request, headers) => (await request.get('/api/notifications', { headers })).json()

test.describe.configure({ mode: 'serial' })

test.describe('approval workflow: API', () => {
  let ctx
  const created = []

  test.beforeAll(async ({ request }) => {
    ctx = await setup(request)
  })

  test.afterAll(async ({ request }) => {
    for (const id of created) await request.delete(`/api/tasks/${id}`, { headers: ctx.pm })
  })

  test('a member submits, a Team Leader requests changes, then approves; the task completes and the project moves', async ({ request }) => {
    const title = `E2E approval ${Date.now()}`
    const task = await newTask(request, ctx, title)
    created.push(task.id)
    const progressBefore = Number((await (await request.get(`/api/projects/${ctx.project.id}`, { headers: ctx.pm })).json()).progress)

    // the member submits for review
    const submitted = await request.post(`/api/tasks/${task.id}/approval/submit`, { headers: ctx.chen })
    expect(submitted.status()).toBe(201)
    expect((await submitted.json()).decision).toBe('PENDING')
    let current = await getTask(request, ctx.pm, task.id)
    expect(current.status).toBe('IN_REVIEW')
    expect(current.approvalStatus).toBe('PENDING')
    expect(current.approvalRequestedBy.username).toBe('dev.chen')

    // the approvers hear about it; the member does not
    const leaderNotes = await notificationsOf(request, ctx.leader)
    expect(leaderNotes.some((n) => n.type === 'APPROVAL_REQUESTED' && n.message.includes(title))).toBe(true)
    const chenNotes = await notificationsOf(request, ctx.chen)
    expect(chenNotes.some((n) => n.type === 'APPROVAL_REQUESTED' && n.message.includes(title))).toBe(false)

    // a Team Member can never decide
    expect((await decide(request, ctx.chen, task.id, { decision: 'APPROVED' })).status()).toBe(403)

    // the Team Leader sees it in the inbox
    const inbox = await (await request.get('/api/approvals/pending', { headers: ctx.leader })).json()
    expect(inbox.some((a) => a.taskId === task.id)).toBe(true)
    expect((await (await request.get('/api/approvals/pending', { headers: ctx.chen })).json()).some((a) => a.taskId === task.id)).toBe(false)

    // changes requested needs a comment, then sends the task back
    expect((await decide(request, ctx.leader, task.id, { decision: 'CHANGES_REQUESTED' })).status()).toBe(400)
    const changes = await decide(request, ctx.leader, task.id, { decision: 'CHANGES_REQUESTED', comment: 'Fix the header' })
    expect(changes.status()).toBe(200)
    current = await getTask(request, ctx.pm, task.id)
    expect(current.status).toBe('IN_PROGRESS')
    expect(current.approvalStatus).toBe('CHANGES_REQUESTED')
    const chenAfter = await notificationsOf(request, ctx.chen)
    expect(chenAfter.some((n) => n.type === 'APPROVAL_DECIDED' && n.message.includes('Fix the header'))).toBe(true)

    // submit again, approve: the task completes
    expect((await request.post(`/api/tasks/${task.id}/approval/submit`, { headers: ctx.chen })).status()).toBe(201)
    expect((await decide(request, ctx.leader, task.id, { decision: 'APPROVED', comment: 'Good' })).status()).toBe(200)
    current = await getTask(request, ctx.pm, task.id)
    expect(current.status).toBe('COMPLETED')
    expect(Number(current.progress)).toBe(100)
    expect(current.approvalStatus).toBe('APPROVED')
    const progressAfter = Number((await (await request.get(`/api/projects/${ctx.project.id}`, { headers: ctx.pm })).json()).progress)
    expect(progressAfter).toBeGreaterThan(progressBefore)

    // the trail: two requests, newest first, with who decided
    const history = await (await request.get(`/api/tasks/${task.id}/approvals`, { headers: ctx.chen })).json()
    expect(history.map((h) => h.decision)).toEqual(['APPROVED', 'CHANGES_REQUESTED'])
    expect(history[0].decidedBy.username).toBe('lead.owen')
    const activity = await (await request.get(`/api/activity-logs/task/${task.id}`, { headers: ctx.pm })).json()
    const actions = activity.map((a) => a.action)
    expect(actions).toEqual(expect.arrayContaining(['TASK_APPROVAL_REQUESTED', 'TASK_CHANGES_REQUESTED', 'TASK_APPROVED']))
  })

  test('a rejection needs a comment and a next status; the approver can cancel or reopen', async ({ request }) => {
    const task = await newTask(request, ctx, `E2E reject ${Date.now()}`)
    created.push(task.id)
    await request.post(`/api/tasks/${task.id}/approval/submit`, { headers: ctx.chen })

    expect((await decide(request, ctx.leader, task.id, { decision: 'REJECTED', comment: 'No' })).status()).toBe(400)
    expect((await decide(request, ctx.leader, task.id, { decision: 'REJECTED', nextStatus: 'CANCELLED' })).status()).toBe(400)
    expect((await decide(request, ctx.leader, task.id, { decision: 'REJECTED', comment: 'Out of scope', nextStatus: 'CANCELLED' })).status()).toBe(200)
    const current = await getTask(request, ctx.pm, task.id)
    expect(current.status).toBe('CANCELLED')
    expect(current.approvalStatus).toBe('REJECTED')
  })

  test('only a task in progress can be submitted, and only by someone allowed to change it', async ({ request }) => {
    const todo = await newTask(request, ctx, `E2E todo ${Date.now()}`, { status: 'TODO' })
    created.push(todo.id)
    expect((await request.post(`/api/tasks/${todo.id}/approval/submit`, { headers: ctx.chen })).status()).toBe(400)

    const unassigned = await newTask(request, ctx, `E2E unassigned ${Date.now()}`, { assignTo: null })
    created.push(unassigned.id)
    expect((await request.post(`/api/tasks/${unassigned.id}/approval/submit`, { headers: ctx.chen })).status()).toBe(403)
  })

  test('nobody approves their own work, except the Owner', async ({ request }) => {
    const task = await newTask(request, ctx, `E2E own work ${Date.now()}`, { assignTo: 'lead.owen' })
    created.push(task.id)
    expect((await request.post(`/api/tasks/${task.id}/approval/submit`, { headers: ctx.leader })).status()).toBe(201)

    const refused = await decide(request, ctx.leader, task.id, { decision: 'APPROVED' })
    expect(refused.status()).toBe(403)
    expect((await refused.json()).message).toContain('your own work')
    expect((await decide(request, ctx.pm, task.id, { decision: 'APPROVED' })).status()).toBe(200)
    expect((await getTask(request, ctx.pm, task.id)).status).toBe('COMPLETED')
  })

  test('a named approver: only they (or the Owner) decide; a member cannot be named', async ({ request }) => {
    const task = await newTask(request, ctx, `E2E named ${Date.now()}`, { assignTo: 'dev.mia' })
    created.push(task.id)

    const chenId = await userId(request, ctx.pm, 'dev.chen')
    expect((await request.put(`/api/tasks/${task.id}/approver`, { headers: ctx.pm, data: { approverId: chenId } })).status()).toBe(400)
    expect((await request.put(`/api/tasks/${task.id}/approver`, { headers: ctx.chen, data: { approverId: chenId } })).status()).toBe(403)

    const owenId = await userId(request, ctx.pm, 'lead.owen')
    const named = await request.put(`/api/tasks/${task.id}/approver`, { headers: ctx.pm, data: { approverId: owenId } })
    expect(named.status()).toBe(200)
    expect((await named.json()).approver.username).toBe('lead.owen')

    const mia = await apiLogin(request, 'dev.mia')
    await request.post(`/api/tasks/${task.id}/approval/submit`, { headers: mia })
    const review = await getTask(request, ctx.pm, task.id)
    expect(review.approver.username).toBe('lead.owen')
    expect((await decide(request, ctx.leader, task.id, { decision: 'CHANGES_REQUESTED', comment: 'One more thing' })).status()).toBe(200)

    // clearing the approver works
    const cleared = await request.put(`/api/tasks/${task.id}/approver`, { headers: ctx.pm, data: { approverId: null } })
    expect((await cleared.json()).approver).toBeNull()
  })

  test('an approver who completes a task directly counts as approving it; moving a task out of review withdraws the request', async ({ request }) => {
    const direct = await newTask(request, ctx, `E2E direct ${Date.now()}`)
    created.push(direct.id)
    expect((await request.put(`/api/tasks/${direct.id}`, { headers: ctx.pm, data: taskBody(ctx.project, direct.title, 'COMPLETED') })).status()).toBe(200)
    const history = await (await request.get(`/api/tasks/${direct.id}/approvals`, { headers: ctx.pm })).json()
    expect(history).toHaveLength(1)
    expect(history[0].decision).toBe('APPROVED')
    expect(history[0].decidedBy.username).toBe('pm.olivia')

    const task = await newTask(request, ctx, `E2E withdraw ${Date.now()}`)
    created.push(task.id)
    expect((await request.put(`/api/tasks/${task.id}`, { headers: ctx.chen, data: taskBody(ctx.project, task.title, 'IN_REVIEW') })).status()).toBe(200)
    expect((await getTask(request, ctx.pm, task.id)).approvalStatus).toBe('PENDING')
    expect((await request.put(`/api/tasks/${task.id}`, { headers: ctx.chen, data: taskBody(ctx.project, task.title, 'IN_PROGRESS') })).status()).toBe(200)
    expect((await getTask(request, ctx.pm, task.id)).approvalStatus).toBe('WITHDRAWN')
    expect((await decide(request, ctx.leader, task.id, { decision: 'APPROVED' })).status()).toBe(400)
  })

  test('approving is refused while a subtask is open', async ({ request }) => {
    const task = await newTask(request, ctx, `E2E subtask ${Date.now()}`)
    created.push(task.id)
    await request.post('/api/subtasks', { headers: ctx.pm, data: { taskId: task.id, title: 'still to do', status: 'TODO' } })
    await request.post(`/api/tasks/${task.id}/approval/submit`, { headers: ctx.chen })

    const refused = await decide(request, ctx.leader, task.id, { decision: 'APPROVED' })
    expect(refused.status()).toBe(400)
    expect((await refused.json()).message).toContain('Complete all subtasks')
    expect((await getTask(request, ctx.pm, task.id)).status).toBe('IN_REVIEW')
  })
})

test.describe('approval workflow: UI', () => {
  test('a member submits for review in the task panel; a Team Leader approves it from the inbox', async ({ page, browser, request }) => {
    const ctx = await setup(request)
    const title = `E2E approval UI ${Date.now()}`
    const task = await newTask(request, ctx, title)
    try {
      // --- the member
      await login(page, 'dev.chen')
      await page.goto('/tasks')
      await page.getByTestId('task-row').filter({ hasText: title }).click()
      const section = page.getByTestId('approval-section')
      await expect(section).toBeVisible()
      await expect(section.getByRole('button', { name: 'Approve' })).toHaveCount(0)
      await section.getByRole('button', { name: 'Submit for review' }).click()
      await expect(page.getByText('Submitted for review')).toBeVisible()
      await expect(section.getByText(/Awaiting approval/)).toBeVisible()
      await expect(section.getByRole('button', { name: 'Submit for review' })).toHaveCount(0)
      await expect(section.getByRole('button', { name: 'Approve' })).toHaveCount(0)

      // --- the Team Leader, in a separate browser session
      const leaderContext = await browser.newContext()
      const leaderPage = await leaderContext.newPage()
      await login(leaderPage, 'lead.owen')
      await leaderPage.goto('/tasks')
      const inbox = leaderPage.getByTestId('pending-approvals')
      await expect(inbox).toBeVisible()
      await inbox.getByRole('button', { name: new RegExp(title) }).click()

      const leaderSection = leaderPage.getByTestId('approval-section')
      await expect(leaderSection.getByText(/Awaiting approval/)).toBeVisible()
      // changes and rejection need a comment
      await leaderSection.getByRole('button', { name: 'Request changes' }).click()
      await expect(leaderPage.getByText('Say what has to change.')).toBeVisible()
      await leaderSection.getByLabel('Approval comment').fill('Looks good')
      await leaderSection.getByRole('button', { name: 'Approve', exact: true }).click()
      await expect(leaderPage.getByText(/Approved/).first()).toBeVisible()

      await expect.poll(async () => (await getTask(request, ctx.pm, task.id)).status).toBe('COMPLETED')
      const current = await getTask(request, ctx.pm, task.id)
      expect(current.approvalStatus).toBe('APPROVED')
      await leaderContext.close()
    } finally {
      await request.delete(`/api/tasks/${task.id}`, { headers: ctx.pm })
    }
  })

  test('a Team Leader requests changes with a comment; the member sees it on the task', async ({ page, request }) => {
    const ctx = await setup(request)
    const title = `E2E changes UI ${Date.now()}`
    const task = await newTask(request, ctx, title)
    try {
      await request.post(`/api/tasks/${task.id}/approval/submit`, { headers: ctx.chen })

      await login(page, 'lead.owen')
      await page.goto('/tasks')
      await page.getByTestId('pending-approvals').getByRole('button', { name: new RegExp(title) }).click()
      const section = page.getByTestId('approval-section')
      await section.getByLabel('Approval comment').fill('Please add tests')
      await section.getByRole('button', { name: 'Request changes' }).click()
      await expect(page.getByText('Changes requested').first()).toBeVisible()

      const current = await getTask(request, ctx.pm, task.id)
      expect(current.status).toBe('IN_PROGRESS')
      expect(current.approvalStatus).toBe('CHANGES_REQUESTED')
      const history = await (await request.get(`/api/tasks/${task.id}/approvals`, { headers: ctx.chen })).json()
      expect(history[0].comment).toBe('Please add tests')
    } finally {
      await request.delete(`/api/tasks/${task.id}`, { headers: ctx.pm })
    }
  })
})
