import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD } from './helpers.js'

// The headline requirement as one story (checklist #69): a Project Manager sets up a
// project, builds a team, plans a milestone and a task, the assignee does the work and
// submits it, a Team Leader approves it, progress follows, and the Project Manager
// completes the project. Every step is checked on the way, and the last one on screen.
// One throw-away project, deleted afterwards; no seeded record is touched.

const apiLogin = async (request, username) => {
  const res = await request.post('/api/auth/login', { data: { username, password: SEED_PASSWORD } })
  expect(res.status()).toBe(200)
  return { Authorization: `Bearer ${(await res.json()).token}` }
}

function isoDay(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const NAME = `E2E core workflow ${Date.now()}`

test.describe('core workflow, from a new project to a completed one', () => {
  let pm
  let project

  test.afterAll(async ({ request }) => {
    if (project) await request.delete(`/api/projects/${project.id}`, { headers: pm })
  })

  test('plan, assign, do, review, approve, complete', async ({ page, request }) => {
    pm = await apiLogin(request, 'pm.olivia')
    const leader = await apiLogin(request, 'lead.owen')
    const member = await apiLogin(request, 'dev.chen')
    const memberId = (await (await request.get('/api/users/username/dev.chen', { headers: pm })).json()).id

    // 1. a Project Manager creates the project and becomes its Owner
    const created = await request.post('/api/projects', {
      headers: pm,
      data: { name: NAME, startDate: isoDay(-2), endDate: isoDay(30), priority: 'MEDIUM', status: 'IN_PROGRESS' },
    })
    expect(created.status()).toBe(201)
    project = await created.json()
    expect(project.projectCode).toMatch(/^PRJ-\d{4}$/)
    expect(project.progress ?? 0).toBe(0)

    // 2. the team: a Team Leader and a Team Member are invited and accept
    for (const [headers, username, projectRole] of [
      [leader, 'lead.owen', 'ADMIN'],
      [member, 'dev.chen', 'MEMBER'],
    ]) {
      const invited = await request.post('/api/project-members/invite', { headers: pm, data: { projectId: project.id, username, projectRole } })
      expect(invited.status(), `invite ${username}`).toBe(201)
      expect((await request.post(`/api/project-members/project/${project.id}/accept`, { headers })).status()).toBe(200)
    }

    // 3. a milestone, and a task under it assigned to the Team Member
    const milestone = await (
      await request.post('/api/milestones', { headers: pm, data: { projectId: project.id, title: 'Launch', dueDate: isoDay(20) } })
    ).json()
    const taskBody = (status) => ({
      projectId: project.id,
      milestoneId: milestone.id,
      title: 'Build the landing page',
      priority: 'HIGH',
      status,
      startDate: isoDay(-1),
      dueDate: isoDay(10),
    })
    const taskRes = await request.post('/api/tasks', { headers: pm, data: taskBody('TODO') })
    expect(taskRes.status()).toBe(201)
    const task = await taskRes.json()
    expect((await request.post('/api/task-assignees', { headers: pm, data: { taskId: task.id, userId: memberId } })).status()).toBe(201)

    // 4. the assignee gets notified, starts the work, then submits it for review
    const assigned = await (await request.get('/api/notifications', { headers: member })).json()
    expect(assigned.some((n) => n.message.includes('Build the landing page'))).toBe(true)

    const started = await request.put(`/api/tasks/${task.id}`, { headers: member, data: taskBody('IN_PROGRESS') })
    expect(started.status()).toBe(200)
    expect((await started.json()).status).toBe('IN_PROGRESS')
    expect((await request.post(`/api/tasks/${task.id}/approval/submit`, { headers: member })).status()).toBe(201)

    // 5. the work cannot approve itself; the Team Leader approves and the task completes
    const selfApproval = await request.post(`/api/tasks/${task.id}/approval/decision`, { headers: member, data: { decision: 'APPROVED' } })
    expect(selfApproval.status()).toBe(403)
    const approved = await request.post(`/api/tasks/${task.id}/approval/decision`, { headers: leader, data: { decision: 'APPROVED', comment: 'Looks good' } })
    expect(approved.status()).toBe(200)
    const done = await (await request.get(`/api/tasks/${task.id}`, { headers: pm })).json()
    expect(done.status).toBe('COMPLETED')
    expect(Number(done.progress)).toBe(100)

    // 6. progress follows the task, up to the project and the milestone
    const afterTask = await (await request.get(`/api/projects/${project.id}`, { headers: pm })).json()
    expect(Number(afterTask.progress)).toBe(100)
    const milestones = await (await request.get(`/api/milestones/project/${project.id}`, { headers: pm })).json()
    expect(Number(milestones.find((m) => m.id === milestone.id).progress)).toBe(100)

    // 7. the reports and the KPIs count the finished work
    const report = await (await request.get(`/api/reports/project?projectId=${project.id}`, { headers: pm })).json()
    expect(report.taskCounts).toMatchObject({ total: 1, completed: 1, overdue: 0 })
    expect(report.team.map((m) => m.user.username)).toEqual(expect.arrayContaining(['pm.olivia', 'lead.owen', 'dev.chen']))
    const kpis = await (await request.get(`/api/reports/kpis?projectId=${project.id}`, { headers: pm })).json()
    expect(kpis.taskCompletionRate).toBe(100)

    // 8. the Project Manager completes the project, which stamps its completion date
    const completed = await request.put(`/api/projects/${project.id}`, {
      headers: pm,
      data: { name: NAME, startDate: isoDay(-2), endDate: isoDay(30), priority: 'MEDIUM', status: 'COMPLETED' },
    })
    expect(completed.status()).toBe(200)
    expect((await completed.json()).completedAt).toBeTruthy()

    // 9. and the project page says so
    await login(page, 'pm.olivia')
    await page.goto(`/projects/${project.id}`)
    await expect(page.getByRole('heading', { name: NAME })).toBeVisible()
    await expect(page.getByTestId('completed-on')).toContainText('Completed on')
    await expect(page.getByText('100%').first()).toBeVisible()
  })
})
