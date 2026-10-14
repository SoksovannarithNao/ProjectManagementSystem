import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD } from './helpers.js'

// Change-plan batch 3a: file attachments, checklists, comment replies and the
// project activity feed. Project 1 (Website Redesign): pm.olivia is the Owner,
// lead.owen a Team Leader, dev.chen and dev.mia Team Members. Every test
// creates what it needs and removes it.

const apiLogin = async (request, username) => {
  const res = await request.post('/api/auth/login', { data: { username, password: SEED_PASSWORD } })
  expect(res.status()).toBe(200)
  return { Authorization: `Bearer ${(await res.json()).token}` }
}

const userId = async (request, headers, username) =>
  (await (await request.get(`/api/users/username/${username}`, { headers })).json()).id

const PDF = Buffer.from('%PDF-1.7\n% e2e test file\n')
const pdfPart = (name = 'spec.pdf') => ({ name, mimeType: 'application/pdf', buffer: PDF })

async function setup(request) {
  const pm = await apiLogin(request, 'pm.olivia')
  const leader = await apiLogin(request, 'lead.owen')
  const chen = await apiLogin(request, 'dev.chen')
  const mia = await apiLogin(request, 'dev.mia')
  const projects = await (await request.get('/api/projects', { headers: pm })).json()
  const project = projects.find((p) => p.name === 'Website Redesign')
  expect(project, 'seeded project "Website Redesign"').toBeTruthy()
  return { pm, leader, chen, mia, project }
}

async function newTask(request, ctx, title, assignTo = 'dev.chen') {
  const created = await request.post('/api/tasks', {
    headers: ctx.pm,
    data: { projectId: ctx.project.id, title, priority: 'LOW', status: 'TODO', startDate: ctx.project.startDate, dueDate: ctx.project.endDate },
  })
  expect(created.status()).toBe(201)
  const task = await created.json()
  if (assignTo) {
    const uid = await userId(request, ctx.pm, assignTo)
    expect((await request.post('/api/task-assignees', { headers: ctx.pm, data: { taskId: task.id, userId: uid } })).status()).toBe(201)
  }
  return task
}

const upload = (request, headers, target, file = pdfPart()) =>
  request.post('/api/attachments', { headers, multipart: { file, ...target } })

const getTask = async (request, headers, id) => (await request.get(`/api/tasks/${id}`, { headers })).json()

test.describe.configure({ mode: 'serial' })

