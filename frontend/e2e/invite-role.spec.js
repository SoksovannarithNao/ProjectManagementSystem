import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD } from './helpers.js'

// Checklist #14: the project page's Add member dialog offers a role (Team Member, Team Leader,
// Viewer; never Owner) instead of always inviting a Team Member. Runs on a throw-away project
// owned by pm.olivia.

const apiLogin = async (request, username) => {
  const res = await request.post('/api/auth/login', { data: { username, password: SEED_PASSWORD } })
  expect(res.status()).toBe(200)
  return { Authorization: `Bearer ${(await res.json()).token}` }
}

test('Add member invites with the chosen role', async ({ page, request }) => {
  const pm = await apiLogin(request, 'pm.olivia')
  const created = await request.post('/api/projects', {
    headers: pm,
    data: { name: `e2e invite role ${Date.now()}`, priority: 'LOW', status: 'IN_PROGRESS', startDate: '2026-01-01', endDate: '2099-12-31' },
  })
  expect(created.status()).toBe(201)
  const project = await created.json()
  try {
    await login(page, 'pm.olivia')
    await page.goto(`/projects/${project.id}`)
    await page.getByRole('button', { name: 'Add member' }).click()
    const dialog = page.locator('form').filter({ hasText: 'Role in this project' })

    // the role list has the three roles and no Owner; Team Member is the default
    const role = dialog.getByLabel('Role in this project')
    await expect(role).toHaveValue('MEMBER')
    await expect(role.locator('option')).toHaveText(['Team Member', 'Team Leader', 'Viewer'])
    await role.selectOption('ADMIN')
    await expect(dialog.getByText("They'll get an invitation and join as a Team Leader once they accept.")).toBeVisible()

    await dialog.getByLabel('Username').fill('dev.hana')
    await dialog.getByRole('button', { name: 'Send Invitation' }).click()
    await expect(page.getByText('Invitation sent to dev.hana')).toBeVisible()

    // the invitation carries the chosen role, and it is the role the person holds once they accept
    const pending = await (await request.get(`/api/project-members/project/${project.id}/invitations`, { headers: pm })).json()
    expect(pending.find((m) => m.user.username === 'dev.hana').projectRole).toBe('ADMIN')
    const hana = await apiLogin(request, 'dev.hana')
    expect((await request.post(`/api/project-members/project/${project.id}/accept`, { headers: hana })).status()).toBe(200)
    const members = await (await request.get(`/api/project-members/project/${project.id}`, { headers: pm })).json()
    expect(members.find((m) => m.user.username === 'dev.hana').projectRole).toBe('ADMIN')
  } finally {
    await request.delete(`/api/projects/${project.id}`, { headers: pm })
  }
})
