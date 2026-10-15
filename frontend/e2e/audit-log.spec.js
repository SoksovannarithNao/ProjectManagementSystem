import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD, SEED_ADMIN_USERNAME } from './helpers.js'

// The administrator audit log (#44, assignment-brief.md B10, D-11). Each test does its
// audited actions on a throw-away account, role or project and finds them again by a unique
// name. Entries cannot be deleted (that is the point of the log), so the test database keeps
// them, like the activity feed.

const ADMIN_NAME = 'Alex Rivera'

const apiLogin = async (request, username) => {
  const res = await request.post('/api/auth/login', { data: { username, password: SEED_PASSWORD } })
  expect(res.status()).toBe(200)
  return { Authorization: `Bearer ${(await res.json()).token}` }
}

const audit = async (request, headers, params) => {
  const res = await request.get('/api/audit-logs', { headers, params })
  expect(res.status()).toBe(200)
  return res.json()
}
const rolesByName = async (request, headers) =>
  Object.fromEntries((await (await request.get('/api/roles', { headers })).json()).map((r) => [r.name, r]))

test.describe('audit log: API', () => {
  test('account changes are recorded with the actor, the target and the values before and after', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const stamp = `${Date.now()}`
    const username = `audit.${stamp}`
    const roles = await rolesByName(request, admin)
    const created = await request.post('/api/users', {
      headers: admin,
      data: { fullName: `Audit Person ${stamp}`, username, email: `${username}@example.com`, password: SEED_PASSWORD, accountStatus: 'ACTIVE' },
    })
    expect(created.status()).toBe(201)
    const id = (await created.json()).id

    expect((await request.put(`/api/users/${id}/role`, { headers: admin, data: { roleId: roles.PROJECT_MANAGER.id } })).ok()).toBeTruthy()
    const edit = await request.put(`/api/users/${id}`, {
      headers: admin,
      data: { fullName: `Audit Person ${stamp}`, username, email: `${username}@example.com`, accountStatus: 'SUSPENDED' },
    })
    expect(edit.status()).toBe(200)
    expect((await request.delete(`/api/users/${id}`, { headers: admin })).status()).toBe(204)

    // found by the unique name, and still readable although the account is gone
    const log = await audit(request, admin, { q: username })
    const byAction = Object.fromEntries(log.items.map((e) => [e.action, e]))
    expect(Object.keys(byAction).sort()).toEqual(['ACCOUNT_CREATED', 'ACCOUNT_DELETED', 'ACCOUNT_STATUS_CHANGED', 'USER_ROLE_CHANGED'])
    expect(byAction.ACCOUNT_CREATED).toMatchObject({ actorName: ADMIN_NAME, targetType: 'USER', targetId: id, afterValue: 'role USER, status ACTIVE' })
    expect(byAction.USER_ROLE_CHANGED).toMatchObject({ beforeValue: 'USER', afterValue: 'PROJECT_MANAGER', targetLabel: `Audit Person ${stamp} (@${username})` })
    expect(byAction.ACCOUNT_STATUS_CHANGED).toMatchObject({ beforeValue: 'ACTIVE', afterValue: 'SUSPENDED' })
    expect(byAction.ACCOUNT_DELETED).toMatchObject({ beforeValue: 'role PROJECT_MANAGER, status SUSPENDED', afterValue: null })
    expect(log.items.every((e) => e.createdAt && e.actorId)).toBe(true)
    // newest first
    expect(log.items.map((e) => e.action)).toEqual(['ACCOUNT_DELETED', 'ACCOUNT_STATUS_CHANGED', 'USER_ROLE_CHANGED', 'ACCOUNT_CREATED'])
  })

  test('role and permission changes are recorded, and a save that changes nothing is not', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const stamp = `${Date.now()}`
    const made = await request.post('/api/roles', { headers: admin, data: { name: `Audit Role ${stamp}`, description: 'for the audit test' } })
    expect(made.status()).toBe(201)
    const role = await made.json()
    const grants = [{ scope: 'SYSTEM', resource: 'REPORT', permission: 'GENERATE_REPORTS' }, { scope: 'SYSTEM', resource: 'USER', permission: 'VIEW' }]
    expect((await request.put(`/api/roles/${role.id}/permissions`, { headers: admin, data: { grants } })).ok()).toBeTruthy()
    // the same list again: nothing new
    expect((await request.put(`/api/roles/${role.id}/permissions`, { headers: admin, data: { grants } })).ok()).toBeTruthy()
    expect((await request.put(`/api/roles/${role.id}/permissions`, { headers: admin, data: { grants: grants.slice(0, 1) } })).ok()).toBeTruthy()
    expect((await request.delete(`/api/roles/${role.id}`, { headers: admin })).status()).toBe(204)

    const log = await audit(request, admin, { q: `AUDIT_ROLE_${stamp}` })
    expect(log.items.map((e) => e.action)).toEqual(['ROLE_DELETED', 'PERMISSIONS_CHANGED', 'PERMISSIONS_CHANGED', 'ROLE_CREATED'])
    const [, shrink, grow] = log.items
    expect(grow).toMatchObject({ targetType: 'ROLE', targetId: role.id, beforeValue: '', afterValue: 'SYSTEM:REPORT:GENERATE_REPORTS, SYSTEM:USER:VIEW' })
    expect(shrink).toMatchObject({ beforeValue: 'SYSTEM:REPORT:GENERATE_REPORTS, SYSTEM:USER:VIEW', afterValue: 'SYSTEM:REPORT:GENERATE_REPORTS' })
  })

  test('project role changes, ownership transfers and project deletion are recorded; the Owner reads only the transfers', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const olivia = await apiLogin(request, 'pm.olivia')
    const roles = await rolesByName(request, admin)
    const stamp = `${Date.now()}`
    // Throw-away accounts, so no seeded user is a member of the project while other specs run.
    const account = async (suffix, roleId) => {
      const username = `audit.${suffix}.${stamp}`
      const res = await request.post('/api/users', {
        headers: admin,
        data: { fullName: `Audit ${suffix} ${stamp}`, username, email: `${username}@example.com`, password: SEED_PASSWORD, accountStatus: 'ACTIVE', roleId },
      })
      expect(res.status()).toBe(201)
      return { username, id: (await res.json()).id, fullName: `Audit ${suffix} ${stamp}`, headers: await apiLogin(request, username) }
    }
    const next = await account('nextowner', roles.PROJECT_MANAGER.id)
    const viewer = await account('viewer', roles.USER.id)
    const name = `audit project ${stamp}`
    const created = await request.post('/api/projects', {
      headers: olivia,
      data: { name, priority: 'LOW', status: 'IN_PROGRESS', startDate: '2026-01-01', endDate: '2026-12-31' },
    })
    expect(created.status()).toBe(201)
    const project = await created.json()
    let deleted = false
    try {
      for (const who of [next, viewer]) {
        expect((await request.post('/api/project-members/invite', { headers: olivia, data: { projectId: project.id, username: who.username, projectRole: 'MEMBER' } })).status()).toBe(201)
        expect((await request.post(`/api/project-members/project/${project.id}/accept`, { headers: who.headers })).status()).toBe(200)
      }
      const members = await (await request.get(`/api/project-members/project/${project.id}`, { headers: olivia })).json()
      const viewerRow = members.find((m) => m.user.username === viewer.username)
      const nextRow = members.find((m) => m.user.username === next.username)

      expect((await request.put(`/api/project-members/${viewerRow.id}`, { headers: olivia, data: { projectId: project.id, userId: viewer.id, projectRole: 'VIEWER' } })).status()).toBe(200)
      expect((await request.put(`/api/project-members/${nextRow.id}`, { headers: olivia, data: { projectId: project.id, userId: next.id, projectRole: 'OWNER' } })).status()).toBe(200)

      const forAdmin = await (await request.get(`/api/audit-logs/project/${project.id}`, { headers: admin })).json()
      expect(forAdmin.map((e) => e.action)).toEqual(['OWNERSHIP_TRANSFERRED', 'PROJECT_ROLE_CHANGED'])
      expect(forAdmin[0]).toMatchObject({ targetType: 'PROJECT', beforeValue: 'Olivia Bennett', afterValue: next.fullName, actorName: 'Olivia Bennett' })
      expect(forAdmin[1]).toMatchObject({ targetType: 'USER', beforeValue: 'MEMBER', afterValue: 'VIEWER', projectId: project.id })

      // the new Owner reads the transfer but not the role change; the previous owner (now a Team Leader) and a viewer read nothing
      const forOwner = await (await request.get(`/api/audit-logs/project/${project.id}`, { headers: next.headers })).json()
      expect(forOwner.map((e) => e.action)).toEqual(['OWNERSHIP_TRANSFERRED'])
      expect((await request.get(`/api/audit-logs/project/${project.id}`, { headers: olivia })).status()).toBe(403)
      expect((await request.get(`/api/audit-logs/project/${project.id}`, { headers: viewer.headers })).status()).toBe(403)

      expect((await request.delete(`/api/projects/${project.id}`, { headers: next.headers })).status()).toBe(204)
      deleted = true
      // found by its unique name (project codes are reused after a project is deleted)
      const log = await audit(request, admin, { q: name, action: 'PROJECT_DELETED' })
      expect(log.items).toHaveLength(1)
      expect(log.items[0]).toMatchObject({ actorName: next.fullName, targetType: 'PROJECT', targetId: project.id, afterValue: null })
    } finally {
      if (!deleted) await request.delete(`/api/projects/${project.id}`, { headers: next.headers })
      await request.delete(`/api/projects/${project.id}`, { headers: olivia })
      for (const who of [next, viewer]) await request.delete(`/api/users/${who.id}`, { headers: admin })
    }
  })

  test('only an Administrator reads the log', async ({ request }) => {
    for (const who of ['pm.olivia', 'lead.owen', 'dev.chen']) {
      const res = await request.get('/api/audit-logs', { headers: await apiLogin(request, who) })
      expect(res.status(), who).toBe(403)
      expect((await res.json()).message).toBe('Only an Administrator can read the audit log')
    }
    expect((await request.get('/api/audit-logs')).status()).toBe(401)
  })

  test('filters, pages and the entries cannot be changed or deleted', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const everything = await audit(request, admin, { size: 1 })
    expect(everything.items).toHaveLength(1)
    expect(everything.total).toBeGreaterThan(1)
    expect(everything.size).toBe(1)

    // Newest first. Other specs write audit entries while this runs, so the order is checked inside one read
    // (two pages read a moment apart can shift by an entry), and page 1 only has to be older than page 0 was.
    const two = await audit(request, admin, { size: 2 })
    expect(two.items[1].id).toBeLessThan(two.items[0].id)
    const second = await audit(request, admin, { size: 1, page: 1 })
    expect(second.items).toHaveLength(1)

    const oversized = await audit(request, admin, { size: 5000 })
    expect(oversized.size).toBe(100)

    const none = await audit(request, admin, { from: '2000-01-01', to: '2000-01-02' })
    expect(none.total).toBe(0)
    const today = new Date().toISOString().slice(0, 10)
    expect((await audit(request, admin, { from: today, to: today })).total).toBeGreaterThan(0)
    expect((await audit(request, admin, { targetType: 'ROLE' })).items.every((e) => e.targetType === 'ROLE')).toBe(true)
    // a wildcard typed into the search is text, not a pattern
    expect((await audit(request, admin, { q: '%%%%' })).total).toBe(0)

    const id = everything.items[0].id
    for (const method of ['put', 'delete', 'patch']) {
      const res = await request[method](`/api/audit-logs/${id}`, { headers: admin, data: { actorName: 'forged' } })
      expect(res.ok(), method).toBeFalsy()
    }
    expect((await audit(request, admin, { size: 1 })).items[0].actorName).not.toBe('forged')
  })
})

