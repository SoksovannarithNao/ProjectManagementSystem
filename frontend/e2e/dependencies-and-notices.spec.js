import { test, expect } from '@playwright/test'
import { setup } from './kanban-helpers.js'

// Two differences between the specification and the application, closed on 2026-10-14
// (assignment-brief.md G-20 and G-21):
//   G-20  a task dependency joins two tasks of ONE project (workflow A4);
//   G-21  a status change is announced to the task's assignees and the project's Owner and Team
//         Leaders, never to the person who made it (brief B9).
// Everything runs in a throw-away project with a throw-away member (see kanban-helpers.js).

const taskBody = (project, title, status) => ({
  projectId: project.id,
  title,
  priority: 'LOW',
  status,
  startDate: '2026-01-05',
  dueDate: '2026-12-01',
})

const noticesAbout = async (request, headers, title) =>
  (await (await request.get('/api/notifications', { headers })).json()).filter(
    (n) => n.type === 'TASK_STATUS_CHANGED' && n.message.includes(title),
  )

test.describe('dependencies stay inside one project', () => {
  test('a dependency across two projects is refused, inside one it is accepted', async ({ request }) => {
    const ctx = await setup(request)
    let other
    try {
      other = await (await request.post('/api/projects', {
        headers: ctx.pm,
        data: { name: `dependency other ${ctx.stamp}`, priority: 'LOW', status: 'IN_PROGRESS', startDate: '2026-01-01', endDate: '2026-12-31' },
      })).json()
      const here = await ctx.task('Here')
      const alsoHere = await ctx.task('Also here')
      const there = (await (await request.post('/api/tasks', {
        headers: ctx.pm, data: { ...taskBody(other, `There ${ctx.stamp}`, 'TODO'), estimatedHours: 1 },
      })).json())

      const across = await request.post('/api/task-dependencies', { headers: ctx.pm, data: { taskId: here.id, dependsOnTaskId: there.id } })
      expect(across.status()).toBe(400)
      expect((await across.json()).message).toContain('same project')
      const reverse = await request.post('/api/task-dependencies', { headers: ctx.pm, data: { taskId: there.id, dependsOnTaskId: here.id } })
      expect(reverse.status()).toBe(400)

      const inside = await request.post('/api/task-dependencies', { headers: ctx.pm, data: { taskId: here.id, dependsOnTaskId: alsoHere.id } })
      expect(inside.status()).toBe(201)
      const stored = await (await request.get(`/api/task-dependencies/task/${here.id}`, { headers: ctx.pm })).json()
      expect(stored.map((d) => d.dependsOnTask.id)).toEqual([alsoHere.id])
    } finally {
      if (other) await request.delete(`/api/projects/${other.id}`, { headers: ctx.pm })
      await ctx.cleanup()
    }
  })
})

test.describe('a status change is announced to the people around the task, not to its author', () => {
  test('the assignee changes it: the Owner is told, the assignee is not; the Owner changes it: the assignee is told, the Owner is not', async ({ request }) => {
    const ctx = await setup(request)
    try {
      const task = await ctx.task('Announce', {}, ctx.member)

      const byMember = await request.put(`/api/tasks/${task.id}`, { headers: ctx.member.headers, data: taskBody(ctx.project, task.title, 'IN_PROGRESS') })
      expect(byMember.status()).toBe(200)
      expect(await noticesAbout(request, ctx.pm, task.title)).toHaveLength(1)
      expect(await noticesAbout(request, ctx.member.headers, task.title)).toHaveLength(0)

      const byOwner = await request.put(`/api/tasks/${task.id}`, { headers: ctx.pm, data: taskBody(ctx.project, task.title, 'IN_REVIEW') })
      expect(byOwner.status()).toBe(200)
      const told = await noticesAbout(request, ctx.member.headers, task.title)
      expect(told).toHaveLength(1)
      expect(told[0].message).toContain('is now In Review')
      // the Owner made this change, so still only the first notice is theirs
      expect(await noticesAbout(request, ctx.pm, task.title)).toHaveLength(1)
    } finally {
      await ctx.cleanup()
    }
  })
})
