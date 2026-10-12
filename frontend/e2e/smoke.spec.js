import { test, expect } from '@playwright/test'
import { login } from './helpers.js'

// Every screen a signed-in administrator can reach opens without a script error, a
// server error or an error page. Cheap, broad protection against a broken build or a
// page that crashes on real data; the other specs check what each screen does.
const SCREENS = [
  ['/', 'Dashboard'],
  ['/tasks', 'Tasks'],
  ['/projects', 'Projects'],
  ['/calendar', 'Calendar'],
  ['/kanban', 'Kanban'],
  ['/team', 'Team'],
  ['/reports', 'Reports'],
  ['/admin/users', 'User administration'],
  ['/admin/roles', 'Roles and permissions'],
  ['/profile', 'Profile'],
  ['/settings', 'Settings'],
  ['/help', 'Help'],
]

const ERROR_PAGE_TITLES = /Page not found|Something went wrong|You do not have access to this page|Cannot reach the server|Service unavailable/

test.describe('Every screen opens', () => {
  for (const [path, name] of SCREENS) {
    test(`${name} (${path})`, async ({ page }) => {
      const problems = []
      page.on('pageerror', (error) => problems.push(`script error: ${error.message}`))
      page.on('response', (response) => {
        if (response.url().includes('/api/') && response.status() >= 500) {
          problems.push(`${response.status()} from ${response.url()}`)
        }
      })

      await login(page)
      await page.goto(path)
      await page.waitForLoadState('networkidle')

      await expect(page.getByText(ERROR_PAGE_TITLES)).toHaveCount(0)
      await expect(page.locator('main')).not.toBeEmpty()
      expect(problems).toEqual([])
    })
  }

  test('a project opens, with each of its views', async ({ page }) => {
    const problems = []
    page.on('pageerror', (error) => problems.push(`script error: ${error.message}`))
    page.on('response', (response) => {
      if (response.url().includes('/api/') && response.status() >= 500) {
        problems.push(`${response.status()} from ${response.url()}`)
      }
    })

    await login(page)
    await page.goto('/projects')
    const firstProject = page.locator('main a[href^="/projects/"]').first()
    await firstProject.waitFor()
    const href = await firstProject.getAttribute('href')
    expect(href).toMatch(/^\/projects\/\d+$/)

    for (const suffix of ['', '/team', '/workload', '/timeline', '/gantt']) {
      await page.goto(`${href}${suffix}`)
      await page.waitForLoadState('networkidle')
      await expect(page.getByText(ERROR_PAGE_TITLES)).toHaveCount(0)
      await expect(page.locator('main')).not.toBeEmpty()
    }
    expect(problems).toEqual([])
  })
})
