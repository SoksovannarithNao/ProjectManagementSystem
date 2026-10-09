import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD } from './helpers.js'

// Change-plan batch 3c: the five KPIs and the seven named reports (assignment-brief.md
// B8, D-12). Every test works on its own throw-away project (owner pm.olivia) and reads
// the reports with that project's id, so other specs running in parallel cannot change
// the numbers.
//
// The project holds five tasks:
//   A  completed, due 2099 (on time)          B  completed, due 2026-02-01 (late)
//   C  To Do, due 2026-02-01 (overdue), dev.chen   D  To Do, due 2099   E  Cancelled
// so: task completion 2/4 = 50.0, overdue 1/(5-2-1) = 50.0, on time 1/2 = 50.0,
// project completion 0/1 = 0.0 (the project is In Progress).

const apiLogin = async (request, username) => {
  const res = await request.post('/api/auth/login', { data: { username, password: SEED_PASSWORD } })
  expect(res.status()).toBe(200)
  return { Authorization: `Bearer ${(await res.json()).token}` }
}

const userId = async (request, headers, username) =>
  (await (await request.get(`/api/users/username/${username}`, { headers })).json()).id

const START = '2026-01-05'

async function createProject(request, pm, name) {
  const res = await request.post('/api/projects', {
    headers: pm,
    data: { name, priority: 'LOW', status: 'IN_PROGRESS', startDate: '2026-01-01', endDate: '2099-12-31' },
  })
  expect(res.status()).toBe(201)
  return res.json()
}

async function addTask(request, pm, project, title, fields = {}) {
  const { status, ...rest } = fields
  const base = { projectId: project.id, title, priority: 'LOW', startDate: START, dueDate: '2099-01-01', estimatedHours: 4, ...rest }
  const res = await request.post('/api/tasks', { headers: pm, data: { ...base, status: 'TODO' } })
  expect(res.status()).toBe(201)
  const task = await res.json()
  if (status) {
    const put = await request.put(`/api/tasks/${task.id}`, { headers: pm, data: { ...base, status } })
    expect(put.status()).toBe(200)
  }
  return task
}

// The owner finishes tasks directly; dev.chen joins as a member and is assigned task C.
async function seed(request, pm, name) {
  const project = await createProject(request, pm, name)
  const invite = await request.post('/api/project-members/invite', {
    headers: pm,
    data: { projectId: project.id, username: 'dev.chen', projectRole: 'MEMBER' },
  })
  expect(invite.status()).toBe(201)
  const chen = await apiLogin(request, 'dev.chen')
  expect((await request.post(`/api/project-members/project/${project.id}/accept`, { headers: chen })).status()).toBe(200)

  await addTask(request, pm, project, `E2E report A ${name}`, { status: 'COMPLETED' })
  await addTask(request, pm, project, `E2E report B ${name}`, { status: 'COMPLETED', dueDate: '2026-02-01' })
  const c = await addTask(request, pm, project, `E2E report C ${name}`, { dueDate: '2026-02-01', priority: 'HIGH' })
  await addTask(request, pm, project, `E2E report D ${name}`)
  await addTask(request, pm, project, `E2E report E ${name}`, { status: 'CANCELLED' })
  const chenId = await userId(request, pm, 'dev.chen')
  expect((await request.post('/api/task-assignees', { headers: pm, data: { taskId: c.id, userId: chenId } })).status()).toBe(201)
  return { project, chenId }
}

const get = async (request, headers, path, params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return request.get(`/api/reports/${path}${qs ? `?${qs}` : ''}`, { headers })
}

test.describe.configure({ mode: 'serial' })

