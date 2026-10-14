import { test, expect } from '@playwright/test'
import { login } from './helpers.js'

// The dashboard polish of 2026-10-14: the overdue count is a link-pill, a failed load is said
// out loud (it used to look like "Nothing due soon"), and the manager's workload card fits a
// phone. Read-only: nothing here changes data.

test.describe('dashboard polish', () => {
  test('the overdue count is a pill that opens the task list', async ({ page }) => {
    await login(page, 'pm.olivia')
    const pill = page.getByRole('link', { name: /\d+ overdue/ })
    await expect(pill).toBeVisible()
    await pill.click()
    await expect(page).toHaveURL(/\/tasks$/)
  })

  test('a failed load shows a message with a retry, and the figures come back after it', async ({ page }) => {
    await login(page, 'pm.olivia')
    await page.route('**/api/dashboard/stats', (route) => route.abort())
    await page.reload()

    const banner = page.getByTestId('dashboard-load-error')
    await expect(banner).toContainText('could not be loaded')
    await expect(page.getByTestId('dashboard-stats').getByText('—').first()).toBeVisible()

    await page.unroute('**/api/dashboard/stats')
    await banner.getByRole('button', { name: 'Try again' }).click()
    await expect(banner).toHaveCount(0)
    await expect(page.getByTestId('dashboard-stats').getByText('Total projects')).toBeVisible()
    await expect(page.getByTestId('dashboard-stats').getByText('—')).toHaveCount(0)
  })

  test('on a phone the workload card shows who is overloaded without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, 'pm.olivia')
    const workload = page.getByTestId('dashboard-workload')
    await expect(workload.getByTestId('workload-row').first()).toBeVisible()
    await expect(workload.getByText('Overloaded').first()).toBeVisible()
    const scrolls = await page.evaluate(() => globalThis.document.documentElement.scrollWidth > globalThis.document.documentElement.clientWidth)
    expect(scrolls).toBe(false)
  })

  test('on a desktop project health and team workload share the right column, and the chart spans both', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await login(page, 'pm.olivia')
    const card = (name) => page.locator('section', { has: page.getByRole('heading', { name, exact: true }) })
    const [tasks, delayed, projects, workload, chart] = await Promise.all(
      ['Task Overview', 'Delayed projects', 'Projects', 'Team workload', 'Task activity'].map(async (n) => {
        await expect(card(n)).toBeVisible()
        return card(n).boundingBox()
      }),
    )
    // right column, in this order: project health first, then the team workload
    expect(Math.abs(delayed.x - projects.x)).toBeLessThan(2)
    expect(Math.abs(projects.x - workload.x)).toBeLessThan(2)
    expect(delayed.y).toBeLessThan(projects.y)
    expect(projects.y).toBeLessThan(workload.y)
    // the task cards are the wider column, to its left
    expect(tasks.x).toBeLessThan(delayed.x)
    expect(tasks.width).toBeGreaterThan(delayed.width)
    // the chart starts below both columns and spans them
    expect(chart.y).toBeGreaterThan(workload.y + workload.height - 2)
    expect(chart.width).toBeGreaterThan(tasks.width + delayed.width)
    // a project preview in the narrow column is one card wide, and nothing scrolls inside it
    const previews = await page.locator('a[href^="/projects/"].card').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)))
    expect(new Set(previews).size).toBe(1)
  })

  test('a long team list scrolls inside the workload card instead of lengthening the page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await login(page, 'pm.olivia')
    const list = page.getByTestId('dashboard-workload').getByRole('list', { name: 'Workload by person' })
    await expect(list.getByTestId('workload-row').first()).toBeVisible()
    const box = await list.boundingBox()
    expect(box.height).toBeLessThanOrEqual(401)
    // the seeded team has more people than fit, so the list itself scrolls (and a keyboard can reach it)
    expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
    await list.focus()
    await expect(list).toBeFocused()
    const last = list.getByTestId('workload-row').last()
    await last.scrollIntoViewIfNeeded()
    await expect(last).toBeInViewport()
    // the footnote stays below the scrolling area
    await expect(page.getByTestId('dashboard-workload').getByText(/Team average/)).toBeVisible()
  })

  test('on a desktop the two columns do not leave a hole: the right column starts level with the left', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await login(page, 'pm.olivia')
    const left = page.getByRole('heading', { name: 'Task Overview' })
    const right = page.getByRole('heading', { name: 'Delayed projects' })
    await expect(left).toBeVisible()
    await expect(right).toBeVisible()
    const [a, b] = await Promise.all([left.boundingBox(), right.boundingBox()])
    expect(Math.abs(a.y - b.y)).toBeLessThan(2)
    // stacked cards are 24px apart whatever the height of their neighbours in the other column
    const card = (name) => page.locator('section', { has: page.getByRole('heading', { name, exact: true }) })
    const due = await card('Due & Overdue').boundingBox()
    const activity = await card('Recent activity').boundingBox()
    expect(Math.abs(activity.y - (due.y + due.height) - 24)).toBeLessThan(2)
  })
})
