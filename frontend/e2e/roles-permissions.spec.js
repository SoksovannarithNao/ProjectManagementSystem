import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD } from './helpers.js'

// Two levels of role (ADR-0015, assignment-brief.md Part B): system roles
// ADMINISTRATOR / PROJECT_MANAGER / USER and project roles OWNER / ADMIN / MEMBER /
// VIEWER (Team Leader = ADMIN, Team Member = MEMBER), seven permissions, enforced
// from the role_permissions table.
// Seed data: pm.olivia is a PROJECT_MANAGER and OWNER of PRJ-2001; dev.chen is a
// USER and MEMBER of PRJ-2001; lead.owen is a USER and ADMIN of some projects.
// The tests never edit the live matrix or any account; whatever a test creates
// (a task) is deleted when it finishes.

async function auth(request, username) {
  const r = await request.post('/api/auth/login', { data: { username, password: SEED_PASSWORD } })
  expect(r.ok(), `login ${username}`).toBeTruthy()
  return { Authorization: `Bearer ${(await r.json()).token}` }
}

async function myPermissions(request, username) {
  const r = await request.get('/api/users/me/permissions', { headers: await auth(request, username) })
  expect(r.ok()).toBeTruthy()
  return r.json()
}

const PROJECT = { name: 'e2e', priority: 'LOW', status: 'PLANNING', startDate: '2026-10-01', endDate: '2026-12-01' }

test.describe('roles and permissions: API', () => {
  test('each seeded role holds the right system permissions', async ({ request }) => {
    const admin = await myPermissions(request, 'admin.system')
    expect(admin.role).toBe('ADMINISTRATOR')
    expect(admin.system).toEqual(expect.arrayContaining(['PROJECT:CREATE', 'USER:ASSIGN', 'ROLE:EDIT', 'REPORT:GENERATE_REPORTS']))

    const pm = await myPermissions(request, 'pm.olivia')
    expect(pm.role).toBe('PROJECT_MANAGER')
    expect(pm.system.sort()).toEqual(['PROJECT:CREATE', 'REPORT:GENERATE_REPORTS'])

    // a Team Leader is a USER at system level; reports come through the project role ADMIN
    const lead = await myPermissions(request, 'lead.owen')
    expect(lead.role).toBe('USER')
    expect(lead.system).toEqual([])
    expect(lead.projects.some((p) => p.projectRole === 'ADMIN' && p.grants.includes('REPORT:GENERATE_REPORTS'))).toBe(true)

    const member = await myPermissions(request, 'dev.chen')
    expect(member.role).toBe('USER')
    expect(member.system).toEqual([])
  })

  test('only a Project Manager or Administrator can create a project, with a clear message', async ({ request }) => {
    for (const who of ['dev.chen', 'lead.owen']) {
      const r = await request.post('/api/projects', { headers: await auth(request, who), data: PROJECT })
      expect(r.status(), who).toBe(403)
      expect((await r.json()).message).toBe('Only a Project Manager or an Administrator can create a project')
    }
  })

  test('only an approver can complete a task; a member submits it for review instead', async ({ request }) => {
    const pm = await auth(request, 'pm.olivia')
    const member = await auth(request, 'dev.chen')
    const projects = await (await request.get('/api/projects', { headers: pm })).json()
    const projectId = projects.find((p) => p.projectCode === 'PRJ-2001').id
    const body = (status) => ({
      projectId,
      title: 'e2e approval gate',
      priority: 'LOW',
      status,
      startDate: '2026-10-01',
      dueDate: '2026-10-30',
    })

    const created = await request.post('/api/tasks', { headers: pm, data: body('TODO') })
    expect(created.status()).toBe(201)
    const id = (await created.json()).id
    try {
      expect((await request.put(`/api/tasks/${id}`, { headers: pm, data: body('IN_REVIEW') })).status()).toBe(200)

      const refused = await request.put(`/api/tasks/${id}`, { headers: member, data: body('COMPLETED') })
      expect(refused.status()).toBe(403)
      expect((await refused.json()).message).toContain('can approve a task as completed')

      expect((await request.put(`/api/tasks/${id}`, { headers: pm, data: body('COMPLETED') })).status()).toBe(200)
      expect((await request.delete(`/api/tasks/${id}`, { headers: member })).status()).toBe(403)
    } finally {
      await request.delete(`/api/tasks/${id}`, { headers: pm })
    }
  })

  test('the permission matrix and role assignment are restricted to those who hold the permission', async ({ request }) => {
    const admin = await auth(request, 'admin.system')
    const lead = await auth(request, 'lead.owen')

    expect((await request.get('/api/permissions/matrix', { headers: lead })).status()).toBe(403)
    const matrix = await (await request.get('/api/permissions/matrix', { headers: admin })).json()
    expect(matrix.roles.map((r) => r.role.name)).toEqual(
      expect.arrayContaining(['ADMINISTRATOR', 'PROJECT_MANAGER', 'USER', 'OWNER', 'ADMIN', 'MEMBER', 'VIEWER'])
    )
    expect(matrix.permissions.map((p) => p.code).sort()).toEqual(
      ['APPROVE', 'ASSIGN', 'CREATE', 'DELETE', 'EDIT', 'GENERATE_REPORTS', 'VIEW']
    )

    const id = (name) => matrix.roles.find((r) => r.role.name === name).role.id
    const users = await (await request.get('/api/users', { headers: admin })).json()
    const adminUser = users.find((u) => u.username === 'admin.system')
    const member = users.find((u) => u.username === 'dev.chen')

    // a Team Leader cannot give anyone a role
    const byLead = await request.put(`/api/users/${member.id}/role`, { headers: lead, data: { roleId: id('PROJECT_MANAGER') } })
    expect(byLead.status()).toBe(403)
    // the Administrator role is fixed, the last administrator cannot be demoted,
    // and a project-only role cannot be given to an account
    expect((await request.put(`/api/roles/${id('ADMINISTRATOR')}/permissions`, { headers: admin, data: { grants: [] } })).status()).toBeGreaterThanOrEqual(400)
    expect((await request.put(`/api/users/${adminUser.id}/role`, { headers: admin, data: { roleId: id('USER') } })).status()).toBe(400)
    expect((await request.put(`/api/users/${member.id}/role`, { headers: admin, data: { roleId: id('VIEWER') } })).status()).toBe(400)
  })
})