test.describe('reports: API', () => {
  let pm
  let fixture

  test.beforeAll(async ({ request }) => {
    pm = await apiLogin(request, 'pm.olivia')
    fixture = await seed(request, pm, `e2e reports api ${Date.now()}-${Math.floor(Math.random() * 1e6)}`)
  })

  test.afterAll(async ({ request }) => {
    if (fixture) await request.delete(`/api/projects/${fixture.project.id}`, { headers: pm })
  })

  test('the five KPIs follow the approved formulas', async ({ request }) => {
    const res = await get(request, pm, 'kpis', { projectId: fixture.project.id })
    expect(res.status()).toBe(200)
    const k = await res.json()
    expect(k.scope.projectId).toBe(fixture.project.id)
    expect(k.projectCompletionRate).toBe(0)
    expect(k.taskCompletionRate).toBe(50)
    expect(k.overdueRate).toBe(50)
    expect(k.onTimeCompletionRate).toBe(50)
    expect(k.basis).toMatchObject({ projects: 1, tasks: 5, completedTasks: 2, cancelledTasks: 1, overdueTasks: 1, completedOnTime: 1 })
    // both finished tasks started on START and were completed today
    const days = Math.round((Date.now() - Date.parse(`${START}T00:00:00Z`)) / 86400000)
    expect(Math.abs(k.averageTaskCompletionDays - days)).toBeLessThanOrEqual(1)
  })

  test('a Team Member is refused every report and the KPIs', async ({ request }) => {
    const chen = await apiLogin(request, 'dev.chen')
    for (const path of ['kpis', 'project', 'tasks', 'project-status', 'task-completion', 'overdue', 'team-performance', 'workload']) {
      const res = await get(request, chen, path, { projectId: fixture.project.id, from: '2026-01-01', to: '2026-12-31' })
      expect(res.status(), path).toBe(403)
    }
  })

  test('someone outside the project cannot read it, and the Reports gate does not depend on the page', async ({ request }) => {
    const owen = await apiLogin(request, 'lead.owen') // a Team Leader elsewhere, not in this project
    const res = await get(request, owen, 'project', { projectId: fixture.project.id })
    expect(res.status()).toBe(404)
    const admin = await apiLogin(request, 'admin.system')
    expect((await get(request, admin, 'project', { projectId: fixture.project.id })).status()).toBe(200)
    expect((await get(request, admin, 'project')).status()).toBe(400) // a project is required
  })

  test('Project Report: details, team, task counts and upcoming deadlines', async ({ request }) => {
    const r = await (await get(request, pm, 'project', { projectId: fixture.project.id })).json()
    expect(r.project.id).toBe(fixture.project.id)
    expect(r.taskCounts).toMatchObject({ total: 5, todo: 2, completed: 2, cancelled: 1, overdue: 1 })
    expect(r.team.map((m) => m.user.username)).toEqual(expect.arrayContaining(['pm.olivia', 'dev.chen']))
    // the overdue task C is listed with the deadlines that are due soon or already late
    expect(r.upcomingDeadlines.some((t) => t.title.startsWith('E2E report C'))).toBe(true)
  })

  test('Task Report filters by assignee, status, priority and due date', async ({ request }) => {
    const id = fixture.project.id
    const all = await (await get(request, pm, 'tasks', { projectId: id })).json()
    expect(all.rows).toHaveLength(5)
    const mine = await (await get(request, pm, 'tasks', { projectId: id, assigneeId: fixture.chenId })).json()
    expect(mine.rows.map((t) => t.title)).toEqual([expect.stringContaining('E2E report C')])
    expect(mine.rows[0].assignees).toContain('Chen Wu')
    const done = await (await get(request, pm, 'tasks', { projectId: id, status: 'COMPLETED' })).json()
    expect(done.rows).toHaveLength(2)
    const high = await (await get(request, pm, 'tasks', { projectId: id, priority: 'HIGH' })).json()
    expect(high.rows).toHaveLength(1)
    const early = await (await get(request, pm, 'tasks', { projectId: id, dueTo: '2026-12-31' })).json()
    expect(early.rows).toHaveLength(2) // B and C are due 2026-02-01; the rest are due in 2099
    expect((await get(request, pm, 'tasks', { projectId: id, status: 'NOPE' })).status()).toBe(400)
    expect((await get(request, pm, 'tasks', { projectId: id, dueFrom: '2026-12-31', dueTo: '2026-01-01' })).status()).toBe(400)
  })

  test('Project Status Report groups the project, and Delayed is calculated', async ({ request }) => {
    const r = await (await get(request, pm, 'project-status')).json()
    const group = (key) => r.groups.find((g) => g.key === key)
    expect(group('IN_PROGRESS').projects.some((p) => p.id === fixture.project.id)).toBe(true)
    expect(group('COMPLETED').projects.some((p) => p.id === fixture.project.id)).toBe(false)
    expect(r.groups.map((g) => g.key)).toEqual(['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'DELAYED'])
    const one = await (await get(request, pm, 'project-status', { status: 'ON_HOLD' })).json()
    expect(one.groups.every((g) => g.key === 'ON_HOLD' || g.count === 0)).toBe(true)
  })

  test('Task Completion Report needs a date range and counts completed ÷ due', async ({ request }) => {
    const id = fixture.project.id
    expect((await get(request, pm, 'task-completion', { projectId: id, groupBy: 'project' })).status()).toBe(400)
    // 2026-02-01 covers B (completed) and C (not): 1 of 2
    const r = await (await get(request, pm, 'task-completion', { projectId: id, groupBy: 'project', from: '2026-01-01', to: '2026-03-01' })).json()
    expect(r.overall).toMatchObject({ total: 2, completed: 1, percentage: 50 })
    expect(r.groups).toHaveLength(1)
    const byMember = await (await get(request, pm, 'task-completion', { projectId: id, groupBy: 'member', from: '2026-01-01', to: '2099-12-31' })).json()
    expect(byMember.overall.total).toBe(4) // the cancelled task is left out
    const byMonth = await (await get(request, pm, 'task-completion', { projectId: id, groupBy: 'month', from: '2026-01-01', to: '2099-12-31' })).json()
    expect(byMonth.groups.length).toBeGreaterThanOrEqual(2)
    expect((await get(request, pm, 'task-completion', { projectId: id, groupBy: 'colour', from: '2026-01-01', to: '2026-03-01' })).status()).toBe(400)
  })

  test('Overdue Task Report lists the late open task with its days overdue', async ({ request }) => {
    const r = await (await get(request, pm, 'overdue', { projectId: fixture.project.id })).json()
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].title).toContain('E2E report C')
    expect(r.rows[0].daysOverdue).toBeGreaterThan(0)
    const none = await (await get(request, pm, 'overdue', { projectId: fixture.project.id, priority: 'URGENT' })).json()
    expect(none.rows).toHaveLength(0)
  })

  test('Team Performance and Workload reports show every member', async ({ request }) => {
    const id = fixture.project.id
    const perf = await (await get(request, pm, 'team-performance', { projectId: id })).json()
    const chen = perf.members.find((m) => m.user.username === 'dev.chen')
    expect(chen).toMatchObject({ assigned: 1, completed: 0, todo: 1, overdue: 1, completionRate: 0 })
    const load = await (await get(request, pm, 'workload', { projectId: id })).json()
    expect(load.workload.members.some((m) => m.user.username === 'dev.chen')).toBe(true)
  })
})

