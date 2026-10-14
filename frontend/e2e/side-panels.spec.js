import { test, expect } from '@playwright/test'
import { login } from './helpers.js'

// "New Task", "Add member" (project page) and "Add User" (Team page, an administrator creating an account) open in the shared right-hand
// SidePanel, not in the centred pop-up. Read-only: each test closes what it opens and saves nothing.

const VIEWPORT = { width: 1440, height: 900 }

// The scrim that holds a panel covers the whole screen; the panel sits against its right edge.
const scrimOf = (panel) => panel.locator('xpath=..')
const rightEdge = async (box) => Math.round(box.x + box.width)

// The panel slides in, so wait until it has stopped at the right edge, then check it fills the height.
async function expectRightPanel(page, name) {
  const panel = page.getByRole('dialog', { name, exact: true })
  await expect(panel).toBeVisible()
  await expect
    .poll(async () => (await rightEdge(await panel.boundingBox())) - (await rightEdge(await scrimOf(panel).boundingBox())))
    .toBe(0)
  const box = await panel.boundingBox()
  expect(box.width).toBeLessThanOrEqual(441)
  expect(box.height).toBeGreaterThanOrEqual(VIEWPORT.height - 1)
  return panel
}

test.describe('forms open in the right-hand side panel', () => {
  test.use({ viewport: VIEWPORT })

  test('New Task: a side panel that Escape closes, and that asks before throwing away typed text', async ({ page }) => {
    await login(page, 'pm.olivia')
    await page.goto('/tasks')
    await page.getByRole('button', { name: 'New Task' }).first().click()
    const panel = await expectRightPanel(page, 'New Task')

    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)

    await page.getByRole('button', { name: 'New Task' }).first().click()
    await expectRightPanel(page, 'New Task')
    await page.getByLabel('Title').fill('Typed but not saved')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Discard changes?' })).toBeVisible()
    await page.getByRole('button', { name: 'Discard' }).click()
    await expect(page.getByRole('dialog', { name: 'New Task', exact: true })).toHaveCount(0)
  })

  test('Add member on the project page is a side panel', async ({ page }) => {
    await login(page, 'pm.olivia')
    await page.goto('/projects')
    await page.getByRole('link', { name: /Website Redesign/ }).first().click()
    await page.getByRole('button', { name: 'Add member' }).click()
    const panel = await expectRightPanel(page, 'Add Member')
    await expect(panel.getByLabel('Role in this project')).toBeVisible()
    await panel.getByRole('button', { name: 'Cancel' }).click()
    await expect(panel).toHaveCount(0)
  })

  test('Add User on the Team page is a side panel, and its small "add a position" dialog still opens centred on the screen', async ({ page }) => {
    await login(page)
    await page.goto('/team')
    await page.getByRole('button', { name: 'Add User' }).click()
    const panel = await expectRightPanel(page, 'Add User')

    await panel.getByLabel('Position').selectOption({ label: '+ Add New Position' })
    const heading = page.getByRole('heading', { name: 'Add New Position' })
    await expect(heading).toBeVisible()
    // the pop-up is laid out against the screen (centred), not trapped inside the sliding panel
    await expect
      .poll(async () => {
        const box = await heading.boundingBox()
        return Math.abs(box.x + box.width / 2 - VIEWPORT.width / 2) < 200
      })
      .toBe(true)
    await page.getByRole('button', { name: 'Cancel' }).last().click()
    await expect(heading).toHaveCount(0)
    await expect(panel).toBeVisible()

    await panel.getByRole('button', { name: 'Cancel' }).click()
    await expect(panel).toHaveCount(0)
  })

  test('on a phone the panel takes the full width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, 'pm.olivia')
    await page.goto('/tasks')
    await page.getByRole('button', { name: 'New Task' }).first().click()
    const panel = page.getByRole('dialog', { name: 'New Task', exact: true })
    await expect(panel).toBeVisible()
    // it fills the scrim from side to side
    await expect
      .poll(async () => Math.round((await panel.boundingBox()).width) - Math.round((await scrimOf(panel).boundingBox()).width))
      .toBe(0)
  })
})
