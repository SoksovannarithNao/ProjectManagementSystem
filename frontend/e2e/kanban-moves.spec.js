import { test, expect } from '@playwright/test'
import { setup, card, column, openBoard } from './kanban-helpers.js'

// Kanban: moving a card between columns by drag and drop or the "Move to" menu (#35). Each
// test builds its own throw-away project (owner pm.olivia) with a throw-away Team Member
// account (see kanban-helpers.js). What a move does to the rest of the system is in
// kanban-integrity.spec.js.

// Five columns do not fit the default 1280px window, and a drop needs both ends on screen.
test.use({ viewport: { width: 1900, height: 900 } })

test.describe('Kanban moves', () => {
  test('the Owner drags a card from column to column, up to Completed', async ({ page, request }) => {
    const ctx = await setup(request)
    try {
      const t = await ctx.task('Draft the plan')
      await openBoard(page, 'pm.olivia', ctx.stamp)
      await expect(column(page, 'todo').locator(card(page, t))).toBeVisible()

      await card(page, t).dragTo(column(page, 'inprogress'))
      await expect(column(page, 'inprogress').locator(card(page, t))).toBeVisible()
      expect(await ctx.status(t)).toBe('IN_PROGRESS')

      await card(page, t).dragTo(column(page, 'review'))
      await expect(column(page, 'review').locator(card(page, t))).toBeVisible()
      expect(await ctx.status(t)).toBe('IN_REVIEW')

      // the Owner may approve, so Completed is open to them
      await card(page, t).dragTo(column(page, 'done'))
      await expect(column(page, 'done').locator(card(page, t))).toBeVisible()
      expect(await ctx.status(t)).toBe('COMPLETED')

      // and a finished task can be reopened on purpose
      await card(page, t).dragTo(column(page, 'todo'))
      await expect(column(page, 'todo').locator(card(page, t))).toBeVisible()
      expect(await ctx.status(t)).toBe('TODO')
    } finally {
      await ctx.cleanup()
    }
  })

  test('a drop that the rules refuse says why and leaves the card where it was', async ({ page, request }) => {
    const ctx = await setup(request)
    try {
      const open = await ctx.task('Has an open subtask', { status: 'IN_PROGRESS' })
      expect((await request.post('/api/subtasks', { headers: ctx.pm, data: { taskId: open.id, title: 'still to do', status: 'TODO' } })).status()).toBe(201)
      const prerequisite = await ctx.task('Prerequisite')
      const waiting = await ctx.task('Waiting on it')
      expect((await request.post('/api/task-dependencies', { headers: ctx.pm, data: { taskId: waiting.id, dependsOnTaskId: prerequisite.id } })).status()).toBe(201)
      await openBoard(page, 'pm.olivia', ctx.stamp)

      // an open subtask keeps a task from Completed
      await card(page, open).dragTo(column(page, 'done'))
      await expect(page.getByText('Complete all subtasks before marking this task as completed')).toBeVisible()
      await expect(column(page, 'inprogress').locator(card(page, open))).toBeVisible()
      expect(await ctx.status(open)).toBe('IN_PROGRESS')

      // a blocked task sits in the Blocked column, cannot start, and Blocked is not a place to drop
      await expect(column(page, 'blocked').locator(card(page, waiting))).toBeVisible()
      await card(page, waiting).dragTo(column(page, 'inprogress'))
      await expect(page.getByText(`Blocked by: Prerequisite ${ctx.stamp}`).first()).toBeVisible()
      expect(await ctx.status(waiting)).toBe('TODO')
      await card(page, prerequisite).dragTo(column(page, 'blocked'))
      await expect(page.getByText('Blocked is not a status').first()).toBeVisible()
      expect(await ctx.status(prerequisite)).toBe('TODO')
    } finally {
      await ctx.cleanup()
    }
  })

  test('a Team Member moves only their own cards, and cannot complete one', async ({ page, request }) => {
    const ctx = await setup(request)
    try {
      const mine = await ctx.task('Assigned to the member', {}, ctx.member)
      const others = await ctx.task('Not assigned to the member')
      await openBoard(page, ctx.member.username, ctx.stamp)
      await expect(card(page, mine)).toBeVisible()
      await expect(card(page, others)).toBeVisible()

      // a card the member cannot change has no handle and no Move menu
      await expect(card(page, others)).toHaveAttribute('draggable', 'false')
      await expect(card(page, others).getByRole('button', { name: /to another column/ })).toHaveCount(0)
      await expect(card(page, mine)).toHaveAttribute('draggable', 'true')

      await card(page, mine).dragTo(column(page, 'inprogress'))
      await expect(column(page, 'inprogress').locator(card(page, mine))).toBeVisible()
      expect(await ctx.status(mine)).toBe('IN_PROGRESS')

      // completing is an approval: the member is pointed to In Review, which opens the request
      await card(page, mine).dragTo(column(page, 'done'))
      await expect(page.getByText(/Only an approver can complete a task/).first()).toBeVisible()
      expect(await ctx.status(mine)).toBe('IN_PROGRESS')
      await card(page, mine).dragTo(column(page, 'review'))
      await expect(column(page, 'review').locator(card(page, mine))).toBeVisible()
      expect(await ctx.status(mine)).toBe('IN_REVIEW')
      const approvals = await (await request.get(`/api/tasks/${mine.id}/approvals`, { headers: ctx.pm })).json()
      expect(approvals.some((a) => a.decision === 'PENDING')).toBe(true)
    } finally {
      await ctx.cleanup()
    }
  })

  test('the Move to menu does the same without dragging, and explains what is not allowed', async ({ page, request }) => {
    const ctx = await setup(request)
    try {
      const mine = await ctx.task('Menu task', { status: 'IN_PROGRESS' }, ctx.member)
      await openBoard(page, ctx.member.username, ctx.stamp)

      await card(page, mine).getByRole('button', { name: /to another column/ }).click()
      const menu = page.getByRole('menu', { name: 'Move to' })
      await expect(menu.getByRole('menuitem', { name: /In Progress \(current\)/ })).toBeDisabled()
      const completed = menu.getByRole('menuitem', { name: /Completed/ })
      await expect(completed).toBeDisabled()
      await expect(completed).toContainText('Only an approver can complete a task')

      await menu.getByRole('menuitem', { name: 'In Review', exact: true }).click()
      await expect(page.getByText(/Moved .* to In Review/)).toBeVisible()
      await expect(column(page, 'review').locator(card(page, mine))).toBeVisible()
      expect(await ctx.status(mine)).toBe('IN_REVIEW')
    } finally {
      await ctx.cleanup()
    }
  })

  test('a Viewer sees the board but cannot move anything', async ({ page, request }) => {
    const ctx = await setup(request)
    try {
      const t = await ctx.task('Read only')
      // the throw-away member becomes a Viewer of the project
      const rows = await (await request.get(`/api/project-members/project/${ctx.project.id}`, { headers: ctx.pm })).json()
      const row = rows.find((m) => m.user.username === ctx.member.username)
      expect((await request.put(`/api/project-members/${row.id}`, { headers: ctx.pm, data: { projectId: ctx.project.id, userId: ctx.member.id, projectRole: 'VIEWER' } })).status()).toBe(200)
      await openBoard(page, ctx.member.username, ctx.stamp)
      await expect(card(page, t)).toBeVisible()
      await expect(card(page, t)).toHaveAttribute('draggable', 'false')
      await expect(page.getByRole('button', { name: /to another column/ })).toHaveCount(0)
    } finally {
      await ctx.cleanup()
    }
  })

  test('the server refuses a move the screen would not offer', async ({ request }) => {
    const ctx = await setup(request)
    try {
      const t = await ctx.task('Direct call', { status: 'IN_PROGRESS' }, ctx.member)
      const body = { ...(await (await request.get(`/api/tasks/${t.id}`, { headers: ctx.pm })).json()) }
      const res = await request.put(`/api/tasks/${t.id}`, {
        headers: ctx.member.headers,
        data: { projectId: ctx.project.id, title: body.title, priority: body.priority, startDate: body.startDate, dueDate: body.dueDate, status: 'COMPLETED' },
      })
      expect(res.status()).toBe(403)
      expect(await ctx.status(t)).toBe('IN_PROGRESS')
    } finally {
      await ctx.cleanup()
    }
  })
})
