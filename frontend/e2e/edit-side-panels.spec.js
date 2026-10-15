import { test, expect } from '@playwright/test'
import { login } from './helpers.js'
import { apiLogin } from './kanban-helpers.js'

// Edit Task and Edit Project open in the same right-hand side panel as New Task and New Project (a dialog
// that slides in from the right, with its own title and close button), not in a centred pop-up.

test.describe('edit forms are side panels', () => {
  let headers
  let project
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`

  test.beforeEach(async ({ request }) => {
    headers = await apiLogin(request, 'pm.olivia')
    project = await (
      await request.post('/api/projects', {
        headers,
        data: { name: `edit panel ${stamp}`, priority: 'LOW', status: 'IN_PROGRESS', startDate: '2026-01-01', endDate: '2026-12-31' },
      })
    ).json()
  })

  test.afterEach(async ({ request }) => {
    await request.delete(`/api/projects/${project.id}`, { headers })
  })

  const isRightHandPanel = async (panel, page) => {
    // wait for the slide-in animation to finish before measuring
    await expect
      .poll(async () => {
        const box = await panel.boundingBox()
        return box ? Math.round(box.x + box.width) : 0
      })
      .toBeGreaterThanOrEqual(page.viewportSize().width - 2)
    const box = await panel.boundingBox()
    expect(box.width).toBeLessThan(page.viewportSize().width / 2) // a side panel, not a centred dialog
  }

  test('Edit Project saves from a side panel', async ({ page }) => {
    await login(page, 'pm.olivia')
    await page.goto(`/projects/${project.id}`)
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    const panel = page.getByRole('dialog', { name: 'Edit Project', exact: true })
    await expect(panel).toBeVisible()
    await isRightHandPanel(panel, page)
    await expect(panel.locator(`input[value="${project.projectCode}"]`)).toBeVisible()

    await panel.locator('input[type="text"]').first().fill(`edit panel renamed ${stamp}`)
    await panel.getByRole('button', { name: 'Save Changes' }).click()
    await expect(panel).toHaveCount(0)
    await expect(page.getByRole('heading', { name: `edit panel renamed ${stamp}` })).toBeVisible()
  })

  test('Edit Task saves from a side panel', async ({ page, request }) => {
    const task = await (
      await request.post('/api/tasks', {
        headers,
        data: { projectId: project.id, title: `panel task ${stamp}`, priority: 'LOW', status: 'TODO', startDate: '2026-10-01', dueDate: '2026-10-20' },
      })
    ).json()
    await login(page, 'pm.olivia')
    await page.goto(`/projects/${project.id}`)
    await page.getByTestId('task-row').filter({ hasText: task.title }).click()
    await page.getByRole('button', { name: 'Edit task' }).click()
    const panel = page.getByRole('dialog', { name: 'Edit Task', exact: true })
    await expect(panel).toBeVisible()
    await isRightHandPanel(panel, page)

    await panel.locator('input[type="text"]').first().fill(`panel task renamed ${stamp}`)
    await panel.getByRole('button', { name: 'Save Changes' }).click()
    await expect(panel).toHaveCount(0)
    await expect(page.getByText(`panel task renamed ${stamp}`).first()).toBeVisible()
  })
})
