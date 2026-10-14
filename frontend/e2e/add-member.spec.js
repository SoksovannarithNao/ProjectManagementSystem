import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD } from './helpers.js'
import { setup } from './kanban-helpers.js'

// "Add Member" on the Team page: put an EXISTING user into a project. The project and the person are both
// picked from combo boxes (only a listed person can be chosen). "Add User" is the other button: an
// administrator creating an account. Everything here uses a throw-away project and account (kanban-helpers).

test.describe('Add Member on the Team page', () => {
  test('who sees which button: managers see Add Member, only an administrator also sees Add User, a Team Member sees neither', async ({ page }) => {
    await login(page, 'pm.olivia')
    await page.goto('/team')
    await expect(page.getByRole('button', { name: 'Add Member' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add User' })).toHaveCount(0)

    await login(page) // the administrator
    await page.goto('/team')
    await expect(page.getByRole('button', { name: 'Add Member' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add User' })).toBeVisible()

    await login(page, 'dev.chen')
    await page.goto('/team')
    await expect(page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Member' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add User' })).toHaveCount(0)
  })

  test('choose a project, then a person from the list, and send the invitation', async ({ page, request }) => {
    const ctx = await setup(request)
    const username = `addable.${ctx.stamp}`
    const fullName = `Addable ${ctx.stamp}`
    const created = await request.post('/api/users', {
      headers: ctx.admin,
      data: { fullName, username, email: `${username}@example.com`, password: SEED_PASSWORD, accountStatus: 'ACTIVE' },
    })
    expect(created.status()).toBe(201)
    const accountId = (await created.json()).id
    try {
      await login(page, 'pm.olivia')
      await page.goto('/team')
      await page.getByRole('button', { name: 'Add Member' }).click()
      const panel = page.getByRole('dialog', { name: 'Add Member', exact: true })
      await expect(panel).toBeVisible()

      // the person cannot be chosen before the project
      const person = panel.getByRole('combobox', { name: 'Person', exact: true })
      await expect(person).toBeDisabled()
      await expect(panel.getByText('Choose a project first.')).toBeVisible()
      await expect(panel.getByRole('button', { name: 'Send Invitation' })).toBeDisabled()

      // the project combo box narrows as you type and Escape closes only its list
      const project = panel.getByRole('combobox', { name: 'Project', exact: true })
      await project.fill(ctx.stamp)
      await expect(panel.getByRole('listbox').getByRole('option')).toHaveCount(1)
      await page.keyboard.press('Escape')
      await expect(panel.getByRole('listbox')).toHaveCount(0)
      await expect(panel).toBeVisible() // the panel itself is still there

      await project.fill(ctx.stamp)
      await panel.getByRole('listbox').getByRole('option').first().click()
      await expect(project).toHaveValue(`kanban ${ctx.stamp}`)

      // now the person: type part of the name, move with the keyboard, pick with Enter
      await expect(person).toBeEnabled()
      await person.fill(ctx.stamp)
      await expect(panel.getByRole('listbox').getByRole('option')).toHaveCount(1)
      await expect(panel.getByRole('listbox').getByRole('option').first()).toContainText(username)
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
      await expect(person).toHaveValue(fullName)

      await panel.getByRole('button', { name: 'Send Invitation' }).click()
      await expect(page.getByText(`Invitation sent to ${fullName}`)).toBeVisible()
      await expect(panel).toHaveCount(0)

      const pending = await (await request.get(`/api/project-members/project/${ctx.project.id}/invitations`, { headers: ctx.pm })).json()
      expect(pending.some((p) => p.user.username === username)).toBe(true)
    } finally {
      await ctx.cleanup()
      await request.delete(`/api/users/${accountId}`, { headers: ctx.admin })
    }
  })

  test('a person already in the project is not offered again', async ({ page, request }) => {
    const ctx = await setup(request) // the throw-away member is already in the project
    try {
      await login(page, 'pm.olivia')
      await page.goto('/team')
      await page.getByRole('button', { name: 'Add Member' }).click()
      const panel = page.getByRole('dialog', { name: 'Add Member', exact: true })
      await panel.getByRole('combobox', { name: 'Project', exact: true }).fill(ctx.stamp)
      await panel.getByRole('listbox').getByRole('option').first().click()
      await panel.getByRole('combobox', { name: 'Person', exact: true }).fill(ctx.member.username)
      await expect(panel.getByRole('listbox').getByRole('option')).toHaveCount(0)
      await expect(panel.getByText('No one left to add')).toBeVisible()
    } finally {
      await ctx.cleanup()
    }
  })
})