test.describe('collaboration: API', () => {
  let ctx
  const tasks = []

  test.beforeAll(async ({ request }) => {
    ctx = await setup(request)
  })

  test.afterAll(async ({ request }) => {
    for (const id of tasks) await request.delete(`/api/tasks/${id}`, { headers: ctx.pm })
  })

  test('a member attaches a file to a task; it is listed, downloaded as an attachment, and logged', async ({ request }) => {
    const task = await newTask(request, ctx, `E2E files ${Date.now()}`)
    tasks.push(task.id)

    const res = await upload(request, ctx.chen, { taskId: String(task.id) }, pdfPart('..\\folder\\Spec "v2".pdf'))
    expect(res.status()).toBe(201)
    const file = await res.json()
    expect(file.fileName).toBe('Spec v2.pdf')
    expect(file.mimeType).toBe('application/pdf')
    expect(file.fileSize).toBe(PDF.length)
    expect(file.uploadedByName).toBeTruthy()
    expect(file.taskId).toBe(task.id)

    const list = await (await request.get(`/api/attachments/task/${task.id}`, { headers: ctx.mia })).json()
    expect(list.map((f) => f.id)).toEqual([file.id])

    const download = await request.get(`/api/attachments/${file.id}/download`, { headers: ctx.mia })
    expect(download.status()).toBe(200)
    expect(Buffer.compare(await download.body(), PDF)).toBe(0)
    expect(download.headers()['content-type']).toContain('application/pdf')
    expect(download.headers()['content-disposition']).toMatch(/^attachment;/)
    expect(download.headers()['x-content-type-options']).toBe('nosniff')
    expect(download.headers()['content-security-policy']).toContain('sandbox')

    const activity = await (await request.get(`/api/activity-logs/task/${task.id}`, { headers: ctx.pm })).json()
    expect(activity.some((a) => a.action === 'FILE_UPLOADED' && a.description.includes('Spec v2.pdf'))).toBe(true)
  })

  test('the type, content, size and target of an upload are checked', async ({ request }) => {
    const task = await newTask(request, ctx, `E2E limits ${Date.now()}`)
    tasks.push(task.id)
    const target = { taskId: String(task.id) }
    const refused = async (file, text) => {
      const res = await upload(request, ctx.chen, target, file)
      expect(res.status(), text).toBe(400)
      return (await res.json()).message
    }

    expect(await refused({ name: 'run.exe', mimeType: 'application/pdf', buffer: PDF }, 'executable')).toContain('not allowed')
    expect(await refused({ name: 'page.html', mimeType: 'text/html', buffer: Buffer.from('<script>1</script>') }, 'html')).toContain('not allowed')
    expect(await refused({ name: 'fake.pdf', mimeType: 'application/pdf', buffer: Buffer.from('MZ not a pdf') }, 'disguised')).toContain('does not match')
    // 10.5 MB: past the 10 MB limit but under the multipart ceiling, so the service says why
    const big = Buffer.concat([PDF, Buffer.alloc(10.5 * 1024 * 1024)])
    expect(await refused({ name: 'big.pdf', mimeType: 'application/pdf', buffer: big }, 'too large')).toContain('too large')

    // exactly one target
    const neither = await request.post('/api/attachments', { headers: ctx.chen, multipart: { file: pdfPart() } })
    expect(neither.status()).toBe(400)
    const both = await upload(request, ctx.chen, { taskId: String(task.id), projectId: String(ctx.project.id) })
    expect(both.status()).toBe(400)

    // nothing was stored
    expect(await (await request.get(`/api/attachments/task/${task.id}`, { headers: ctx.pm })).json()).toEqual([])
  })

  test('the uploader and a Team Leader may delete; another member may not', async ({ request }) => {
    const task = await newTask(request, ctx, `E2E delete ${Date.now()}`)
    tasks.push(task.id)
    const target = { taskId: String(task.id) }

    const mine = await (await upload(request, ctx.chen, target)).json()
    expect((await request.delete(`/api/attachments/${mine.id}`, { headers: ctx.mia })).status()).toBe(403)
    expect((await request.delete(`/api/attachments/${mine.id}`, { headers: ctx.chen })).status()).toBe(204)
    expect((await request.get(`/api/attachments/${mine.id}/download`, { headers: ctx.chen })).status()).toBe(404)

    const theirs = await (await upload(request, ctx.mia, target)).json()
    expect((await request.delete(`/api/attachments/${theirs.id}`, { headers: ctx.leader })).status()).toBe(204)
  })

  test('a checklist: members add, only the assignee ticks, progress follows, authors and leaders delete', async ({ request }) => {
    const task = await newTask(request, ctx, `E2E checklist ${Date.now()}`, 'dev.chen')
    tasks.push(task.id)
    const add = (headers, content) => request.post('/api/checklist-items', { headers, data: { taskId: task.id, content } })

    const first = await (await add(ctx.chen, 'Write the draft')).json()
    const second = await (await add(ctx.mia, 'Review the draft')).json() // any member may add
    expect(first.sortOrder).toBeLessThan(second.sortOrder)
    expect(first.completed).toBe(false)
    expect((await add(ctx.chen, '   ')).status()).toBe(400)

    // listed in order, and counted on the task
    const items = await (await request.get(`/api/checklist-items/task/${task.id}`, { headers: ctx.mia })).json()
    expect(items.map((i) => i.content)).toEqual(['Write the draft', 'Review the draft'])
    let current = await getTask(request, ctx.pm, task.id)
    expect(current.totalChecklistItems).toBe(2)
    expect(current.completedChecklistItems).toBe(0)

    // only the assignee (or someone who edits tasks) ticks
    const tick = (headers, item, completed) =>
      request.put(`/api/checklist-items/${item.id}`, { headers, data: { content: item.content, completed } })
    expect((await tick(ctx.mia, first, true)).status()).toBe(403)
    expect((await tick(ctx.chen, first, true)).status()).toBe(200)

    // progress counts the items (no subtasks): one of two = 50
    current = await getTask(request, ctx.pm, task.id)
    expect(current.completedChecklistItems).toBe(1)
    expect(Number(current.progress)).toBe(50)
    expect((await tick(ctx.leader, second, true)).status()).toBe(200)
    expect(Number((await getTask(request, ctx.pm, task.id)).progress)).toBe(100)
    expect((await tick(ctx.chen, second, false)).status()).toBe(200)
    expect(Number((await getTask(request, ctx.pm, task.id)).progress)).toBe(50)

    // delete: the author, or a Team Leader; not another member
    expect((await request.delete(`/api/checklist-items/${second.id}`, { headers: ctx.chen })).status()).toBe(403)
    expect((await request.delete(`/api/checklist-items/${second.id}`, { headers: ctx.mia })).status()).toBe(204)
    expect((await request.delete(`/api/checklist-items/${first.id}`, { headers: ctx.leader })).status()).toBe(204)
    current = await getTask(request, ctx.pm, task.id)
    expect(current.totalChecklistItems).toBe(0)
  })

  test('a reply stays in its own task, and comments are logged', async ({ request }) => {
    const task = await newTask(request, ctx, `E2E replies ${Date.now()}`)
    const other = await newTask(request, ctx, `E2E replies other ${Date.now()}`)
    tasks.push(task.id, other.id)
    const comment = (headers, taskId, message, parentCommentId = null) =>
      request.post('/api/comments', { headers, data: { taskId, message, parentCommentId } })

    const root = await (await comment(ctx.chen, task.id, 'Can you check the header?')).json()
    const reply = await comment(ctx.mia, task.id, 'Done, please look again', root.id)
    expect(reply.status()).toBe(201)
    expect((await reply.json()).parentCommentId).toBe(root.id)

    const foreign = await comment(ctx.mia, other.id, 'Wrong thread', root.id)
    expect(foreign.status()).toBe(400)
    expect((await foreign.json()).message).toContain('another task')

    const activity = await (await request.get(`/api/activity-logs/task/${task.id}`, { headers: ctx.pm })).json()
    expect(activity.filter((a) => a.action === 'COMMENT_ADDED').map((a) => a.description)).toEqual(
      expect.arrayContaining(['Comment added: "Can you check the header?"', 'Reply added: "Done, please look again"'])
    )
  })

  test('the project feed: project, milestone, file, comment and task events; read-only for a viewer; closed to strangers', async ({ request }) => {
    const zoe = await apiLogin(request, 'qa.zoe')
    const created = await request.post('/api/projects', {
      headers: ctx.pm,
      data: { name: 'e2e feed', priority: 'LOW', status: 'PLANNING', startDate: '2026-10-01', endDate: '2026-12-01' },
    })
    expect(created.status()).toBe(201)
    const project = await created.json()
    try {
      for (const [who, headers, role] of [['dev.chen', ctx.chen, 'MEMBER'], ['qa.zoe', zoe, 'VIEWER']]) {
        expect((await request.post('/api/project-members/invite', { headers: ctx.pm, data: { projectId: project.id, username: who, projectRole: role } })).status()).toBe(201)
        expect((await request.post(`/api/project-members/project/${project.id}/accept`, { headers })).status()).toBe(200)
      }

      // events
      expect((await request.put(`/api/projects/${project.id}`, {
        headers: ctx.pm,
        data: { name: 'e2e feed renamed', priority: 'HIGH', status: 'IN_PROGRESS', startDate: '2026-10-01', endDate: '2026-12-01' },
      })).status()).toBe(200)
      expect((await request.post('/api/milestones', {
        headers: ctx.pm, data: { projectId: project.id, title: 'Design done', dueDate: '2026-11-01' },
      })).status()).toBe(201)
      const task = await (await request.post('/api/tasks', {
        headers: ctx.pm,
        data: { projectId: project.id, title: 'Feed task', priority: 'LOW', status: 'TODO', startDate: '2026-10-02', dueDate: '2026-10-20' },
      })).json()
      expect((await request.post('/api/comments', { headers: ctx.chen, data: { taskId: task.id, message: 'Hello feed' } })).status()).toBe(201)
      expect((await upload(request, ctx.chen, { projectId: String(project.id) }, pdfPart('brief.pdf'))).status()).toBe(201)

      // a viewer reads but cannot write
      expect((await upload(request, zoe, { projectId: String(project.id) })).status()).toBe(403)
      expect((await request.post('/api/checklist-items', { headers: zoe, data: { taskId: task.id, content: 'nope' } })).status()).toBe(403)
      expect((await request.get(`/api/attachments/project/${project.id}`, { headers: zoe })).status()).toBe(200)

      const feed = await (await request.get(`/api/activity-logs/project/${project.id}`, { headers: zoe })).json()
      const actions = feed.map((e) => e.action)
      expect(actions).toEqual(expect.arrayContaining([
        'PROJECT_CREATED', 'PROJECT_UPDATED', 'MILESTONE_CREATED', 'TASK_CREATED', 'COMMENT_ADDED', 'FILE_UPLOADED',
      ]))
      expect(feed.find((e) => e.action === 'PROJECT_UPDATED').description).toContain('name')
      expect(feed.find((e) => e.action === 'COMMENT_ADDED').taskTitle).toBe('Feed task')
      // newest first
      const times = feed.map((e) => Date.parse(e.createdAt))
      expect(times).toEqual([...times].sort((a, b) => b - a))
      // limit is honoured
      expect(await (await request.get(`/api/activity-logs/project/${project.id}?limit=2`, { headers: zoe })).json()).toHaveLength(2)

      // someone outside the project sees nothing: not the feed, not the files
      const outsider = await apiLogin(request, 'dev.raj')
      expect((await request.get(`/api/activity-logs/project/${project.id}`, { headers: outsider })).status()).toBe(404)
      expect((await request.get(`/api/attachments/project/${project.id}`, { headers: outsider })).status()).toBe(404)
      const listed = await (await request.get(`/api/attachments/project/${project.id}`, { headers: ctx.pm })).json()
      expect((await request.get(`/api/attachments/${listed[0].id}/download`, { headers: outsider })).status()).toBe(404)
    } finally {
      await request.delete(`/api/projects/${project.id}`, { headers: ctx.pm })
    }
  })

  test('the permission matrix lists the two new resources with the agreed grants', async ({ request }) => {
    const admin = await apiLogin(request, 'admin.system')
    const matrix = await (await request.get('/api/permissions/matrix', { headers: admin })).json()
    expect(matrix.resources.map((r) => r.name)).toEqual(expect.arrayContaining(['ATTACHMENT', 'CHECKLIST_ITEM']))
    const grants = (role, resource) =>
      matrix.roles.find((r) => r.role.name === role).grants
        .filter((g) => g.scope === 'PROJECT' && g.resource === resource).map((g) => g.permission).sort()
    expect(grants('OWNER', 'ATTACHMENT')).toEqual(['CREATE', 'DELETE', 'VIEW'])
    expect(grants('ADMIN', 'ATTACHMENT')).toEqual(['CREATE', 'DELETE', 'VIEW'])
    expect(grants('MEMBER', 'ATTACHMENT')).toEqual(['CREATE', 'VIEW'])
    expect(grants('VIEWER', 'ATTACHMENT')).toEqual(['VIEW'])
    expect(grants('MEMBER', 'CHECKLIST_ITEM')).toEqual(['CREATE', 'EDIT', 'VIEW'])
    expect(grants('VIEWER', 'CHECKLIST_ITEM')).toEqual(['VIEW'])
  })
})