test.describe('audit log: screen', () => {
  test('the Administrator opens the log from the sidebar, searches it and filters by action', async ({ page, request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const stamp = `${Date.now()}`
    const made = await request.post('/api/roles', { headers: admin, data: { name: `Screen Role ${stamp}` } })
    expect(made.status()).toBe(201)
    const role = await made.json()
    await request.put(`/api/roles/${role.id}/permissions`, {
      headers: admin, data: { grants: [{ scope: 'SYSTEM', resource: 'REPORT', permission: 'GENERATE_REPORTS' }] },
    })
    try {
      await login(page)
      await page.getByRole('link', { name: 'Audit log' }).click()
      await expect(page).toHaveURL(/\/admin\/audit$/)
      await expect(page.getByTestId('audit-row').first()).toBeVisible()

      await page.getByPlaceholder('Search the audit log').fill(`SCREEN_ROLE_${stamp}`)
      await expect(page.getByTestId('audit-row')).toHaveCount(2)
      await expect(page.getByTestId('audit-range')).toHaveText('1–2 of 2')
      // the permission change shows what was added
      const change = page.getByTestId('audit-permission-change')
      await expect(change).toContainText('Added')
      await expect(change).toContainText('Report: Generate Reports (anywhere)')

      await page.getByLabel('Action').selectOption('PERMISSIONS_CHANGED')
      await expect(page.getByTestId('audit-row')).toHaveCount(1)
      await page.getByRole('button', { name: 'Clear filters' }).click()
      await expect(page.getByTestId('audit-row').first()).toBeVisible()
      await expect(page.getByPlaceholder('Search the audit log')).toHaveValue('')

      await page.getByPlaceholder('Search the audit log').fill('no such entry anywhere')
      await expect(page.getByText('No entries match your filters')).toBeVisible()
    } finally {
      await request.delete(`/api/roles/${role.id}`, { headers: admin })
    }
  })

  test('anyone else has no link and gets the access page', async ({ page }) => {
    await login(page, 'pm.olivia')
    await expect(page.getByRole('link', { name: 'Audit log' })).toHaveCount(0)
    await page.goto('/admin/audit')
    await expect(page.getByText('You do not have access to this page')).toBeVisible()
  })
})
