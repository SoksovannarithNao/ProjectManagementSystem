import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD } from './helpers.js'

// Closes six rows of docs/checklist/partially_done.md in one go: milestone editing (#34),
// milestones on the calendar (#37), the My Tasks quick views (#31), the near-deadline flag
// (#30b) and the project completion date (#23, #60, #69).
//
// Everything runs against one throw-away project owned by pm.olivia (a Project Manager and,
// as its creator, the project's Owner), deleted afterwards; nothing seeded is touched.

const apiLogin = async (request, username) => {
  const res = await request.post('/api/auth/login', { data: { username, password: SEED_PASSWORD } })
  expect(res.status()).toBe(200)
  return { Authorization: `Bearer ${(await res.json()).token}` }
}

// A calendar date in the browser's local time, `offset` days from today (the app compares
// calendar dates, so the string is all that matters).
function isoDay(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const stamp = Date.now()
const NAME = `E2E quick wins ${stamp}`

test.describe.configure({ mode: 'serial' })

test.describe('quick wins', () => {
  let pm
  let project
  const task = {}
  let milestone

  const newTask = async (request, key, dueOffset, extra = {}) => {
    const res = await request.post('/api/tasks', {
      headers: pm,
      data: {
        projectId: project.id,
        title: `E2E ${key} ${stamp}`,
        priority: 'LOW',
        status: 'TODO',
        startDate: isoDay(-10),
        dueDate: isoDay(dueOffset),
        ...extra,
      },
    })
    expect(res.status(), `create task ${key}`).toBe(201)
    task[key] = await res.json()
  }

  const putProject = async (request, status) => {
    const res = await request.put(`/api/projects/${project.id}`, {
      headers: pm,
      data: { name: NAME, startDate: isoDay(-10), endDate: isoDay(60), priority: 'LOW', status },
    })
    expect(res.status()).toBe(200)
    return res.json()
  }

  test.beforeAll(async ({ request }) => {
    pm = await apiLogin(request, 'pm.olivia')
    const created = await request.post('/api/projects', {
      headers: pm,
      data: { name: NAME, startDate: isoDay(-10), endDate: isoDay(60), priority: 'LOW', status: 'IN_PROGRESS' },
    })
    expect(created.status()).toBe(201)
    project = await created.json()

    // a milestone due in five days that has one open task linked to it
    const ms = await request.post('/api/milestones', {
      headers: pm,
      data: { projectId: project.id, title: `E2E milestone ${stamp}`, dueDate: isoDay(5) },
    })
    expect(ms.status()).toBe(201)
    milestone = await ms.json()

    await newTask(request, 'today', 0)
    await newTask(request, 'soon', 1)
    await newTask(request, 'later', 10)
    await newTask(request, 'late', -5)
    await newTask(request, 'linked', 7, { milestoneId: milestone.id })
  })

  test.afterAll(async ({ request }) => {
    if (project) await request.delete(`/api/projects/${project.id}`, { headers: pm })
  })

  // ---------------------------------------------------------------- API

  test('API: a project has a completion date only while it is completed', async ({ request }) => {
    expect(project.completedAt ?? null).toBeNull()

    const done = await putProject(request, 'COMPLETED')
    expect(done.status).toBe('COMPLETED')
    expect(done.completedAt, 'stamped by the database and returned by the same PUT').toBeTruthy()

    // editing a completed project keeps the original date
    const edited = await request.put(`/api/projects/${project.id}`, {
      headers: pm,
      data: { name: NAME, description: 'edited while completed', startDate: isoDay(-10), endDate: isoDay(60), priority: 'LOW', status: 'COMPLETED' },
    })
    expect((await edited.json()).completedAt).toBe(done.completedAt)

    // the Project Report and the Project Status Report carry it
    const report = await (await request.get(`/api/reports/project?projectId=${project.id}`, { headers: pm })).json()
    expect(report.project.completedAt).toBe(done.completedAt)
    const status = await (await request.get(`/api/reports/project-status?status=COMPLETED`, { headers: pm })).json()
    const row = status.groups.flatMap((g) => g.projects).find((p) => p.id === project.id)
    expect(row?.completedAt).toBe(done.completedAt)

    // reopening clears it
    const reopened = await putProject(request, 'IN_PROGRESS')
    expect(reopened.completedAt ?? null).toBeNull()
    expect((await (await request.get(`/api/projects/${project.id}`, { headers: pm })).json()).completedAt ?? null).toBeNull()
  })

  test('API: an open task is "due soon" from today until three days ahead, never when overdue or far off', async ({ request }) => {
    const get = async (t) => (await request.get(`/api/tasks/${t.id}`, { headers: pm })).json()

    const soon = await get(task.soon)
    expect(soon.dueSoon).toBe(true)
    expect(soon.overdue).toBe(false)

    const later = await get(task.later)
    expect(later.dueSoon, 'ten days away').toBe(false)

    const late = await get(task.late)
    expect(late.overdue).toBe(true)
    expect(late.dueSoon, 'overdue is its own state').toBe(false)

    // a finished task is never flagged
    const cancelled = await request.put(`/api/tasks/${task.soon.id}`, {
      headers: pm,
      data: { projectId: project.id, title: soon.title, priority: 'LOW', status: 'CANCELLED', startDate: soon.startDate, dueDate: soon.dueDate },
    })
    expect(cancelled.status()).toBe(200)
    expect((await get(task.soon)).dueSoon).toBe(false)
    await request.put(`/api/tasks/${task.soon.id}`, {
      headers: pm,
      data: { projectId: project.id, title: soon.title, priority: 'LOW', status: 'TODO', startDate: soon.startDate, dueDate: soon.dueDate },
    })
    expect((await get(task.soon)).dueSoon).toBe(true)
  })

  test('API: a milestone update replaces its text and status but keeps what it did not send', async ({ request }) => {
    const res = await request.put(`/api/milestones/${milestone.id}`, {
      headers: pm,
      data: { projectId: project.id, title: milestone.title, description: 'Kick-off done', dueDate: milestone.dueDate, status: 'IN_PROGRESS' },
    })
    expect(res.status()).toBe(200)
    const updated = await res.json()
    expect(updated.description).toBe('Kick-off done')
    expect(updated.status).toBe('IN_PROGRESS')
    expect(updated.dueDate).toBe(milestone.dueDate)
    milestone = updated
  })

  // ---------------------------------------------------------------- UI

  test('UI: the project page says when the project was completed', async ({ page }) => {
    await login(page, 'pm.olivia')
    await page.goto(`/projects/${project.id}`)
    await expect(page.getByTestId('completed-on')).toHaveCount(0)

    await page.getByLabel('Project status').selectOption('COMPLETED')
    const chip = page.getByTestId('completed-on')
    await expect(chip).toBeVisible()
    await expect(chip).toContainText(`Completed on`)
    await expect(chip).toContainText(String(new Date().getFullYear()))

    await page.getByLabel('Project status').selectOption('IN_PROGRESS')
    await expect(page.getByTestId('completed-on')).toHaveCount(0)
  })

  test('UI: the project page and the task panel show the created date', async ({ page }) => {
    const year = String(new Date().getFullYear())
    await login(page, 'pm.olivia')
    await page.goto(`/projects/${project.id}`)
    await expect(page.getByTestId('project-created')).toContainText(year)

    await page.goto('/tasks')
    await page.getByTestId('task-row').filter({ hasText: task.linked.title }).click()
    await expect(page.getByTestId('task-created')).toContainText(year)
    // the start date is shown beside the due date (the helper creates the task with a start ten days back)
    await expect(page.getByTestId('task-start-date')).not.toHaveText('—')
  })

  test('UI: a milestone can be edited, with a warning when completing it leaves tasks open', async ({ page, request }) => {
    await login(page, 'pm.olivia')
    await page.goto(`/projects/${project.id}`)

    const row = page.getByTestId('milestone-row').filter({ hasText: milestone.title })
    await expect(row).toBeVisible()
    await expect(row.getByText('Kick-off done')).toBeVisible()

    await row.getByRole('button', { name: `Edit milestone ${milestone.title}` }).click()
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(milestone.title)

    await page.getByLabel('Description (optional)').fill('Signed off by the client')
    await expect(page.getByTestId('milestone-open-tasks-warning')).toHaveCount(0)
    await page.getByLabel('Milestone status').selectOption('COMPLETED')
    await expect(page.getByTestId('milestone-open-tasks-warning')).toContainText('1 linked task is still open')
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    // the success toast is joined by a warning toast naming the open task
    await expect(page.getByText('1 linked task is still open and was not changed')).toBeVisible()
    await expect(row.getByText('Signed off by the client')).toBeVisible()
    await expect(row.getByText('Completed', { exact: true })).toBeVisible()

    // saved on the server; the linked task was not touched
    const saved = await (await request.get(`/api/milestones/${milestone.id}`, { headers: pm })).json()
    expect(saved.description).toBe('Signed off by the client')
    expect(saved.status).toBe('COMPLETED')
    const linked = await (await request.get(`/api/tasks/${task.linked.id}`, { headers: pm })).json()
    expect(linked.status).toBe('TODO')
  })

  test('UI: the calendar shows a milestone on its due date', async ({ page, request }) => {
    const today = await request.post('/api/milestones', {
      headers: pm,
      data: { projectId: project.id, title: `E2E calendar milestone ${stamp}`, dueDate: isoDay(0) },
    })
    expect(today.status()).toBe(201)

    await login(page, 'pm.olivia')
    await page.goto('/calendar')
    const chip = page.getByTestId('calendar-milestone').filter({ hasText: `E2E calendar milestone ${stamp}` })
    await expect(chip).toBeVisible()
    await expect(chip).toContainText('Milestone:') // announced as a milestone, not only drawn differently

    await page.getByRole('button', { name: 'Day', exact: true }).click()
    await expect(page.getByTestId('calendar-milestone').filter({ hasText: `E2E calendar milestone ${stamp}` })).toBeVisible()
  })

  test('UI: Tasks has quick views for Today, Upcoming and Overdue, and flags tasks that are due soon', async ({ page }) => {
    await login(page, 'pm.olivia')
    await page.goto('/tasks')
    const mine = (key) => page.getByTestId('task-row').filter({ hasText: task[key].title })

    // All: every task of the throw-away project is listed; the near one carries the flag
    await expect(mine('today')).toBeVisible()
    await expect(mine('soon').getByTestId('due-soon-badge')).toContainText('Due tomorrow')
    await expect(mine('today').getByTestId('due-soon-badge')).toContainText('Due today')
    await expect(mine('later').getByTestId('due-soon-badge')).toHaveCount(0)
    await expect(mine('late').getByTestId('due-soon-badge')).toHaveCount(0)

    await page.getByTestId('quick-view-today').click()
    await expect(mine('today')).toBeVisible()
    await expect(mine('soon')).toHaveCount(0)
    await expect(mine('late')).toHaveCount(0)

    await page.getByTestId('quick-view-upcoming').click()
    await expect(mine('soon')).toBeVisible()
    await expect(mine('later')).toBeVisible()
    await expect(mine('today')).toHaveCount(0)
    await expect(mine('late')).toHaveCount(0)

    await page.getByTestId('quick-view-overdue').click()
    await expect(mine('late')).toBeVisible()
    await expect(mine('later')).toHaveCount(0)

    // the chips show how many tasks each view holds
    await expect(page.getByTestId('quick-view-overdue')).toContainText(/\d+/)

    await page.getByTestId('quick-view-all').click()
    await expect(mine('later')).toBeVisible()
  })
})
