import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD, SEED_ADMIN_USERNAME } from './helpers.js'

// Checklist risk R-5, the Kanban board: every column is read from the server on its own (its cards, 25 at a
// time, and its total), the Blocked column through the new `blocked` filter, so the board no longer reads
// every task or every assignment.

test.use({ viewport: { width: 1900, height: 900 } })

const apiLogin = async (request, username) => {
  const res = await request.post('/api/auth/login', { data: { username, password: SEED_PASSWORD } })
  expect(res.status()).toBe(200)
  return { Authorization: `Bearer ${(await res.json()).token}` }
}
const getJson = async (request, headers, path, params = {}) => {
  const res = await request.get(path, { headers, params })
  expect(res.status(), path).toBe(200)
  return res.json()
}
// The specs share one database and run side by side, so a figure read a moment ago can already be stale
// when another spec creates or moves a task. Poll until the two agree.
const agree = (counted, expected) =>
  expect.poll(async () => JSON.stringify(await counted()) === JSON.stringify(await expected())).toBe(true)

const COLUMNS = [
  { id: 'todo', status: 'TODO', blocked: false },
  { id: 'inprogress', status: 'IN_PROGRESS' },
  { id: 'review', status: 'IN_REVIEW' },
  { id: 'blocked', status: 'TODO', blocked: true },
  { id: 'done', status: 'COMPLETED' },
]

test.describe('kanban columns: API', () => {
  test('blocked=true keeps only the blocked tasks and blocked=false the others, and together they are every To Do task', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const totals = async () => {
      const blocked = (await getJson(request, admin, '/api/tasks', { status: 'TODO', blocked: true, size: 1 })).total
      const open = (await getJson(request, admin, '/api/tasks', { status: 'TODO', blocked: false, size: 1 })).total
      const all = (await getJson(request, admin, '/api/tasks', { status: 'TODO', size: 1 })).total
      return { sum: blocked + open, all }
    }
    await agree(async () => (await totals()).sum, async () => (await totals()).all)

    const blockedPage = await getJson(request, admin, '/api/tasks', { status: 'TODO', blocked: true, size: 200 })
    expect(blockedPage.items.every((t) => t.blocked === true && t.status === 'TODO')).toBe(true)
    const openPage = await getJson(request, admin, '/api/tasks', { status: 'TODO', blocked: false, size: 200 })
    expect(openPage.items.every((t) => t.blocked === false && t.status === 'TODO')).toBe(true)
    // a task is in exactly one of the two
    const ids = new Set(blockedPage.items.map((t) => t.id))
    expect(openPage.items.some((t) => ids.has(t.id))).toBe(false)
  })

  test('each column total equals the tasks of that column, under a project and a priority filter too', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const projects = await getJson(request, admin, '/api/projects')
    const project = projects[0]
    const expectedTotals = async (filters) => {
      const tasks = await getJson(request, admin, '/api/tasks', filters)
      return COLUMNS.map((c) => tasks.filter((t) => t.status === c.status && (c.blocked === undefined || t.blocked === c.blocked)).length)
    }
    const columnTotals = async (filters) =>
      Promise.all(COLUMNS.map(async (c) => {
        const params = { ...filters, status: c.status, size: 1 }
        if (c.blocked !== undefined) params.blocked = c.blocked
        return (await getJson(request, admin, '/api/tasks', params)).total
      }))
    for (const filters of [{}, { projectId: project.id }, { priority: ['HIGH', 'URGENT'] }]) {
      await agree(() => columnTotals(filters), () => expectedTotals(filters))
    }
  })

  test('a bad blocked value is a 400', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    expect((await request.get('/api/tasks', { headers: admin, params: { blocked: 'maybe' } })).status()).toBe(400)
  })
})

test.describe('kanban columns: the board', () => {
  test('a long column shows 25 cards and its real total, loads more on request, and nothing reads every task', async ({ page, request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const doneTotal = (await getJson(request, admin, '/api/tasks', { status: 'COMPLETED', size: 1 })).total
    expect(doneTotal).toBeGreaterThan(25) // the demo data holds more than one page of completed tasks

    const reads = { whole: [], assignments: [], columns: [] }
    page.on('request', (r) => {
      const url = new URL(r.url())
      if (r.method() !== 'GET') return
      if (url.pathname === '/api/tasks' && !url.searchParams.has('size')) reads.whole.push(url.search)
      if (url.pathname === '/api/tasks' && url.searchParams.has('size')) reads.columns.push(url.searchParams)
      if (url.pathname === '/api/task-assignees') reads.assignments.push(url.search)
    })
    await login(page)
    await page.goto('/kanban')
    await expect(page.getByTestId('kanban-board')).toHaveAttribute('aria-busy', 'false')

    const done = page.getByTestId('kanban-column-done')
    await expect(done.getByTestId('kanban-card')).toHaveCount(25)
    // the badge is the column's real total, not the 25 on screen
    await expect(done).toContainText(String(doneTotal))
    const more = page.getByTestId('kanban-more-done')
    await expect(more).toContainText(`Show more (${doneTotal - 25} more)`)

    await more.click()
    await expect(done.getByTestId('kanban-card')).toHaveCount(Math.min(doneTotal, 50))

    // every read is one column's page of 25 (or the next page), the five columns each asking for their own status
    await page.waitForLoadState('networkidle')
    expect(reads.whole).toEqual([])
    expect(reads.assignments).toEqual([])
    expect(reads.columns.length).toBeGreaterThanOrEqual(5)
    expect(reads.columns.every((p) => p.get('size') === '25')).toBe(true)
    const statuses = new Set(reads.columns.map((p) => p.get('status')))
    expect([...statuses].sort()).toEqual(['COMPLETED', 'IN_PROGRESS', 'IN_REVIEW', 'TODO'])
    expect(reads.columns.some((p) => p.get('blocked') === 'true')).toBe(true)
    expect(reads.columns.some((p) => p.get('blocked') === 'false')).toBe(true)
  })

  test('the board says it is busy until the search has been applied', async ({ page }) => {
    await login(page)
    await page.goto('/kanban')
    const board = page.getByTestId('kanban-board')
    await expect(board).toHaveAttribute('aria-busy', 'false')
    await page.getByPlaceholder('Search tasks').fill('zzz-no-such-task')
    await expect(board).toHaveAttribute('aria-busy', 'true') // the search waits a moment before it is sent
    await expect(board).toHaveAttribute('aria-busy', 'false')
    await expect(page.getByTestId('kanban-card')).toHaveCount(0)
    await expect(page.getByTestId('kanban-column-todo')).toContainText('0')
  })
})
