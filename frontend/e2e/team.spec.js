import { test, expect } from '@playwright/test'
import { login } from './helpers.js'

// Seed data (database/init/02-seed.sql): contractor.felix is INACTIVE,
// exemployee.diego SUSPENDED; dev.hana and newuser are ACTIVE. The backend
// still rejects inviting a non-ACTIVE account on its own (see
// project-team.spec.js) — this checks the Team page doesn't even offer it.
const INVITE_BUTTON = /invite to team/i

async function selectMember(page, username) {
  await page.getByPlaceholder('Search by name or @username').fill(username)
  await page.getByRole('button', { name: new RegExp(`@${username}$`) }).click()
}

test.describe('Team page: who can be invited to a project', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/team')
  })

  for (const [username, status] of [
    ['contractor.felix', 'inactive'],
    ['exemployee.diego', 'suspended'],
  ]) {
    test(`a ${status} user cannot be selected for an invitation`, async ({ page }) => {
      await selectMember(page, username)
      await expect(page.getByRole('heading', { level: 2 })).toBeVisible()
      await expect(page.getByText(`This account is ${status} and can't be invited to a project.`)).toBeVisible()
      await expect(page.getByRole('button', { name: INVITE_BUTTON })).toHaveCount(0)
    })
  }

  for (const username of ['dev.hana', 'newuser']) {
    test(`an ACTIVE user (${username}) can still be invited`, async ({ page }) => {
      await selectMember(page, username)
      await expect(page.getByRole('button', { name: INVITE_BUTTON })).toBeVisible()
      await expect(page.getByText(/can't be invited to a project/)).toHaveCount(0)
    })
  }

  test('switching from an inactive user back to an active one restores the invite control', async ({ page }) => {
    await selectMember(page, 'contractor.felix')
    await expect(page.getByRole('button', { name: INVITE_BUTTON })).toHaveCount(0)
    await selectMember(page, 'dev.hana')
    await expect(page.getByRole('button', { name: INVITE_BUTTON })).toBeVisible()
  })

  test('inactive and suspended users stay in the directory list (only the invitation is blocked)', async ({ page }) => {
    for (const username of ['contractor.felix', 'exemployee.diego']) {
      await page.getByPlaceholder('Search by name or @username').fill(username)
      await expect(page.getByRole('button', { name: new RegExp(`@${username}$`) })).toBeVisible()
    }
  })
})