test.describe('roles and permissions: ownership and Team Member limits (API)', () => {
  test('a project has exactly one Owner, ownership moves in one step, and a single-owner project can be deleted', async ({ request }) => {
    const olivia = await auth(request, 'pm.olivia')
    const marcus = await auth(request, 'pm.marcus')
    const chen = await auth(request, 'dev.chen')
    const create = await request.post('/api/projects', { headers: olivia, data: { ...PROJECT, name: 'e2e ownership' } })
    expect(create.status()).toBe(201)
    const projectId = (await create.json()).id
    let ownerHeaders = olivia
    try {
      const members = async () => (await (await request.get(`/api/project-members/project/${projectId}`, { headers: ownerHeaders })).json())
      expect((await members()).filter((m) => m.projectRole === 'OWNER' && m.status === 'ACTIVE').map((m) => m.user.username)).toEqual(['pm.olivia'])

      // Nobody is invited as the Owner
      const asOwner = await request.post('/api/project-members/invite', { headers: olivia, data: { projectId, username: 'pm.marcus', projectRole: 'OWNER' } })
      expect(asOwner.status()).toBe(400)
      expect((await asOwner.json()).message).toContain('exactly one owner')

      for (const [who, headers, role] of [['pm.marcus', marcus, 'MEMBER'], ['dev.chen', chen, 'MEMBER']]) {
        expect((await request.post('/api/project-members/invite', { headers: olivia, data: { projectId, username: who, projectRole: role } })).status()).toBe(201)
        expect((await request.post(`/api/project-members/project/${projectId}/accept`, { headers })).status()).toBe(200)
      }
      const row = async (username) => (await members()).find((m) => m.user.username === username)

      // the owner cannot be demoted or removed directly
      const demote = await request.put(`/api/project-members/${(await row('pm.olivia')).id}`, { headers: olivia, data: { projectId, userId: (await row('pm.olivia')).user.id, projectRole: 'MEMBER' } })
      expect(demote.status()).toBe(400)
      expect((await demote.json()).message).toContain('Transfer ownership')

      // a plain User (dev.chen) cannot become the owner
      const toUser = await request.put(`/api/project-members/${(await row('dev.chen')).id}`, { headers: olivia, data: { projectId, userId: (await row('dev.chen')).user.id, projectRole: 'OWNER' } })
      expect(toUser.status()).toBe(400)
      expect((await toUser.json()).message).toContain('cannot own a project')

      // a Project Manager can: ownership moves in one step, the old owner becomes Team Leader
      const marcusRow = await row('pm.marcus')
      const transfer = await request.put(`/api/project-members/${marcusRow.id}`, { headers: olivia, data: { projectId, userId: marcusRow.user.id, projectRole: 'OWNER' } })
      expect(transfer.status()).toBe(200)
      ownerHeaders = marcus
      const after = await members()
      expect(after.filter((m) => m.projectRole === 'OWNER' && m.status === 'ACTIVE').map((m) => m.user.username)).toEqual(['pm.marcus'])
      expect((await row('pm.olivia')).projectRole).toBe('ADMIN')
      const project = await (await request.get(`/api/projects/${projectId}`, { headers: marcus })).json()
      expect(project.manager.username).toBe('pm.marcus')

      // the former owner is now a Team Leader: she cannot delete the project
      expect((await request.delete(`/api/projects/${projectId}`, { headers: olivia })).status()).toBe(403)
    } finally {
      // the owner deletes it; a project with a single owner can be deleted (issue I-19)
      const del = await request.delete(`/api/projects/${projectId}`, { headers: ownerHeaders })
      expect([204, 200]).toContain(del.status())
      expect((await request.get(`/api/projects/${projectId}`, { headers: olivia })).status()).toBe(404)
    }
  })

  test('a Team Member does not create tasks, but works on the subtasks of tasks assigned to them', async ({ request }) => {
    const olivia = await auth(request, 'pm.olivia')
    const chen = await auth(request, 'dev.chen')
    const projects = await (await request.get('/api/projects', { headers: olivia })).json()
    const projectId = projects.find((p) => p.projectCode === 'PRJ-2001').id
    const body = { projectId, title: 'e2e member limits', priority: 'LOW', status: 'TODO', startDate: '2026-10-05', dueDate: '2026-10-30' }

    expect((await request.post('/api/tasks', { headers: chen, data: body })).status()).toBe(403)

    const created = await request.post('/api/tasks', { headers: olivia, data: body })
    expect(created.status()).toBe(201)
    const taskId = (await created.json()).id
    try {
      // a subtask can be added by a Team Member, but not edited on a task that is not assigned to them
      const sub = await request.post('/api/subtasks', { headers: chen, data: { taskId, title: 'e2e member subtask' } })
      expect(sub.status()).toBe(201)
      const subId = (await sub.json()).id
      const refused = await request.put(`/api/subtasks/${subId}`, { headers: chen, data: { taskId, title: 'renamed', status: 'COMPLETED' } })
      expect(refused.status()).toBe(403)
      expect((await refused.json()).message).toContain('assigned to you')
      // and cannot delete one
      expect((await request.delete(`/api/subtasks/${subId}`, { headers: chen })).status()).toBe(403)
    } finally {
      await request.delete(`/api/tasks/${taskId}`, { headers: olivia })
    }
  })
})

