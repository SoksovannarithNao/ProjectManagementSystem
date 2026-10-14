import { test, expect } from '@playwright/test'
import { login } from './helpers.js'
import { apiLogin } from './kanban-helpers.js'

// The page header (the shared TopBar) stays at the top while the page scrolls under it, on every page. Read-only.
// A short window is used so every page is long enough to scroll.

const PAGES = [
  '/', '/tasks', '/projects', '/calendar', '/kanban', '/team', '/reports', '/admin/users', '/admin/roles', '/admin/audit',
  '/settings', '/help', '/profile',
]

const scrollDown = (page) =>
  page.evaluate(() => {
    const d = globalThis.document
    const room = d.documentElement.scrollHeight - globalThis.innerHeight
    globalThis.scrollTo(0, Math.min(600, room))
    globalThis.dispatchEvent(new Event('scroll'))
    return room
  })

// The header is at the very top, its title is not covered by anything, and the page below does not show through it.
async function expectPinned(page) {
  const header = page.locator('main header')
  await expect.poll(async () => Math.round((await header.boundingBox()).y)).toBe(0)
  const titleOnTop = await header.locator('h1').evaluate((h1) => {
    const r = h1.getBoundingClientRect()
    const hit = h1.ownerDocument.elementFromPoint(r.left + 4, r.top + r.height / 2)
    return h1.closest('header').contains(hit)
  })
  expect(titleOnTop).toBe(true)
  const sameAsCanvas = await header.evaluate((el) => {
    const canvas = globalThis.getComputedStyle(el.closest('main').parentElement).backgroundColor
    return globalThis.getComputedStyle(el).backgroundColor === canvas
  })
  expect(sameAsCanvas).toBe(true)
}

test.describe('sticky page header', () => {
  test.use({ viewport: { width: 1280, height: 480 } })

  for (const path of PAGES) {
    test(`${path}: the header stays at the top while the page scrolls`, async ({ page }) => {
      await login(page)
      await page.goto(path)
      await expect(page.locator('main header h1')).toBeVisible()
      await page.waitForLoadState('networkidle') // the lists fill in after the page opens
      expect(await scrollDown(page), 'the page is long enough to scroll').toBeGreaterThan(0)
      await expectPinned(page)
    })
  }

  test('a project page: the header stays at the top', async ({ page, request }) => {
    const admin = await apiLogin(request, 'admin.system')
    const projects = await (await request.get('/api/projects', { headers: admin })).json()
    await login(page)
    await page.goto(`/projects/${projects[0].id}`)
    await expect(page.locator('main header h1')).toBeVisible()
    await page.waitForLoadState('networkidle')
    expect(await scrollDown(page)).toBeGreaterThan(0)
    await expectPinned(page)
  })

  test('the notification panel opens over the content while the page is scrolled', async ({ page }) => {
    await login(page)
    await page.goto('/tasks')
    await page.waitForLoadState('networkidle')
    await scrollDown(page)
    await page.locator('main header').getByRole('button', { name: /notification/i }).first().click()
    const panel = page.locator('main header').getByText('Notifications', { exact: true }).first()
    await expect(panel).toBeVisible()
    const hit = await panel.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const at = el.ownerDocument.elementFromPoint(r.left + 4, r.top + r.height / 2)
      return el.closest('header').contains(at)
    })
    expect(hit).toBe(true)
  })

  test('a side panel and a dialog still cover the pinned header', async ({ page }) => {
    await login(page)
    await page.goto('/tasks')
    await page.waitForLoadState('networkidle')
    await scrollDown(page)
    await page.getByRole('button', { name: 'New Task' }).first().click()
    const panel = page.getByRole('dialog', { name: 'New Task', exact: true })
    await expect(panel).toBeVisible()
    const covered = await page.evaluate(() => {
      const d = globalThis.document
      const el = d.elementFromPoint(globalThis.innerWidth - 40, 30)
      return d.querySelector('[role="dialog"]').contains(el)
    })
    expect(covered).toBe(true)
  })
})

test.describe('sticky page header on a phone', () => {
  test.use({ viewport: { width: 390, height: 700 } })

  test('a wrapped header pins only its first row, and the menu stays reachable', async ({ page }) => {
    await login(page, 'admin.system')
    await page.goto('/tasks')
    await page.waitForLoadState('networkidle')
    const header = page.locator('main header')
    const full = (await header.boundingBox()).height
    expect(full).toBeGreaterThan(150) // the action buttons wrap onto further rows on a phone
    await scrollDown(page)
    await expectPinned(page)
    // only the first row stays: the rest is clipped away as the page scrolls, and no longer takes clicks
    const cut = await header.evaluate((el) => Number(/inset\(0px 0px ([\d.]+)px/.exec(el.style.clipPath || '')?.[1] ?? 0))
    expect(full - cut).toBeLessThan(125)
    // the menu button is in that first row
    await page.getByRole('button', { name: 'Open menu' }).click()
    await expect
      .poll(() =>
        page.evaluate(() => {
          const d = globalThis.document
          const at = d.elementFromPoint(40, 40)
          return [...d.querySelectorAll('aside')].some((a) => globalThis.getComputedStyle(a).position === 'fixed' && a.contains(at))
        })
      )
      .toBe(true) // the menu drawer slides in over the pinned header
  })

  test('scrolled back to the top the whole header is there again', async ({ page }) => {
    await login(page, 'admin.system')
    await page.goto('/tasks')
    await page.waitForLoadState('networkidle')
    await scrollDown(page)
    await page.evaluate(() => {
      globalThis.scrollTo(0, 0)
      globalThis.dispatchEvent(new Event('scroll'))
    })
    const clip = await page.locator('main header').evaluate((el) => el.style.clipPath)
    expect(clip).toBe('')
    await expect(page.locator('main header').getByRole('button', { name: 'New Task' })).toBeVisible()
  })
})
