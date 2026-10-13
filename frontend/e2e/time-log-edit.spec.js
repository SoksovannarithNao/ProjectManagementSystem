import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD } from './helpers.js'

// Checklist items #9 and #15: a time entry can be changed by the person who logged it, and
// logging, changing and deleting one is written to the task's activity feed. Everything runs on
// a throw-away project owned by pm.olivia, so the seeded data is not touched.

const apiLogin = async (request, username) => {
  const res = await request.post('/api/auth/login', { data: { username, password: SEED_PASSWORD } })
  expect(res.status()).toBe(200)
  return { Authorization: `Bearer ${(await res.json()).token}` }
}

const feed = async (request, headers, taskId) =>
  (await (await request.get(`/api/activity-logs/task/${taskId}`, { headers })).json()).map((a) => a.action)

test.describe.configure({ mode: 'serial' })

test.describe('changing a time entry', () => {
  let pm
  let project
  let task

  test.beforeAll(async ({ request }) => {
    pm = await apiLogin(request, 'pm.olivia')
    const p = await request.post('/api/projects', {
      headers: pm,
      data: { name: `e2e time log ${Date.now()}-${Math.floor(Math.random() * 1e6)}`, priority: 'LOW', status: 'IN_PROGRESS', startDate: '2026-01-01', endDate: '2099-12-31' },
    })
    expect(p.status()).toBe(201)
    project = await p.json()
    const t = await request.post('/api/tasks', {
      headers: pm,
      data: { projectId: project.id, title: 'E2E time log task', priority: 'LOW', status: 'TODO', startDate: '2026-01-05', dueDate: '2099-01-01', estimatedHours: 8 },
    })
    expect(t.status()).toBe(201)
    task = await t.json()
  })

  test.afterAll(async ({ request }) => {
    if (project) await request.delete(`/api/projects/${project.id}`, { headers: pm })
  })

  test('the author changes an entry from the task panel, and each step is in the activity feed', async ({ page, request }) => {
    await login(page, 'pm.olivia')
    await page.goto(`/projects/${project.id}`)
    await page.getByTestId('task-row').first().click()
    await expect(page.getByRole('heading', { name: 'Time tracking', exact: true })).toBeVisible()

    await page.getByLabel('Time spent').fill('1h')
    await page.getByLabel('What did you work on? (optional)').fill('first pass')
    await page.getByRole('button', { name: 'Log time' }).click()
    const entries = page.getByRole('list', { name: 'Time entries' })
    const entry = entries.getByRole('listitem').filter({ hasText: 'first pass' })
    await expect(entry).toContainText('1h')

    // change it: the pencil opens the entry as a small form
    await entry.getByRole('button', { name: /^Change 1h entry/ }).click()
    const form = entries.getByRole('form', { name: 'Change time entry' })
    await form.getByLabel('Time spent').fill('2h 30m')
    await form.getByLabel('Note (optional)').fill('second pass')
    await form.getByRole('button', { name: 'Save' }).click()
    const changed = entries.getByRole('listitem').filter({ hasText: 'second pass' })
    await expect(changed).toContainText('2h 30m')
    await expect(page.getByText('first pass')).toHaveCount(0)

    // a bad time is refused on the form and nothing is saved
    await changed.getByRole('button', { name: /^Change 2h 30m entry/ }).click()
    await form.getByLabel('Time spent').fill('banana')
    await form.getByRole('button', { name: 'Save' }).click()
    await expect(form.getByText('Enter a time like 1.5, 1h 30m or 45m.')).toBeVisible()
    await form.getByRole('button', { name: 'Cancel' }).click()
    await expect(changed).toContainText('2h 30m')

    expect(await feed(request, pm, task.id)).toEqual(expect.arrayContaining(['WORK_LOGGED', 'WORK_LOG_UPDATED']))

    await changed.getByRole('button', { name: /^Delete 2h 30m entry/ }).click()
    await changed.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByText('second pass')).toHaveCount(0)

    const actions = await feed(request, pm, task.id)
    expect(actions).toEqual(expect.arrayContaining(['WORK_LOGGED', 'WORK_LOG_UPDATED', 'WORK_LOG_DELETED']))
    const descriptions = (await (await request.get(`/api/activity-logs/task/${task.id}`, { headers: pm })).json()).map((a) => a.description)
    expect(descriptions).toContain(`Changed a time entry from 1 h on ${new Date().toLocaleDateString('en-CA')} (first pass) to 2.5 h on ${new Date().toLocaleDateString('en-CA')} (second pass)`)
  })

  test('only the author may change an entry, it cannot move to another task, and the feed shows it in the project', async ({ request }) => {
    const log = await (await request.post('/api/work-logs', {
      headers: pm,
      data: { taskId: task.id, workDate: new Date().toLocaleDateString('en-CA'), hoursWorked: 1, description: 'mine' },
    })).json()
    const body = { taskId: task.id, workDate: log.workDate, hoursWorked: 3, description: 'taken over' }

    // not even an Administrator changes someone else's entry
    const admin = await apiLogin(request, 'admin.system')
    const refused = await request.put(`/api/work-logs/${log.id}`, { headers: admin, data: body })
    expect(refused.status()).toBe(403)
    expect((await refused.json()).message).toContain('your own')

    const moved = await request.put(`/api/work-logs/${log.id}`, { headers: pm, data: { ...body, taskId: task.id + 1000000 } })
    expect(moved.status()).toBe(400)
    const future = await request.put(`/api/work-logs/${log.id}`, { headers: pm, data: { ...body, workDate: '2099-01-01' } })
    expect(future.status()).toBe(400)

    const ok = await request.put(`/api/work-logs/${log.id}`, { headers: pm, data: body })
    expect(ok.status()).toBe(200)
    expect(Number((await ok.json()).hoursWorked)).toBe(3)

    // a manager who is not the author may delete it, and the feed says whose it was
    expect((await request.delete(`/api/work-logs/${log.id}`, { headers: admin })).status()).toBe(204)
    const projectFeed = await (await request.get(`/api/activity-logs/project/${project.id}`, { headers: pm })).json()
    expect(projectFeed.map((a) => a.action)).toEqual(expect.arrayContaining(['WORK_LOGGED', 'WORK_LOG_UPDATED', 'WORK_LOG_DELETED']))
    expect(projectFeed.find((a) => a.action === 'WORK_LOG_DELETED' && a.description.includes('logged by')).description).toContain('Olivia Bennett')
  })
})