test.describe('roles and permissions: UI', () => {
  test('a Team Member sees no Reports link, no Administration area and no New Project button', async ({ page }) => {
    await login(page, 'dev.chen')
    const nav = page.getByRole('navigation')
    await expect(nav.getByRole('link', { name: 'Projects' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Reports' })).toHaveCount(0)
    await expect(nav.getByText('Administration')).toHaveCount(0)

    await page.goto('/projects')
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'New Project' })).toHaveCount(0)

    await page.goto('/admin/roles')
    await expect(page.getByText('You do not have access to this page')).toBeVisible()
    await page.goto('/reports')
    await expect(page.getByText('You do not have access to this page')).toBeVisible()
  })

  test('a Team Leader (ADMIN in a project, USER at system level) opens Reports through the project role', async ({ page }) => {
    await login(page, 'lead.owen')
    const nav = page.getByRole('navigation')
    await expect(nav.getByRole('link', { name: 'Reports' })).toBeVisible()
    await expect(nav.getByText('Administration')).toHaveCount(0)
    await page.goto('/projects')
    await expect(page.getByRole('button', { name: 'New Project' })).toHaveCount(0)
    await page.goto('/reports')
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible()
  })

  test('a Project Manager can create projects and open Reports but is not an administrator', async ({ page }) => {
    await login(page, 'pm.olivia')
    const nav = page.getByRole('navigation')
    await expect(nav.getByRole('link', { name: 'Reports' })).toBeVisible()
    await expect(nav.getByText('Administration')).toHaveCount(0)
    await page.goto('/projects')
    await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible()
  })

  test('the Administrator manages roles and users from the Administration area', async ({ page }) => {
    await login(page)
    await page.getByRole('link', { name: 'Roles & Permissions' }).click()
    await expect(page.getByRole('heading', { name: 'Roles & Permissions' })).toBeVisible()
    const roles = page.getByRole('navigation', { name: 'Roles' })
    for (const name of [/^Administrator/, /^Project Manager System role/, /^User System role/, /^Owner Project role/, /^Admin Project role/, /^Member Project role/, /^Viewer Project role/]) {
      await expect(roles.getByRole('button', { name })).toBeVisible()
    }
    // the Administrator role is read-only
    await expect(page.getByText('Always has every permission')).toBeVisible()
    await expect(page.getByRole('checkbox')).toHaveCount(0)

    // an editable role shows checkboxes; ticking one marks it unsaved, Discard drops it
    await roles.getByRole('button', { name: /^Member Project role/ }).click()
    const save = page.getByRole('button', { name: 'Save changes' })
    await expect(save).toBeDisabled()
    await page.getByRole('checkbox', { name: /may approve task/i }).click()
    await expect(save).toBeEnabled()
    await page.getByRole('button', { name: 'Discard' }).click()
    await expect(save).toBeDisabled()

    await page.getByRole('link', { name: 'Users', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: /Role for Chen Wu/ })).toHaveValue('USER')
  })
})
