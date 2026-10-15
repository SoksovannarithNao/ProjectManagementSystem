import { test, expect } from '@playwright/test'
import { login } from './helpers.js'
import { apiLogin } from './kanban-helpers.js'

// The calendar can show detail, not only add a task. A day opens a drawer in two parts on the right: the list of
// what is due that day (with "New task on this day") and, beside it, the detail of the item chosen in the list (the
// task panel, or a milestone panel with its linked tasks). A chip in the grid opens the drawer on its day with that
// item chosen. Everything runs on a throw-away project owned by pm.olivia, with items due today.

const pad = (n) => String(n).padStart(2, '0')
const isoDay = (offset = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

test.describe('calendar details', () => {
  test.describe.configure({ mode: 'serial' })
  let pm
  let project
  let milestone
  let linked
  let alone
  const stamp = Date.now()
  const NAME = `E2E calendar details ${stamp}`

  test.beforeAll(async ({ request }) => {
    pm = await apiLogin(request, 'pm.olivia')
    const created = await request.post('/api/projects', {
      headers: pm,
      data: { name: NAME, priority: 'LOW', status: 'IN_PROGRESS', startDate: isoDay(-30), endDate: isoDay(60) },
    })
    expect(created.status()).toBe(201)
    project = await created.json()
    const m = await request.post('/api/milestones', {
      headers: pm,
      data: { projectId: project.id, title: `Cal milestone ${stamp}`, description: 'Sign-off with the client', dueDate: isoDay(0) },
    })
    expect(m.status()).toBe(201)
    milestone = await m.json()
    const task = async (title, extra = {}) => {
      const res = await request.post('/api/tasks', {
        headers: pm,
        data: { projectId: project.id, title, priority: 'HIGH', status: 'TODO', startDate: isoDay(-5), dueDate: isoDay(0), ...extra },
      })
      expect(res.status()).toBe(201)
      return res.json()
    }
    linked = await task(`Cal linked ${stamp}`, { milestoneId: milestone.id })
    alone = await task(`Cal alone ${stamp}`)
  })

  test.afterAll(async ({ request }) => {
    if (project) await request.delete(`/api/projects/${project.id}`, { headers: pm })
  })

  test.use({ viewport: { width: 1440, height: 900 } })

  test('a task chip opens the drawer: the day on one side, the task on the other, not New Task', async ({ page }) => {
    await login(page, 'pm.olivia')
    await page.goto('/calendar')
    await page.getByTestId('calendar-task').filter({ hasText: alone.title }).click()
    const list = page.getByTestId('calendar-day-panel')
    const detail = page.getByTestId('calendar-detail-pane')
    await expect(list).toBeVisible()
    await expect(detail).toBeVisible()
    await expect(detail.getByRole('heading', { name: 'Subtasks' })).toBeVisible() // the task panel
    await expect(detail.getByRole('heading', { name: alone.title })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'New Task', exact: true })).toHaveCount(0)
    // the chosen item is marked in the list, and the list is to the left of the detail
    await expect(list.getByTestId('calendar-day-item').filter({ hasText: alone.title })).toHaveAttribute('aria-current', 'true')
    const [l, d] = await Promise.all([list.boundingBox(), detail.boundingBox()])
    expect(l.x + l.width).toBeLessThanOrEqual(d.x + 1)
  })

  test('a milestone chip shows its details with the linked tasks, and a linked task opens in the same place', async ({ page }) => {
    await login(page, 'pm.olivia')
    await page.goto('/calendar')
    await page.getByTestId('calendar-milestone').filter({ hasText: milestone.title }).click()
    const panel = page.getByTestId('milestone-detail-panel')
    await expect(panel).toBeVisible()
    await expect(page.getByTestId('calendar-day-panel')).toBeVisible() // the day stays beside it
    await expect(panel.getByRole('heading', { name: milestone.title })).toBeVisible()
    await expect(panel.getByText('Sign-off with the client')).toBeVisible()
    await expect(panel.getByRole('link', { name: NAME })).toBeVisible()
    await expect(panel.getByTestId('milestone-linked-task')).toHaveCount(1)
    await expect(panel.getByTestId('milestone-linked-task')).toContainText(linked.title)

    await panel.getByTestId('milestone-linked-task').click()
    await expect(page.getByTestId('calendar-detail-pane').getByRole('heading', { name: 'Subtasks' })).toBeVisible()
    await expect(panel).toHaveCount(0)
    await expect(page.getByTestId('calendar-day-panel')).toBeVisible()
  })

  test('a day lists what is due; choosing an item shows it beside the list, and the list stays', async ({ page }) => {
    await login(page, 'pm.olivia')
    await page.goto('/calendar')
    const today = new Date()
    await page.getByRole('button', { name: new RegExp(today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })) }).click()

    const panel = page.getByTestId('calendar-day-panel')
    await expect(panel).toBeVisible()
    await expect(panel.getByTestId('calendar-day-item').filter({ hasText: milestone.title })).toHaveCount(1)
    await expect(panel.getByTestId('calendar-day-item').filter({ hasText: linked.title })).toHaveCount(1)
    await expect(panel.getByTestId('calendar-day-item').filter({ hasText: alone.title })).toHaveCount(1)

    // nothing is chosen yet, so there is no second part
    await expect(page.getByTestId('calendar-detail-pane')).toHaveCount(0)

    // choosing an item shows its detail beside the list, which stays; choosing another swaps the detail only
    await panel.getByTestId('calendar-day-item').filter({ hasText: alone.title }).click()
    const detail = page.getByTestId('calendar-detail-pane')
    await expect(detail.getByRole('heading', { name: alone.title })).toBeVisible()
    await expect(panel).toBeVisible()
    await panel.getByTestId('calendar-day-item').filter({ hasText: linked.title }).click()
    await expect(detail.getByRole('heading', { name: linked.title })).toBeVisible()
    await panel.getByTestId('calendar-day-item').filter({ hasText: milestone.title }).click()
    await expect(page.getByTestId('milestone-detail-panel')).toBeVisible()

    // the X of the detail closes the detail only; the X of the list closes the drawer
    await page.getByRole('button', { name: 'Close details' }).click()
    await expect(detail).toHaveCount(0)
    await expect(panel).toBeVisible()
    await panel.getByRole('button', { name: 'Close panel' }).click()
    await expect(page.getByTestId('calendar-drawer')).toHaveCount(0)
  })

  test('Escape closes the drawer, but not while typing in the task panel', async ({ page }) => {
    await login(page, 'pm.olivia')
    await page.goto('/calendar')
    await page.getByTestId('calendar-task').filter({ hasText: alone.title }).click()
    const detail = page.getByTestId('calendar-detail-pane')
    await expect(detail.getByRole('heading', { name: 'Subtasks' })).toBeVisible()
    await detail.getByRole('combobox', { name: 'Task status' }).focus() // a field has the focus
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('calendar-drawer')).toBeVisible()
    // with the focus on plain text, Escape closes the drawer
    await detail.getByRole('heading', { name: alone.title }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('calendar-drawer')).toHaveCount(0)
  })

  test('the edit form of a task opened in the drawer is a right-hand side panel over the whole screen', async ({ page }) => {
    await login(page, 'pm.olivia')
    await page.goto('/calendar')
    await page.getByTestId('calendar-task').filter({ hasText: alone.title }).click()
    await page.getByTestId('calendar-detail-pane').getByRole('button', { name: 'Edit task' }).click()
    const form = page.getByRole('dialog', { name: 'Edit Task', exact: true })
    await expect(form).toBeVisible()
    // a side panel against the right edge of the screen, not pinned inside the sliding drawer
    await expect
      .poll(async () => {
        const box = await form.boundingBox()
        return Math.abs(box.x + box.width - page.viewportSize().width) < 16 // the page scrollbar may take a few pixels
      })
      .toBe(true)
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByTestId('calendar-drawer')).toBeVisible()
  })

  test('on a narrower window one part is shown at a time: the detail replaces the list, and its X brings the list back', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 900 })
    await login(page, 'pm.olivia')
    await page.goto('/calendar')
    await page.getByTestId('calendar-task').filter({ hasText: alone.title }).click()
    await expect(page.getByTestId('calendar-detail-pane').getByRole('heading', { name: alone.title })).toBeVisible()
    await expect(page.getByTestId('calendar-day-panel')).toBeHidden()
    await page.getByRole('button', { name: 'Close panel' }).click()
    await expect(page.getByTestId('calendar-day-panel')).toBeVisible()
    await expect(page.getByTestId('calendar-detail-pane')).toHaveCount(0)
  })

  test('"New task on this day" starts a task for that day', async ({ page }) => {
    await login(page, 'pm.olivia')
    await page.goto('/calendar')
    await page.getByRole('button', { name: new RegExp(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })) }).click()
    await page.getByRole('button', { name: 'New task on this day' }).click()
    const form = page.getByRole('dialog', { name: 'New Task', exact: true })
    await expect(form).toBeVisible()
    // the form is already set to that day (its date inputs are not labelled, so read their values)
    await expect
      .poll(async () => form.locator('input[type="date"]').evaluateAll((els) => els.map((el) => el.value)))
      .toContain(isoDay(0))
  })

  test('someone who cannot create tasks can still open a day, and sees no add button', async ({ page }) => {
    await login(page, 'dev.chen')
    await page.goto('/calendar')
    await page.getByRole('button', { name: new RegExp(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })) }).click()
    await expect(page.getByTestId('calendar-day-panel')).toBeVisible()
    await expect(page.getByRole('button', { name: 'New task on this day' })).toHaveCount(0)
  })

  test('on a phone, tapping a day opens its list', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, 'pm.olivia')
    await page.goto('/calendar')
    await page.getByRole('button', { name: new RegExp(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })) }).click()
    const panel = page.getByTestId('calendar-day-panel')
    await expect(panel).toBeVisible()
    await expect(panel.getByTestId('calendar-day-item').filter({ hasText: alone.title })).toHaveCount(1)
  })
})