test.describe('reports: UI', () => {
  test('the Reports page opens on the Overview and every tab loads', async ({ page }) => {
    await login(page, 'pm.olivia')
    await page.goto('/reports')
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Overview', selected: true })).toBeVisible()
    await expect(page.getByText('Total Tasks')).toBeVisible()

    await page.getByRole('tab', { name: 'KPIs' }).click()
    await expect(page.getByTestId('kpi-view')).toBeVisible()
    for (const id of ['kpi-project-completion', 'kpi-task-completion', 'kpi-overdue', 'kpi-days', 'kpi-on-time']) {
      await expect(page.getByTestId(id)).toBeVisible()
    }

    for (const name of ['Project Report', 'Task Report', 'Project Status', 'Task Completion', 'Overdue Tasks', 'Team Performance', 'Workload']) {
      await page.getByRole('tab', { name }).click()
      await expect(page.getByRole('tab', { name, selected: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Generate' })).toBeVisible()
    }
  })

  test('generating the Task Report, Overdue report and KPIs shows the server figures', async ({ page, request }) => {
    const pm = await apiLogin(request, 'pm.olivia')
    const { project } = await seed(request, pm, `e2e reports ui ${Date.now()}-${Math.floor(Math.random() * 1e6)}`)
    try {
      await login(page, 'pm.olivia')
      await page.goto('/reports?tab=kpis')
      await page.getByTestId('kpi-view').getByLabel('Project').selectOption({ label: project.name })
      await expect(page.getByTestId('kpi-task-completion')).toContainText('50.0%')
      await expect(page.getByTestId('kpi-overdue')).toContainText('50.0%')
      await expect(page.getByTestId('kpi-on-time')).toContainText('50.0%')
      await expect(page.getByTestId('kpi-project-completion')).toContainText('0.0%')

      await page.goto('/reports?tab=tasks')
      const tasks = page.getByTestId('report-tasks')
      await expect(tasks.getByText('Choose the filters and press Generate.')).toBeVisible()
      await tasks.getByLabel('Project').selectOption({ label: project.name })
      await tasks.getByRole('button', { name: 'Generate' }).click()
      await expect(tasks.getByTestId('report-row')).toHaveCount(5)
      await tasks.getByLabel('Status').selectOption('COMPLETED')
      await tasks.getByRole('button', { name: 'Generate' }).click()
      await expect(tasks.getByTestId('report-row')).toHaveCount(2)

      await page.goto('/reports?tab=overdue')
      const overdue = page.getByTestId('report-overdue')
      await overdue.getByLabel('Project').selectOption({ label: project.name })
      await overdue.getByRole('button', { name: 'Generate' }).click()
      await expect(overdue.getByTestId('report-row')).toHaveCount(1)
      await expect(overdue.getByTestId('report-row')).toContainText('E2E report C')
    } finally {
      await request.delete(`/api/projects/${project.id}`, { headers: pm })
    }
  })

  test('a required filter is checked before the report is requested', async ({ page }) => {
    await login(page, 'pm.olivia')
    await page.goto('/reports?tab=project')
    const report = page.getByTestId('report-project')
    await report.getByRole('button', { name: 'Generate' }).click()
    await expect(report.getByText('Choose project first.')).toBeVisible()
    await expect(report.getByTestId('report-result')).toHaveCount(0)
  })

  test('a Team Member has no Reports link', async ({ page }) => {
    await login(page, 'dev.chen')
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Reports' })).toHaveCount(0)
  })
})
