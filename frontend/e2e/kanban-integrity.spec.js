import { test, expect } from '@playwright/test'
import { setup, card, column, openBoard } from './kanban-helpers.js'

// A card moved on the Kanban board must do exactly what the task panel does, and break nothing:
// progress, completion date, project and milestone progress, the approval trail, the activity
// feed, notifications, dependencies, subtasks, and a task someone else changed in the meantime.
// Each test builds its own throw-away project and checks the result through the API.

test.use({ viewport: { width: 1900, height: 900 } })

const fresh = async (request, ctx, t) => (await request.get(`/api/tasks/${t.id}`, { headers: ctx.pm })).json()
const projectNow = async (request, ctx) => (await request.get(`/api/projects/${ctx.project.id}`, { headers: ctx.pm })).json()
const milestoneNow = async (request, ctx, m) =>
  (await (await request.get(`/api/milestones/project/${ctx.project.id}`, { headers: ctx.pm })).json()).find((x) => x.id === m.id)
const toast = (page, text) => page.getByText(text).first()

test.describe('Kanban moves keep the system consistent', () => {
  test('a drag does what the task panel does: status, progress, dates, project and milestone progress, approvals, feed, notifications', async ({ page, request }) => {
    const ctx = await setup(request)
    try {
      const milestone = await (await request.post('/api/milestones', {
        headers: ctx.pm, data: { projectId: ctx.project.id, title: `M ${ctx.stamp}`, dueDate: '2026-11-30' },
      })).json()
      const a = await ctx.task('Task A', { milestoneId: milestone.id }, ctx.member)
      await ctx.task('Task B', { milestoneId: milestone.id })
      await openBoard(page, 'pm.olivia', ctx.stamp)

      // To Do -> In Progress: logged, and the assignee is told
      await card(page, a).dragTo(column(page, 'inprogress'))
      await expect(column(page, 'inprogress').locator(card(page, a))).toBeVisible()
      const feed = await (await request.get(`/api/activity-logs/task/${a.id}`, { headers: ctx.pm })).json()
      expect(feed.some((e) => e.action === 'TASK_STATUS_CHANGED' && e.description === 'Status changed from To Do to In Progress')).toBe(true)
      const told = await (await request.get('/api/notifications', { headers: ctx.member.headers })).json()
      expect(told.some((n) => n.type === 'TASK_STATUS_CHANGED' && n.message.includes('is now In Progress'))).toBe(true)

      // In Progress -> In Review: an approval request is opened
      await card(page, a).dragTo(column(page, 'review'))
      await expect(column(page, 'review').locator(card(page, a))).toBeVisible()
      const pending = await (await request.get(`/api/tasks/${a.id}/approvals`, { headers: ctx.pm })).json()
      expect(pending.some((x) => x.decision === 'PENDING')).toBe(true)
      expect((await fresh(request, ctx, a)).progress).toBe(0)

      // In Review -> Completed (the Owner approves): 100%, a completion date, the request decided,
      // and the project and the milestone move to 50% (one of two tasks)
      await card(page, a).dragTo(column(page, 'done'))
      await expect(column(page, 'done').locator(card(page, a))).toBeVisible()
      const done = await fresh(request, ctx, a)
      expect(done.status).toBe('COMPLETED')
      expect(Number(done.progress)).toBe(100)
      expect(done.completedAt).toBeTruthy()
      const decided = await (await request.get(`/api/tasks/${a.id}/approvals`, { headers: ctx.pm })).json()
      expect(decided.some((x) => x.decision === 'PENDING')).toBe(false)
      expect(decided.some((x) => x.decision === 'APPROVED')).toBe(true)
      expect(Number((await projectNow(request, ctx)).progress)).toBe(50)
      expect(Number((await milestoneNow(request, ctx, milestone)).progress)).toBe(50)

      // reopened on purpose (Completed -> To Do): back to 0%, no completion date, project and milestone back to 0%
      await card(page, a).dragTo(column(page, 'todo'))
      await expect(column(page, 'todo').locator(card(page, a))).toBeVisible()
      const reopened = await fresh(request, ctx, a)
      expect(reopened.status).toBe('TODO')
      expect(Number(reopened.progress)).toBe(0)
      expect(reopened.completedAt).toBeNull()
      expect(Number((await projectNow(request, ctx)).progress)).toBe(0)
      expect(Number((await milestoneNow(request, ctx, milestone)).progress)).toBe(0)
    } finally {
      await ctx.cleanup()
    }
  })

  test('dependencies: finishing a prerequisite unblocks its dependant, and a prerequisite cannot be reopened under a dependant that has started', async ({ page, request }) => {
    const ctx = await setup(request)
    try {
      const prerequisite = await ctx.task('Prerequisite')
      const dependant = await ctx.task('Dependant')
      expect((await request.post('/api/task-dependencies', { headers: ctx.pm, data: { taskId: dependant.id, dependsOnTaskId: prerequisite.id } })).status()).toBe(201)
      await openBoard(page, 'pm.olivia', ctx.stamp)
      await expect(column(page, 'blocked').locator(card(page, dependant))).toBeVisible()

      // finish the prerequisite: the dependant leaves Blocked and can start
      await card(page, prerequisite).dragTo(column(page, 'inprogress'))
      await expect(column(page, 'inprogress').locator(card(page, prerequisite))).toBeVisible()
      await card(page, prerequisite).dragTo(column(page, 'done'))
      await expect(column(page, 'done').locator(card(page, prerequisite))).toBeVisible()
      await expect(column(page, 'todo').locator(card(page, dependant))).toBeVisible()
      await card(page, dependant).dragTo(column(page, 'inprogress'))
      await expect(column(page, 'inprogress').locator(card(page, dependant))).toBeVisible()

      // the prerequisite cannot be taken back while the dependant is running: it stays Completed
      await card(page, prerequisite).dragTo(column(page, 'inprogress'))
      await expect(toast(page, 'prerequisite of tasks that have already started')).toBeVisible()
      await expect(toast(page, `Dependant ${ctx.stamp}`)).toBeVisible()
      await expect(column(page, 'done').locator(card(page, prerequisite))).toBeVisible()
      expect((await fresh(request, ctx, prerequisite)).status).toBe('COMPLETED')
      expect((await fresh(request, ctx, dependant)).status).toBe('IN_PROGRESS')

      // the same through the API, and for cancelling
      for (const status of ['TODO', 'CANCELLED']) {
        const body = await fresh(request, ctx, prerequisite)
        const res = await request.put(`/api/tasks/${prerequisite.id}`, {
          headers: ctx.pm,
          data: { projectId: ctx.project.id, title: body.title, priority: body.priority, startDate: body.startDate, dueDate: body.dueDate, status },
        })
        expect(res.status(), status).toBe(400)
        expect((await res.json()).message).toContain('prerequisite of tasks that have already started')
      }

      // move the dependant back first, then the prerequisite can be reopened and the dependant is blocked again
      await card(page, dependant).dragTo(column(page, 'todo'))
      await expect(column(page, 'todo').locator(card(page, dependant))).toBeVisible()
      await card(page, prerequisite).dragTo(column(page, 'todo'))
      await expect(column(page, 'todo').locator(card(page, prerequisite))).toBeVisible()
      await expect(column(page, 'blocked').locator(card(page, dependant))).toBeVisible()
      expect((await fresh(request, ctx, dependant)).blocked).toBe(true)
    } finally {
      await ctx.cleanup()
    }
  })

  test('subtasks gate Completed, checklist items do not, and progress follows them', async ({ page, request }) => {
    const ctx = await setup(request)
    try {
      const t = await ctx.task('With children', { status: 'IN_PROGRESS' })
      const first = await (await request.post('/api/subtasks', { headers: ctx.pm, data: { taskId: t.id, title: 'one', status: 'COMPLETED' } })).json()
      const second = await (await request.post('/api/subtasks', { headers: ctx.pm, data: { taskId: t.id, title: 'two', status: 'TODO' } })).json()
      expect((await request.post('/api/checklist-items', { headers: ctx.pm, data: { taskId: t.id, content: 'tick me' } })).status()).toBe(201)
      await openBoard(page, 'pm.olivia', ctx.stamp)
      await expect(card(page, t)).toContainText('1/2')

      // an open subtask keeps it out of Completed
      await card(page, t).dragTo(column(page, 'done'))
      await expect(toast(page, 'Complete all subtasks before marking this task as completed')).toBeVisible()
      expect((await fresh(request, ctx, t)).status).toBe('IN_PROGRESS')

      // the last subtask is finished elsewhere, the board is NOT reloaded: the move reads the task again and goes through,
      // although an open checklist item remains (only subtasks gate completion); progress is 100
      expect((await request.put(`/api/subtasks/${second.id}`, { headers: ctx.pm, data: { taskId: t.id, title: 'two', status: 'COMPLETED' } })).ok()).toBeTruthy()
      await card(page, t).dragTo(column(page, 'done'))
      await expect(column(page, 'done').locator(card(page, t))).toBeVisible()
      const completed = await fresh(request, ctx, t)
      expect(completed.status).toBe('COMPLETED')
      expect(Number(completed.progress)).toBe(100)

      // reopened: the progress is derived from the two subtasks and the open item (2 of 3), not 0 and not 100
      await card(page, t).dragTo(column(page, 'inprogress'))
      await expect(column(page, 'inprogress').locator(card(page, t))).toBeVisible()
      const reopened = await fresh(request, ctx, t)
      expect(reopened.status).toBe('IN_PROGRESS')
      expect(Number(reopened.progress)).toBeCloseTo(66.67, 1)
      expect(first.id).toBeTruthy()
    } finally {
      await ctx.cleanup()
    }
  })

  test('a card that is out of date cannot overwrite a newer edit or a move made by someone else', async ({ page, request }) => {
    const ctx = await setup(request)
    try {
      const edited = await ctx.task('Edited meanwhile')
      const moved = await ctx.task('Moved meanwhile')
      await openBoard(page, 'pm.olivia', ctx.stamp)
      await expect(card(page, edited)).toBeVisible()

      // someone edits the title and description after the board loaded
      const body = await fresh(request, ctx, edited)
      expect((await request.put(`/api/tasks/${edited.id}`, {
        headers: ctx.pm,
        data: { projectId: ctx.project.id, title: `Retitled ${ctx.stamp}`, description: 'written meanwhile', priority: 'HIGH', startDate: body.startDate, dueDate: body.dueDate, status: 'TODO' },
      })).ok()).toBeTruthy()
      await card(page, edited).dragTo(column(page, 'inprogress'))
      await expect(column(page, 'inprogress').getByText(`Retitled ${ctx.stamp}`)).toBeVisible()
      const after = await fresh(request, ctx, edited)
      expect(after).toMatchObject({ status: 'IN_PROGRESS', title: `Retitled ${ctx.stamp}`, description: 'written meanwhile', priority: 'HIGH' })

      // someone else starts the other task; dragging the stale To Do card is not applied and the board refreshes
      const body2 = await fresh(request, ctx, moved)
      expect((await request.put(`/api/tasks/${moved.id}`, {
        headers: ctx.pm,
        data: { projectId: ctx.project.id, title: body2.title, priority: body2.priority, startDate: body2.startDate, dueDate: body2.dueDate, status: 'IN_PROGRESS' },
      })).ok()).toBeTruthy()
      await card(page, moved).dragTo(column(page, 'review'))
      await expect(toast(page, 'This task was changed by someone else')).toBeVisible()
      await expect(column(page, 'inprogress').locator(card(page, moved))).toBeVisible()
      expect((await fresh(request, ctx, moved)).status).toBe('IN_PROGRESS')
    } finally {
      await ctx.cleanup()
    }
  })

  test('a task starts in In Progress: no jump from To Do to review or Completed, even for the Owner', async ({ page, request }) => {
    const ctx = await setup(request)
    try {
      const t = await ctx.task('No jumping')
      await openBoard(page, 'pm.olivia', ctx.stamp)

      await card(page, t).dragTo(column(page, 'review'))
      await expect(toast(page, 'A task starts in In Progress')).toBeVisible()
      await card(page, t).dragTo(column(page, 'done'))
      await expect(column(page, 'todo').locator(card(page, t))).toBeVisible()
      await expect(card(page, t)).toHaveAttribute('aria-busy', 'false')
      expect((await fresh(request, ctx, t)).status).toBe('TODO')

      // the Move to menu agrees
      await card(page, t).getByRole('button', { name: /to another column/ }).click()
      const menu = page.getByRole('menu', { name: 'Move to' })
      await expect(menu.getByRole('menuitem', { name: /^In Review/ })).toBeDisabled()
      await expect(menu.getByRole('menuitem', { name: /^Completed/ })).toBeDisabled()
      await expect(menu.getByRole('menuitem', { name: /^In Progress/ })).toBeEnabled()
    } finally {
      await ctx.cleanup()
    }
  })

  test('a Team Member cannot complete a task by dragging, and the approval trail stays in step', async ({ page, request }) => {
    const ctx = await setup(request)
    try {
      const t = await ctx.task('Member work', { status: 'IN_PROGRESS' }, ctx.member)
      await openBoard(page, ctx.member.username, ctx.stamp)

      await card(page, t).dragTo(column(page, 'done'))
      await expect(toast(page, 'Only an approver can complete a task')).toBeVisible()
      expect((await fresh(request, ctx, t)).status).toBe('IN_PROGRESS')

      // to review: an approval request is opened for an approver; back to In Progress withdraws it
      await card(page, t).dragTo(column(page, 'review'))
      await expect(column(page, 'review').locator(card(page, t))).toBeVisible()
      let history = await (await request.get(`/api/tasks/${t.id}/approvals`, { headers: ctx.pm })).json()
      expect(history.filter((x) => x.decision === 'PENDING')).toHaveLength(1)
      await card(page, t).dragTo(column(page, 'inprogress'))
      await expect(column(page, 'inprogress').locator(card(page, t))).toBeVisible()
      history = await (await request.get(`/api/tasks/${t.id}/approvals`, { headers: ctx.pm })).json()
      expect(history.filter((x) => x.decision === 'PENDING')).toHaveLength(0)
      expect((await fresh(request, ctx, t)).status).toBe('IN_PROGRESS')
    } finally {
      await ctx.cleanup()
    }
  })
})
