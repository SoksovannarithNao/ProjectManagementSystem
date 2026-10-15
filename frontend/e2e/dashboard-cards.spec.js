import { test, expect } from '@playwright/test'
import { login } from './helpers.js'
import { apiLogin } from './kanban-helpers.js'

// The six figure cards at the top of the dashboard: each has an icon, the number, and one line of context worked
// out from the same server figures (GET /api/dashboard/stats), and Average completion also shows a thin bar.

const share = (part, whole) => (whole > 0 ? `${Math.round((part / whole) * 100)}% of all projects` : 'No projects yet')

test.describe('dashboard figure cards', () => {
  test('each card shows its number and a line of context that agree with the server', async ({ page, request }) => {
    test.setTimeout(60000)
    const headers = await apiLogin(request, 'pm.olivia')
    await login(page, 'pm.olivia')
    const cards = page.getByTestId('dashboard-stats')
    await expect(cards.getByText('Total tasks', { exact: true })).toBeVisible()

    // Other specs create and finish work for this account while this runs, so the figures can move between two reads:
    // each try reads the server, reloads the page and compares at once, until the two agree.
    await expect
      .poll(async () => {
        const { projects: p, tasks: t } = await (await request.get('/api/dashboard/stats', { headers })).json()
        await page.reload()
        await expect(cards.getByText('Total tasks', { exact: true })).toBeVisible()
        await expect(cards.getByText(/% of all projects|No projects yet/).first()).toBeVisible()
        const text = async (label) => (await cards.getByText(label, { exact: true }).locator('xpath=..').innerText()).replace(/\s+/g, ' ')
        const [total, active, completed, delayed, average, tasks] = await Promise.all(
          ['Total projects', 'Active projects', 'Completed projects', 'Delayed projects', 'Average completion', 'Total tasks'].map(text)
        )
        const others = [[p.planning, 'planning'], [p.onHold, 'on hold'], [p.cancelled, 'cancelled']]
          .filter(([n]) => n > 0)
          .map(([n, what]) => `${n} ${what}`)
          .join(' · ')
        return (
          total.includes(String(p.total)) && total.includes(others || 'None planned, on hold or cancelled') &&
          active.includes(share(p.active, p.total)) &&
          completed.includes(share(p.completed, p.total)) &&
          delayed.includes(p.delayed > 0 ? 'Past their end date' : 'Nothing behind schedule') &&
          average.includes(`${Math.round(Number(p.averageProgress))}%`) &&
          tasks.includes(`${t.completed} done · ${t.overdue} overdue`)
        )
      }, { timeout: 30000, intervals: [300] })
      .toBe(true)
  })

  test('every card has an icon chip, and Average completion has a progress bar', async ({ page }) => {
    await login(page, 'pm.olivia')
    const cards = page.getByTestId('dashboard-stats')
    await expect(cards.getByText('Total tasks', { exact: true })).toBeVisible()
    for (const label of ['Total projects', 'Active projects', 'Completed projects', 'Delayed projects', 'Average completion', 'Total tasks']) {
      const card = cards.getByText(label, { exact: true }).locator('xpath=..')
      await expect(card.locator('svg').first(), label).toBeVisible()
    }
    const average = cards.getByText('Average completion', { exact: true }).locator('xpath=..')
    await expect(average.locator('.bg-divider')).toHaveCount(1)
  })

  test('the cards stay the same height in a row', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await login(page, 'pm.olivia')
    const cards = page.getByTestId('dashboard-stats')
    await expect(cards.getByText('Total tasks', { exact: true })).toBeVisible()
    const heights = await cards.locator('> div').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
    expect(heights).toHaveLength(6)
    expect(new Set(heights).size, JSON.stringify(heights)).toBe(1)
  })
})
