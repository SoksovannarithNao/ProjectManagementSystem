import { test, expect } from '@playwright/test'
import { login } from './helpers.js'
import { apiLogin } from './kanban-helpers.js'

// A COMPLETED project takes nothing new (tasks, milestones, subtasks, checklist items, comments, time entries,
// files, dependencies) until it is reopened, and a COMPLETED task takes no new subtask, checklist item, comment,
// time entry, file or dependency. The server refuses them (409), a task cannot be moved into a completed project
// either, the screens do not offer the controls (project page, task panel, Kanban board), and the existing
// work stays editable. Everything here uses throw-away projects of pm.olivia.

const body = (name, status) => ({ name, priority: 'LOW', status, startDate: '2026-01-01', endDate: '2026-12-31' })
const taskBody = (projectId, title) => ({ projectId, title, priority: 'LOW', status: 'TODO', startDate: '2026-10-01', dueDate: '2026-10-20' })

test.describe('a completed project takes no new tasks or subtasks', () => {
  let headers
  let stamp
  const projects = []

  const makeProject = async (request, label, status = 'IN_PROGRESS') => {
    const res = await request.post('/api/projects', { headers, data: body(`${label} ${stamp}`, status) })
    expect(res.status()).toBe(201)
    const project = await res.json()
    projects.push(project.id)
    return project
  }
  const setStatus = async (request, project, status) => {
    const res = await request.put(`/api/projects/${project.id}`, { headers, data: { ...body(project.name, status) } })
    expect(res.status()).toBe(200)
  }

  test.beforeEach(async ({ request }) => {
    headers = await apiLogin(request, 'pm.olivia')
    stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  })

  test.afterEach(async ({ request }) => {
    for (const id of projects.splice(0)) await request.delete(`/api/projects/${id}`, { headers })
  })

  test('the server refuses a new task, a new subtask and a task moved in, and accepts them again once reopened', async ({ request }) => {
    const done = await makeProject(request, 'done')
    const open = await makeProject(request, 'open')
    const inside = await (await request.post('/api/tasks', { headers, data: taskBody(done.id, `inside ${stamp}`) })).json()
    const inside2 = await (await request.post('/api/tasks', { headers, data: taskBody(done.id, `inside two ${stamp}`) })).json()
    const outside = await (await request.post('/api/tasks', { headers, data: taskBody(open.id, `outside ${stamp}`) })).json()
    await setStatus(request, done, 'COMPLETED')

    const newTask = await request.post('/api/tasks', { headers, data: taskBody(done.id, 'late') })
    expect(newTask.status()).toBe(409)
    expect((await newTask.json()).message).toContain('completed')

    const newSubtask = await request.post('/api/subtasks', { headers, data: { taskId: inside.id, title: 'late', status: 'TODO' } })
    expect(newSubtask.status()).toBe(409)

    const newMilestone = await request.post('/api/milestones', { headers, data: { projectId: done.id, title: 'late', dueDate: '2026-06-01' } })
    expect(newMilestone.status()).toBe(409)
    expect((await newMilestone.json()).message).toContain('milestones')

    const newItem = await request.post('/api/checklist-items', { headers, data: { taskId: inside.id, content: 'late' } })
    expect(newItem.status()).toBe(409)
    expect((await newItem.json()).message).toContain('checklist')

    const newComment = await request.post('/api/comments', { headers, data: { taskId: inside.id, message: 'late' } })
    expect(newComment.status()).toBe(409)
    const newTime = await request.post('/api/work-logs', { headers, data: { taskId: inside.id, workDate: '2026-10-10', hoursWorked: 1 } })
    expect(newTime.status()).toBe(409)

    const newDependency = await request.post('/api/task-dependencies', { headers, data: { taskId: inside.id, dependsOnTaskId: inside2.id } })
    expect(newDependency.status()).toBe(409)
    expect((await newDependency.json()).message).toContain('dependencies')

    const moved = await request.put(`/api/tasks/${outside.id}`, { headers, data: taskBody(done.id, outside.title) })
    expect(moved.status()).toBe(409)

    // existing work stays editable
    const renamed = await request.put(`/api/tasks/${inside.id}`, { headers, data: taskBody(done.id, `renamed ${stamp}`) })
    expect(renamed.status()).toBe(200)

    await setStatus(request, done, 'IN_PROGRESS')
    expect((await request.post('/api/tasks', { headers, data: taskBody(done.id, 'again') })).status()).toBe(201)
    expect((await request.post('/api/subtasks', { headers, data: { taskId: inside.id, title: 'again', status: 'TODO' } })).status()).toBe(201)
    expect((await request.post('/api/milestones', { headers, data: { projectId: done.id, title: 'again', dueDate: '2026-06-01' } })).status()).toBe(201)
    expect((await request.post('/api/checklist-items', { headers, data: { taskId: inside.id, content: 'again' } })).status()).toBe(201)
    expect((await request.post('/api/comments', { headers, data: { taskId: inside.id, message: 'again' } })).status()).toBe(201)
    expect((await request.post('/api/work-logs', { headers, data: { taskId: inside.id, workDate: '2026-10-10', hoursWorked: 1 } })).status()).toBe(201)
    expect((await request.post('/api/task-dependencies', { headers, data: { taskId: inside.id, dependsOnTaskId: inside2.id } })).status()).toBe(201)
  })

  test('a completed task takes no new subtask until it is reopened', async ({ request }) => {
    const open = await makeProject(request, 'task')
    const task = await (await request.post('/api/tasks', { headers, data: taskBody(open.id, `finished ${stamp}`) })).json()
    const other = await (await request.post('/api/tasks', { headers, data: taskBody(open.id, `other ${stamp}`) })).json()
    const complete = await request.put(`/api/tasks/${task.id}`, { headers, data: { ...taskBody(open.id, task.title), status: 'COMPLETED' } })
    expect(complete.status()).toBe(200)

    const refused = await request.post('/api/subtasks', { headers, data: { taskId: task.id, title: 'late', status: 'TODO' } })
    expect(refused.status()).toBe(409)
    expect((await refused.json()).message).toContain('task is completed')
    expect((await request.post('/api/checklist-items', { headers, data: { taskId: task.id, content: 'late' } })).status()).toBe(409)
    expect((await request.post('/api/comments', { headers, data: { taskId: task.id, message: 'late' } })).status()).toBe(409)
    expect((await request.post('/api/task-dependencies', { headers, data: { taskId: task.id, dependsOnTaskId: other.id } })).status()).toBe(409)
    // a completed task can still be a prerequisite of an open one
    expect((await request.post('/api/task-dependencies', { headers, data: { taskId: other.id, dependsOnTaskId: task.id } })).status()).toBe(201)
    expect((await request.post('/api/work-logs', { headers, data: { taskId: task.id, workDate: '2026-10-10', hoursWorked: 1 } })).status()).toBe(409)

    const reopen = await request.put(`/api/tasks/${task.id}`, { headers, data: { ...taskBody(open.id, task.title), status: 'IN_PROGRESS' } })
    expect(reopen.status()).toBe(200)
    expect((await request.post('/api/subtasks', { headers, data: { taskId: task.id, title: 'again', status: 'TODO' } })).status()).toBe(201)
    expect((await request.post('/api/checklist-items', { headers, data: { taskId: task.id, content: 'again' } })).status()).toBe(201)
  })

  test('the project page offers no Add Task and its task panel no subtask box until the project is reopened', async ({ page, request }) => {
    const done = await makeProject(request, 'screen')
    const task = await (await request.post('/api/tasks', { headers, data: taskBody(done.id, `screen task ${stamp}`) })).json()
    await request.post('/api/tasks', { headers, data: taskBody(done.id, `screen other ${stamp}`) }) // something to depend on
    await setStatus(request, done, 'COMPLETED')

    await login(page, 'pm.olivia')
    await page.goto(`/projects/${done.id}`)
    await expect(page.getByRole('heading', { name: done.name })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Task' })).toHaveCount(0)
    await expect(page.getByTestId('completed-notice')).toContainText('nothing new can be added')
    await expect(page.getByPlaceholder('Milestone title…')).toHaveCount(0)

    await page.getByTestId('task-row').filter({ hasText: task.title }).click()
    await expect(page.getByTestId('completed-notice')).toHaveCount(2) // the project page and the task panel each have one
    await expect(page.getByPlaceholder('Add a subtask...')).toHaveCount(0)
    await expect(page.getByPlaceholder('Add a checklist item...')).toHaveCount(0)
    await expect(page.getByPlaceholder(/^Add a comment/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Start timer' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Log time' })).toHaveCount(0)
    await expect(page.getByText('Depends on')).toBeVisible()
    await expect(page.locator('option', { hasText: 'Select a task' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    // reopening from the status box brings the controls back, without a reload
    await page.getByLabel('Project status').selectOption('IN_PROGRESS')
    await expect(page.getByRole('button', { name: 'Add Task' })).toBeVisible()
    await expect(page.getByPlaceholder('Milestone title…')).toBeVisible()
  })

  test('a completed task shows no subtask box in its panel, also on the Kanban board', async ({ page, request }) => {
    const open = await makeProject(request, 'panel')
    const task = await (await request.post('/api/tasks', { headers, data: taskBody(open.id, `done task ${stamp}`) })).json()
    await request.put(`/api/tasks/${task.id}`, { headers, data: { ...taskBody(open.id, task.title), status: 'COMPLETED' } })

    await login(page, 'pm.olivia')
    await page.goto('/kanban')
    await page.getByPlaceholder('Search tasks').fill(task.title)
    await page.getByTestId('kanban-card').filter({ hasText: task.title }).locator('[role="button"]').first().click()
    await expect(page.getByTestId('completed-notice')).toContainText('This task is completed')
    await expect(page.getByPlaceholder('Add a subtask...')).toHaveCount(0)
    await expect(page.getByPlaceholder('Add a checklist item...')).toHaveCount(0)
    await expect(page.getByPlaceholder(/^Add a comment/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Start timer' })).toHaveCount(0)
  })

  test('the Kanban board offers no new task while only a completed project is in view', async ({ page, request }) => {
    const done = await makeProject(request, 'board', 'COMPLETED')
    const open = await makeProject(request, 'boardopen')
    await login(page, 'pm.olivia')
    await page.goto('/kanban')
    await expect(page.getByRole('button', { name: 'New Task' })).toBeVisible()

    await page.getByRole('button', { name: /^Filter/ }).click()
    await page.locator('select').filter({ has: page.locator(`option[value="${done.id}"]`) }).selectOption(String(done.id))
    await expect(page.getByRole('button', { name: 'New Task' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add task' })).toHaveCount(0)

    await page.locator('select').filter({ has: page.locator(`option[value="${open.id}"]`) }).selectOption(String(open.id))
    await expect(page.getByRole('button', { name: 'New Task' })).toBeVisible()
  })

  test('a timer that was running when its task was completed can only be discarded', async ({ page, request }) => {
    const open = await makeProject(request, 'timer')
    const task = await (await request.post('/api/tasks', { headers, data: taskBody(open.id, `timed ${stamp}`) })).json()
    await login(page, 'pm.olivia')
    // the timer is kept in the browser, one per user: start one on this task, then complete the task
    const me = await (await request.get('/api/users/username/pm.olivia', { headers })).json()
    await page.evaluate(
      ({ key, id, title }) => localStorage.setItem(key, JSON.stringify({ taskId: id, title, startedAt: Date.now() - 120000 })),
      { key: `taskflow.timer.${me.id}`, id: task.id, title: task.title }
    )
    await request.put(`/api/tasks/${task.id}`, { headers, data: { ...taskBody(open.id, task.title), status: 'COMPLETED' } })

    await page.goto(`/projects/${open.id}`)
    await page.getByTestId('task-row').filter({ hasText: task.title }).click()
    await expect(page.getByRole('button', { name: /^Stop/ })).toHaveCount(0)
    await expect(page.getByText('A timer was running on this task')).toBeVisible()
    await page.getByRole('button', { name: 'Discard timer' }).click()
    await expect(page.getByText('A timer was running on this task')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Start timer' })).toHaveCount(0)
  })

  test('Tasks offers no new task while only a completed project is in view', async ({ page, request }) => {
    const done = await makeProject(request, 'tasksfilter', 'COMPLETED')
    await login(page, 'pm.olivia')
    await page.goto('/tasks')
    await expect(page.getByRole('button', { name: 'New Task' })).toBeVisible()
    await page.getByRole('button', { name: /^Filter/ }).click()
    await page.locator('select').filter({ has: page.locator(`option[value="${done.id}"]`) }).selectOption(String(done.id))
    await expect(page.getByRole('button', { name: 'New Task' })).toHaveCount(0)
  })

  test('the new-task form does not list a completed project', async ({ page, request }) => {
    const done = await makeProject(request, 'hidden', 'COMPLETED')
    const open = await makeProject(request, 'shown')
    await login(page, 'pm.olivia')
    await page.goto('/tasks')
    await page.getByRole('button', { name: 'New Task' }).first().click()
    const select = page.locator('select').filter({ has: page.locator(`option[value="${open.id}"]`) })
    await expect(select).toBeVisible()
    await expect(select.locator(`option[value="${done.id}"]`)).toHaveCount(0)
  })
})
