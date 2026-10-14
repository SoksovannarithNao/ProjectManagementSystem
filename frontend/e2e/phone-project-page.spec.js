import { test, expect } from '@playwright/test'
import { login } from './helpers.js'
import { apiLogin } from './kanban-helpers.js'

// On a 390px phone no project page is wider than the screen. Two things used to push it out: the role picker in the
// team list (its widest option, "Owner (transfer ownership)", set its width) and a long project name in the header
// (the title's wrapper could not shrink, so the name never truncated). Read-only: it only opens the pages.

test.use({ viewport: { width: 390, height: 844 } })

test('every project page fits a phone: no sideways scrolling', async ({ page, request }) => {
  const admin = await apiLogin(request, 'admin.system')
  const projects = await (await request.get('/api/projects', { headers: admin })).json()
  expect(projects.length).toBeGreaterThan(0)
  await login(page, 'admin.system')
  for (const p of projects) {
    await page.goto(`/projects/${p.id}`)
    await expect(page.locator('main header h1')).toBeVisible()
    await page.waitForLoadState('networkidle')
    const over = await page.evaluate(() => {
      const d = globalThis.document.documentElement
      return d.scrollWidth - d.clientWidth
    })
    expect(over, `project ${p.id} is ${over}px wider than the screen`).toBeLessThanOrEqual(0)
  }
})
