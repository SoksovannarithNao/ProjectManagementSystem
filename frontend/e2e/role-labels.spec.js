import { test, expect } from '@playwright/test'
import { login } from './helpers.js'

// One name for a project role on every screen: Owner, Admin (Team Leader), Member (Team Member), Viewer.
// Display labels only: the stored values (OWNER, ADMIN, MEMBER, VIEWER), the permissions and the API are
// not touched. Read-only: nothing here changes data.

const ROLES = ['Admin (Team Leader)', 'Member (Team Member)', 'Viewer']

test.describe('project role labels', () => {
  test('the project page: the role pickers, the Add member panel and the Owner badge', async ({ page }) => {
    await login(page, 'pm.olivia')
    await page.goto('/projects')
    await page.getByRole('link', { name: /Website Redesign/ }).first().click()

    // the Owner's badge, and a picker per other member, all with the same three roles
    await expect(page.getByText('Owner', { exact: true }).first()).toBeVisible()
    const pickers = page.locator('select[aria-label^="Project role of"]')
    await expect(pickers.first()).toBeVisible()
    for (const picker of await pickers.all()) {
      await expect(picker.locator('option')).toHaveText(ROLES)
    }

    // the Add member panel offers the same names (Member is the default)
    await page.getByRole('button', { name: 'Add member' }).click()
    const role = page.getByRole('dialog', { name: 'Add Member', exact: true }).getByLabel('Role in this project')
    await expect(role.locator('option')).toHaveText(['Member (Team Member)', 'Admin (Team Leader)', 'Viewer'])
    await expect(role).toHaveValue('MEMBER')
  })

  test('the Team page: Add Member and the invite picker of a selected person', async ({ page }) => {
    await login(page)
    await page.goto('/team')
    await page.getByRole('button', { name: 'Add Member' }).click()
    const panel = page.getByRole('dialog', { name: 'Add Member', exact: true })
    await expect(panel.getByLabel('Role in this project').locator('option')).toHaveText(['Member (Team Member)', 'Admin (Team Leader)', 'Viewer'])
    await panel.getByRole('button', { name: 'Cancel' }).click()

    // a person who is not in every project gets the "invite to a project" picker
    await page.getByPlaceholder('Search by name or @username').fill('pm.marcus')
    await page.getByRole('button', { name: /pm\.marcus/ }).first().click()
    const picker = page.getByLabel('Role in the project')
    await expect(picker).toBeVisible()
    await expect(picker.locator('option')).toHaveText(['Member (Team Member)', 'Admin (Team Leader)', 'Viewer'])
  })

  test('Roles & Permissions names the project roles the same way, and keeps its note of the business names', async ({ page }) => {
    await login(page)
    await page.goto('/admin/roles')
    const list = page.getByRole('navigation', { name: 'Roles' })
    for (const name of ['Owner', 'Admin (Team Leader)', 'Member (Team Member)', 'Viewer']) {
      await expect(list.getByRole('button', { name: `${name} Project role` })).toBeVisible()
    }
    // the heading of the selected role uses the same name, and the note of the business name stays
    await list.getByRole('button', { name: 'Admin (Team Leader) Project role' }).click()
    await expect(page.getByRole('heading', { name: 'Admin (Team Leader)' })).toBeVisible()
    await expect(page.locator('strong', { hasText: 'Team Leader' }).first()).toBeVisible()
    await list.getByRole('button', { name: 'Member (Team Member) Project role' }).click()
    await expect(page.getByRole('heading', { name: 'Member (Team Member)' })).toBeVisible()
    await expect(page.locator('strong', { hasText: 'Team Member' }).first()).toBeVisible()
  })
})
