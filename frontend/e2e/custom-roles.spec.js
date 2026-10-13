import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD, SEED_ADMIN_USERNAME } from './helpers.js'

// Extra system roles (#7b, D-14): an administrator creates, edits, gives permissions to,
// assigns and deletes a role from Administration > Roles & Permissions. Every test
// makes its own role and account and removes them again; the seven built-in roles and
// the live matrix are never edited.

async function adminHeaders(request) {
  const r = await request.post('/api/auth/login', { data: { username: SEED_ADMIN_USERNAME, password: SEED_PASSWORD } })
  expect(r.ok()).toBeTruthy()
  return { Authorization: `Bearer ${(await r.json()).token}` }
}

async function roleByName(request, headers, name) {
  const roles = await (await request.get('/api/roles', { headers })).json()
  return roles.find((r) => r.name === name)
}

test.describe('extra system roles', () => {
  test('an administrator creates a role, gives it permissions, assigns it and deletes it', async ({ page, request }) => {
    const headers = await adminHeaders(request)
    const stamp = `${Date.now()}`
    const stored = `E2E_AUDITOR_${stamp}`
    const shown = `E2e Auditor ${stamp}`
    const username = `role.${stamp}`
    let userId
    try {
      await login(page)
      await page.goto('/admin/roles')

      // create the role: it starts with no permissions
      await page.getByRole('button', { name: 'New role' }).click()
      await page.getByLabel('Role name').fill(`E2E Auditor ${stamp}`)
      await page.getByLabel('Description (optional)').fill('Reads reports')
      await page.getByRole('button', { name: 'Create role' }).click()
      await expect(page.getByRole('heading', { name: shown })).toBeVisible()
      await expect(page.getByRole('button', { name: `${shown} Extra system role` })).toBeVisible()
      const created = await roleByName(request, headers, stored)
      expect(created).toMatchObject({ scope: 'SYSTEM', builtIn: false, projectRole: null, description: 'Reads reports' })

      // the "create projects" box is not available to an extra role
      await expect(page.getByRole('checkbox', { name: `${shown} may create project` })).toBeDisabled()

      // tick two permissions and save
      await page.getByRole('checkbox', { name: `${shown} may view project` }).check()
      await page.getByRole('checkbox', { name: `${shown} may generate reports report` }).check()
      await page.getByRole('button', { name: 'Save changes' }).click()
      await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
      const matrix = await (await request.get('/api/permissions/matrix', { headers })).json()
      const grants = matrix.roles.find((r) => r.role.name === stored).grants
      expect(grants.map((g) => `${g.scope}:${g.resource}:${g.permission}`).sort()).toEqual([
        'SYSTEM:PROJECT:VIEW',
        'SYSTEM:REPORT:GENERATE_REPORTS',
      ])

      // an account that holds the role gets exactly those permissions
      const account = await request.post('/api/users', {
        headers,
        data: {
          fullName: `Role Tester ${stamp}`, username, email: `${username}@example.com`,
          password: SEED_PASSWORD, accountStatus: 'ACTIVE', roleId: created.id,
        },
      })
      expect(account.status()).toBe(201)
      userId = (await account.json()).id
      const login2 = await request.post('/api/auth/login', { data: { username, password: SEED_PASSWORD } })
      const mine = await (await request.get('/api/users/me/permissions', {
        headers: { Authorization: `Bearer ${(await login2.json()).token}` },
      })).json()
      expect(mine.role).toBe(stored)
      expect(mine.system.sort()).toEqual(['PROJECT:VIEW', 'REPORT:GENERATE_REPORTS'])

      // it cannot be deleted while an account holds it
      await page.getByRole('button', { name: `Delete ${shown}` }).click()
      await page.getByRole('button', { name: 'Delete', exact: true }).click()
      await expect(page.getByRole('heading', { name: shown })).toBeVisible()
      expect(await roleByName(request, headers, stored)).toBeTruthy()

      // once the account has another role, the role is deleted from the screen
      const userRole = await roleByName(request, headers, 'USER')
      expect((await request.put(`/api/users/${userId}/role`, { headers, data: { roleId: userRole.id } })).ok()).toBeTruthy()
      await page.reload()
      await page.getByRole('button', { name: shown }).click()
      await page.getByRole('button', { name: `Delete ${shown}` }).click()
      await page.getByRole('button', { name: 'Delete', exact: true }).click()
      await expect(page.getByRole('button', { name: shown })).toHaveCount(0)
      expect(await roleByName(request, headers, stored)).toBeUndefined()
    } finally {
      if (userId) await request.delete(`/api/users/${userId}`, { headers })
      const left = await roleByName(request, headers, stored)
      if (left) await request.delete(`/api/roles/${left.id}`, { headers })
    }
  })

  test('New role opens in the right-hand panel, which asks before discarding what was typed', async ({ page }) => {
    await login(page)
    await page.goto('/admin/roles')
    await page.getByRole('button', { name: 'New role' }).click()
    const panel = page.getByRole('dialog', { name: 'New role' })
    await expect(panel).toBeVisible()
    // docked to the right edge, like the task panel
    const viewport = page.viewportSize()
    // (polled: the panel slides in)
    await expect.poll(async () => {
      const box = await panel.boundingBox()
      return viewport.width - (box.x + box.width) <= 16 && box.width >= 400
    }).toBe(true)
    expect((await panel.boundingBox()).height).toBeGreaterThanOrEqual(viewport.height - 1)

    // nothing typed: Escape closes it at once
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)

    // something typed: Escape, the X and the scrim ask first; "Keep editing" stays, "Discard" closes
    await page.getByRole('button', { name: 'New role' }).click()
    await page.getByLabel('Role name').fill('Unsaved idea')
    await page.keyboard.press('Escape')
    await expect(page.getByText('You have unsaved changes')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).last().click()
    await expect(panel).toBeVisible()
    await expect(page.getByLabel('Role name')).toHaveValue('Unsaved idea')
    await page.getByRole('button', { name: 'Close panel' }).click()
    await page.getByRole('button', { name: 'Discard', exact: true }).click()
    await expect(panel).toHaveCount(0)
  })

  test('an extra role can be renamed from the screen', async ({ page, request }) => {
    const headers = await adminHeaders(request)
    const stamp = `${Date.now()}`
    const made = await request.post('/api/roles', { headers, data: { name: `E2E Rename ${stamp}`, description: '' } })
    expect(made.status()).toBe(201)
    const role = await made.json()
    try {
      await login(page)
      await page.goto('/admin/roles')
      await page.getByRole('button', { name: `E2e Rename ${stamp}` }).click()
      await page.getByRole('button', { name: `Edit E2e Rename ${stamp}` }).click()
      await page.getByLabel('Role name').fill(`E2E Renamed ${stamp}`)
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(page.getByRole('heading', { name: `E2e Renamed ${stamp}` })).toBeVisible()
      expect((await (await request.get(`/api/roles/${role.id}`, { headers })).json()).name).toBe(`E2E_RENAMED_${stamp}`)
    } finally {
      await request.delete(`/api/roles/${role.id}`, { headers })
    }
  })

  test('the built-in roles have no edit or delete button', async ({ page }) => {
    await login(page)
    await page.goto('/admin/roles')
    await page.getByRole('button', { name: /^Project Manager/ }).click()
    await expect(page.getByRole('button', { name: /^Delete / })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Edit / })).toHaveCount(0)
  })

  test('the server keeps the rules: names, built-in roles, project creation, project-level resources', async ({ request }) => {
    const headers = await adminHeaders(request)
    const stamp = `${Date.now()}`
    const made = await request.post('/api/roles', { headers, data: { name: `E2E Rules ${stamp}` } })
    expect(made.status()).toBe(201)
    const role = await made.json()
    try {
      // a name in use (any letter case) is a conflict; an odd name is refused
      const dup = await request.post('/api/roles', { headers, data: { name: 'administrator' } })
      expect(dup.status()).toBe(409)
      expect((await request.post('/api/roles', { headers, data: { name: '9 lives' } })).status()).toBe(400)

      // built-in roles keep their name and cannot be deleted
      const pm = await roleByName(request, headers, 'PROJECT_MANAGER')
      expect((await request.put(`/api/roles/${pm.id}`, { headers, data: { name: 'BOSS' } })).status()).toBe(400)
      const del = await request.delete(`/api/roles/${pm.id}`, { headers })
      expect(del.status()).toBe(400)
      expect((await del.json()).message).toBe('Built-in roles cannot be deleted')

      // an extra role cannot create projects, and a system grant cannot be on a project-level resource
      const create = await request.put(`/api/roles/${role.id}/permissions`, {
        headers, data: { grants: [{ scope: 'SYSTEM', resource: 'PROJECT', permission: 'CREATE' }] },
      })
      expect(create.status()).toBe(400)
      expect((await create.json()).message).toContain('cannot create projects')
      const wide = await request.put(`/api/roles/${role.id}/permissions`, {
        headers, data: { grants: [{ scope: 'SYSTEM', resource: 'TASK', permission: 'EDIT' }] },
      })
      expect(wide.status()).toBe(400)
      expect((await wide.json()).message).toContain('system-wide permission')
    } finally {
      await request.delete(`/api/roles/${role.id}`, { headers })
    }
  })

  test('only an administrator can create, edit or delete a role', async ({ request }) => {
    const login3 = await request.post('/api/auth/login', { data: { username: 'dev.chen', password: SEED_PASSWORD } })
    const headers = { Authorization: `Bearer ${(await login3.json()).token}` }
    expect((await request.post('/api/roles', { headers, data: { name: 'Sneaky' } })).status()).toBe(403)
    expect((await request.put('/api/roles/1', { headers, data: { name: 'Sneaky' } })).status()).toBe(403)
    expect((await request.delete('/api/roles/1', { headers })).status()).toBe(403)
  })
})
