import { expect } from '@playwright/test'
import { login, SEED_PASSWORD, SEED_ADMIN_USERNAME } from './helpers.js'

// Shared by the Kanban specs: a throw-away project (owner pm.olivia) with a throw-away Team
// Member account, cards found by a unique title in the search box, and a clean-up. No seeded
// user other than pm.olivia and the administrator is touched.

export const apiLogin = async (request, username) => {
  const res = await request.post('/api/auth/login', { data: { username, password: SEED_PASSWORD } })
  expect(res.status()).toBe(200)
  return { Authorization: `Bearer ${(await res.json()).token}` }
}

export async function setup(request) {
  const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
  const pm = await apiLogin(request, 'pm.olivia')
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const username = `kanban.${stamp}`
  const created = await request.post('/api/users', {
    headers: admin,
    data: { fullName: `Kanban Member ${stamp}`, username, email: `${username}@example.com`, password: SEED_PASSWORD, accountStatus: 'ACTIVE' },
  })
  expect(created.status()).toBe(201)
  const member = { id: (await created.json()).id, username, headers: await apiLogin(request, username) }
  const project = await (await request.post('/api/projects', {
    headers: pm,
    data: { name: `kanban ${stamp}`, priority: 'LOW', status: 'IN_PROGRESS', startDate: '2026-01-01', endDate: '2026-12-31' },
  })).json()
  expect((await request.post('/api/project-members/invite', { headers: pm, data: { projectId: project.id, username, projectRole: 'MEMBER' } })).status()).toBe(201)
  expect((await request.post(`/api/project-members/project/${project.id}/accept`, { headers: member.headers })).status()).toBe(200)

  const task = async (title, extra = {}, assignee = null) => {
    const res = await request.post('/api/tasks', {
      headers: pm,
      data: { projectId: project.id, title: `${title} ${stamp}`, priority: 'LOW', status: 'TODO', startDate: '2026-01-05', dueDate: '2026-12-01', estimatedHours: 2, ...extra },
    })
    expect(res.status()).toBe(201)
    const t = await res.json()
    if (assignee) expect((await request.post('/api/task-assignees', { headers: pm, data: { taskId: t.id, userId: assignee.id } })).status()).toBe(201)
    return t
  }
  const status = async (t) => (await (await request.get(`/api/tasks/${t.id}`, { headers: pm })).json()).status
  const cleanup = async () => {
    await request.delete(`/api/projects/${project.id}`, { headers: pm })
    await request.delete(`/api/users/${member.id}`, { headers: admin })
  }
  return { admin, pm, member, project, stamp, task, status, cleanup }
}

export const card = (page, task) => page.locator(`[data-testid="kanban-card"][data-task-id="${task.id}"]`)
export const column = (page, id) => page.getByTestId(`kanban-column-${id}`)

export async function openBoard(page, who, stamp) {
  await login(page, who)
  await page.goto('/kanban')
  await page.getByPlaceholder('Search tasks').fill(stamp)
}