test.describe('collaboration: UI', () => {
  test('a member adds checklist items, attaches and downloads a file, and replies to a comment', async ({ page, request }) => {
    const ctx = await setup(request)
    const title = `E2E collab UI ${Date.now()}`
    const task = await newTask(request, ctx, title, 'dev.chen')
    try {
      await request.post('/api/comments', { headers: ctx.mia, data: { taskId: task.id, message: 'Please add the footer' } })

      await login(page, 'dev.chen')
      await page.goto('/tasks')
      await page.getByTestId('task-row').filter({ hasText: title }).click()

      // --- checklist
      const checklist = page.getByTestId('checklist-section')
      await checklist.getByLabel('New checklist item').fill('Draft the footer')
      await checklist.getByRole('button', { name: 'Add' }).click()
      await expect(checklist.getByText('Draft the footer')).toBeVisible()
      await expect(checklist.getByText('0/1')).toBeVisible()
      await checklist.getByRole('button', { name: /Mark "Draft the footer" as done/ }).click()
      await expect(checklist.getByText('1/1')).toBeVisible()

      // --- attachment: upload, list, download under its own name
      const files = page.getByTestId('attachments-section')
      await files.getByTestId('attachment-input').setInputFiles({ name: 'footer-spec.pdf', mimeType: 'application/pdf', buffer: PDF })
      await expect(files.getByText('footer-spec.pdf').first()).toBeVisible()
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        files.getByRole('button', { name: 'Download footer-spec.pdf' }).first().click(),
      ])
      expect(download.suggestedFilename()).toBe('footer-spec.pdf')

      // a disallowed type is refused before it leaves the browser
      await files.getByTestId('attachment-input').setInputFiles({ name: 'setup.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') })
      await expect(page.getByText(/not allowed/).first()).toBeVisible()

      // --- reply to a comment: the reply sits under it
      await page.getByRole('button', { name: 'Reply to Mia Chen' }).or(page.getByRole('button', { name: /^Reply to / })).first().click()
      await expect(page.getByText(/^Replying to /)).toBeVisible()
      await page.getByPlaceholder('Write a reply...').fill('Footer added')
      await page.getByRole('button', { name: 'Send comment' }).click()
      await expect(page.getByText('Footer added', { exact: true })).toBeVisible()
      await expect(page.getByText(/^Replying to /)).toHaveCount(0)
      const comments = await (await request.get(`/api/comments/task/${task.id}`, { headers: ctx.pm })).json()
      const root = comments.find((c) => c.message === 'Please add the footer')
      expect(comments.find((c) => c.message === 'Footer added').parentCommentId).toBe(root.id)

      // the task row shows the checklist count
      await page.goto('/tasks')
      await expect(page.getByTestId('task-row').filter({ hasText: title }).getByText('1/1 checklist')).toBeVisible()
    } finally {
      await request.delete(`/api/tasks/${task.id}`, { headers: ctx.pm })
    }
  })

  test('the project page lists project files and the activity feed', async ({ page, request }) => {
    const ctx = await setup(request)
    const title = `E2E feed UI ${Date.now()}`
    const task = await newTask(request, ctx, title, 'dev.chen')
    let projectFile
    try {
      projectFile = await (await upload(request, ctx.pm, { projectId: String(ctx.project.id) }, pdfPart('kickoff-notes.pdf'))).json()

      await login(page, 'pm.olivia')
      await page.goto(`/projects/${ctx.project.id}`)

      const files = page.getByTestId('attachments-section')
      await expect(files.getByText('kickoff-notes.pdf')).toBeVisible()
      await expect(files.getByTestId('attachment-input')).toHaveCount(1) // the Owner may upload

      const feed = page.getByTestId('project-activity')
      await expect(feed).toBeVisible()
      await expect(feed.getByText(/File "kickoff-notes.pdf" uploaded to the project/)).toBeVisible()
      await expect(feed.getByText(new RegExp(title)).first()).toBeVisible()
    } finally {
      if (projectFile) await request.delete(`/api/attachments/${projectFile.id}`, { headers: ctx.pm })
      await request.delete(`/api/tasks/${task.id}`, { headers: ctx.pm })
    }
  })

  test('a Viewer sees the files but gets no upload or checklist controls', async ({ page, request }) => {
    const ctx = await setup(request)
    const pm = ctx.pm
    const zoe = await apiLogin(request, 'qa.zoe')
    const created = await request.post('/api/projects', {
      headers: pm,
      data: { name: 'e2e viewer files', priority: 'LOW', status: 'PLANNING', startDate: '2026-10-01', endDate: '2026-12-01' },
    })
    const project = await created.json()
    try {
      expect((await request.post('/api/project-members/invite', { headers: pm, data: { projectId: project.id, username: 'qa.zoe', projectRole: 'VIEWER' } })).status()).toBe(201)
      expect((await request.post(`/api/project-members/project/${project.id}/accept`, { headers: zoe })).status()).toBe(200)
      await upload(request, pm, { projectId: String(project.id) }, pdfPart('read-me.pdf'))

      await login(page, 'qa.zoe')
      await page.goto(`/projects/${project.id}`)
      const files = page.getByTestId('attachments-section')
      await expect(files.getByText('read-me.pdf')).toBeVisible()
      await expect(files.getByTestId('attachment-input')).toHaveCount(0)
      await expect(files.getByRole('button', { name: 'Delete read-me.pdf' })).toHaveCount(0)
    } finally {
      await request.delete(`/api/projects/${project.id}`, { headers: pm })
    }
  })
})
