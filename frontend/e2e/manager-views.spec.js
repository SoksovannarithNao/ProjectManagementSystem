import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD } from './helpers.js'

// Change-plan batch 3b: dashboard statistics, Delayed projects, Team Tasks, Team
// Workload, the project Timeline, and changing a member's project role /
// transferring ownership. Every test builds its own throw-away project (owner
// pm.olivia) and deletes it afterwards.

const apiLogin = async (request, username) => {
  const res = await request.post('/api/auth/login', { data: { username, password: SEED_PASSWORD } })
  expect(res.status()).toBe(200)
  return { Authorization: `Bearer ${(await res.json()).token}` }
}

const stats = async (request, headers) => (await request.get('/api/dashboard/stats', { headers })).json()
const userId = async (request, headers, username) =>
  (await (await request.get(`/api/users/username/${username}`, { headers })).json()).id

// A project with the given extra fields, owned by pm.olivia.
async function createProject(request, pm, fields = {}) {
  const res = await request.post('/api/projects', {
    headers: pm,
    data: { name: `e2e views ${Date.now()}`, priority: 'LOW', status: 'IN_PROGRESS', startDate: '2026-01-01', endDate: '2026-12-31', ...fields },
  })
  expect(res.status()).toBe(201)
  return res.json()
}

// Invites each [username, role] and has them accept.
async function addMembers(request, pm, project, people) {
  for (const [username, role] of people) {
    expect((await request.post('/api/project-members/invite', { headers: pm, data: { projectId: project.id, username, projectRole: role } })).status()).toBe(201)
    const theirs = await apiLogin(request, username)
    expect((await request.post(`/api/project-members/project/${project.id}/accept`, { headers: theirs })).status()).toBe(200)
  }
}

async function addTask(request, pm, project, title, assignTo, fields = {}) {
  const res = await request.post('/api/tasks', {
    headers: pm,
    data: { projectId: project.id, title, priority: 'LOW', status: 'TODO', startDate: '2026-01-05', dueDate: '2026-02-01', estimatedHours: 4, ...fields },
  })
  expect(res.status()).toBe(201)
  const task = await res.json()
  if (assignTo) {
    const uid = await userId(request, pm, assignTo)
    expect((await request.post('/api/task-assignees', { headers: pm, data: { taskId: task.id, userId: uid } })).status()).toBe(201)
  }
  return task
}

const membership = async (request, headers, projectId, username) =>
  (await (await request.get(`/api/project-members/project/${projectId}`, { headers })).json()).find((m) => m.user.username === username)

test.describe.configure({ mode: 'serial' })

test.describe('manager views: API', () => {
  let pm

  test.beforeAll(async ({ request }) => {
    pm = await apiLogin(request, 'pm.olivia')
  })

  test('a project is Delayed once its end date has passed and it is not finished - calculated, never stored', async ({ request }) => {
    const outsider = await apiLogin(request, 'dev.raj')
    const before = await stats(request, pm)
    const outsiderBefore = await stats(request, outsider)
    const project = await createProject(request, pm, { endDate: '2026-02-01' })
    try {
      expect(project.delayed).toBe(true)
      expect(project.daysDelayed).toBeGreaterThan(0)
      expect(project.status).toBe('IN_PROGRESS') // "Delayed" is not a status

      // Other specs create and delete ordinary projects while this runs, so only the
      // delayed group - which nothing else touches - is compared with its earlier value.
      const after = await stats(request, pm)
      expect(after.projects.delayed).toBe(before.projects.delayed + 1)
      expect(after.delayedProjects.some((p) => p.id === project.id && p.daysDelayed > 0)).toBe(true)
      // a person outside the project does not see it, in the count or in the list
      const outsiderAfter = await stats(request, outsider)
      expect(outsiderAfter.projects.delayed).toBe(outsiderBefore.projects.delayed)
      expect(outsiderAfter.delayedProjects.some((p) => p.id === project.id)).toBe(false)

      // finishing it removes it from the group; a project not yet due is never delayed
      const done = await request.put(`/api/projects/${project.id}`, {
        headers: pm, data: { name: project.name, priority: 'LOW', status: 'COMPLETED', startDate: project.startDate, endDate: '2026-02-01' },
      })
      expect(done.status()).toBe(200)
      const finished = await done.json()
      expect(finished.delayed).toBe(false)
      expect((await stats(request, pm)).projects.delayed).toBe(before.projects.delayed)

      const future = await createProject(request, pm, { name: `e2e future ${Date.now()}`, endDate: '2099-01-01' })
      expect(future.delayed).toBe(false)
      await request.delete(`/api/projects/${future.id}`, { headers: pm })
    } finally {
      await request.delete(`/api/projects/${project.id}`, { headers: pm })
    }
  })

  test('the dashboard task counts add up and overdue is derived from the dates', async ({ request }) => {
    const s = await stats(request, pm)
    const t = s.tasks
    expect(t.todo + t.inProgress + t.inReview + t.completed + t.cancelled).toBe(t.total)
    // the same numbers from the task list; other specs may add or remove tasks at the
    // same moment, so compare again until the two reads agree
    await expect
      .poll(async () => {
        const [fresh, tasks] = await Promise.all([
          stats(request, pm).then((x) => x.tasks),
          request.get('/api/tasks', { headers: pm }).then((r) => r.json()),
        ])
        return [fresh.total === tasks.length, fresh.overdue === tasks.filter((x) => x.overdue).length]
      })
      .toEqual([true, true])
    const recent = await (await request.get('/api/activity-logs/recent?limit=5', { headers: pm })).json()
    expect(recent.length).toBeLessThanOrEqual(5)
    expect(recent.every((e) => e.projectName)).toBe(true)
  })

  test('Team Tasks and Workload: managers only, grouped by member, relative to the team average', async ({ request }) => {
    const leader = await apiLogin(request, 'lead.owen')
    const chen = await apiLogin(request, 'dev.chen')
    const raj = await apiLogin(request, 'dev.raj')
    const project = await createProject(request, pm)
    try {
      await addMembers(request, pm, project, [['lead.owen', 'ADMIN'], ['dev.chen', 'MEMBER'], ['dev.mia', 'MEMBER']])
      for (const n of [1, 2, 3]) await addTask(request, pm, project, `busy ${n}`, 'dev.chen', { status: 'IN_PROGRESS' })
      await addTask(request, pm, project, 'nobody yet', null)

      // who may look
      expect((await request.get(`/api/projects/${project.id}/team-tasks`, { headers: chen })).status()).toBe(403)
      expect((await request.get(`/api/projects/${project.id}/workload`, { headers: chen })).status()).toBe(403)
      expect((await request.get('/api/workload', { headers: chen })).status()).toBe(403)
      expect((await request.get(`/api/projects/${project.id}/team-tasks`, { headers: raj })).status()).toBe(404)
      expect((await request.get(`/api/projects/${project.id}/team-tasks`, { headers: leader })).status()).toBe(200)

      const team = await (await request.get(`/api/projects/${project.id}/team-tasks`, { headers: leader })).json()
      const rowOf = (name) => team.members.find((m) => m.user.username === name)
      expect(rowOf('dev.chen').assigned).toBe(3)
      expect(rowOf('dev.chen').active).toBe(3)
      expect(rowOf('dev.chen').overdue).toBe(3)
      expect(rowOf('dev.chen').tasks).toHaveLength(3)
      expect(rowOf('dev.chen').tasks[0].assignmentId).toBeTruthy()
      expect(rowOf('dev.mia').assigned).toBe(0)
      expect(team.unassigned.map((t) => t.title)).toEqual(['nobody yet'])

      // workload: Chen carries everything, Mia nothing; the leader is not a worker
      const load = await (await request.get(`/api/projects/${project.id}/workload`, { headers: leader })).json()
      const level = (name) => load.members.find((m) => m.user.username === name)?.level
      expect(load.teamSize).toBe(2)
      expect(level('dev.chen')).toBe('OVERLOADED')
      expect(level('dev.mia')).toBe('UNDERLOADED')
      expect(load.members.find((m) => m.user.username === 'dev.chen').estimatedHours).toBe(12)
      expect(load.members.some((m) => m.user.username === 'lead.owen')).toBe(false)
      const managed = await (await request.get('/api/workload', { headers: leader })).json()
      expect(managed.members.some((m) => m.user.username === 'dev.chen')).toBe(true)
    } finally {
      await request.delete(`/api/projects/${project.id}`, { headers: pm })
    }
  })

  test('project roles: nobody changes their own, a Team Leader only moves Team Members and Viewers', async ({ request }) => {
    const leader = await apiLogin(request, 'lead.owen')
    const project = await createProject(request, pm)
    const setRole = (headers, target, role) =>
      request.put(`/api/project-members/${target.id}`, { headers, data: { projectId: project.id, userId: target.user.id, projectRole: role } })
    try {
      await addMembers(request, pm, project, [['lead.owen', 'ADMIN'], ['dev.chen', 'MEMBER'], ['dev.mia', 'MEMBER']])
      const chen = await membership(request, pm, project.id, 'dev.chen')
      const owen = await membership(request, pm, project.id, 'lead.owen')
      const olivia = await membership(request, pm, project.id, 'pm.olivia')

      expect((await setRole(leader, chen, 'ADMIN')).status()).toBe(403) // not a leader-maker
      expect((await setRole(leader, chen, 'VIEWER')).status()).toBe(200)
      expect((await setRole(leader, chen, 'MEMBER')).status()).toBe(200)
      expect((await setRole(leader, owen, 'MEMBER')).status()).toBe(403) // not their own
      expect((await setRole(leader, olivia, 'MEMBER')).status()).toBe(403) // not the Owner's
      expect((await setRole(pm, olivia, 'MEMBER')).status()).toBe(400) // the Owner steps down only by transferring ownership

      // the Owner can make a Team Member a Team Leader
      const promoted = await setRole(pm, chen, 'ADMIN')
      expect(promoted.status()).toBe(200)
      expect((await promoted.json()).projectRole).toBe('ADMIN')
    } finally {
      await request.delete(`/api/projects/${project.id}`, { headers: pm })
    }
  })
})

test.describe('manager views: UI', () => {
  test('the dashboard shows the server figures, delayed projects, recent activity and a manager\'s workload', async ({ page, request }) => {
    const pm = await apiLogin(request, 'pm.olivia')
    const project = await createProject(request, pm, { endDate: '2026-02-01', name: `e2e dashboard ${Date.now()}` })
    try {
      await login(page, 'pm.olivia')

      const strip = page.getByTestId('dashboard-stats')
      await expect(strip.getByText('Total projects')).toBeVisible()
      for (const label of ['Total projects', 'Active projects', 'Completed projects', 'Delayed projects', 'Average completion', 'Total tasks']) {
        await expect(strip.getByText(label, { exact: true })).toBeVisible()
      }
      // this project is delayed, so the Delayed tile cannot read zero
      const delayedTile = strip.locator('div.card', { hasText: 'Delayed projects' })
      await expect(delayedTile).not.toHaveText(/^Delayed projects\s*0$/)

      const delayed = page.getByTestId('delayed-projects')
      await expect(delayed.getByText(project.name)).toBeVisible()
      await expect(delayed.getByText(/\d+d late/).first()).toBeVisible()
      await expect(page.getByTestId('recent-activity').locator('p').first()).toBeVisible()
      await expect(page.getByTestId('dashboard-workload').getByTestId('workload-row').first()).toBeVisible()

      // a plain member has no workload card
      const memberPage = await page.context().browser().newPage()
      await login(memberPage, 'dev.chen')
      await expect(memberPage.getByTestId('dashboard-stats')).toBeVisible()
      await expect(memberPage.getByTestId('dashboard-workload')).toHaveCount(0)
      await memberPage.close()
    } finally {
      await request.delete(`/api/projects/${project.id}`, { headers: pm })
    }
  })

  test('the project page and the projects list flag a delayed project, and the list can filter on it', async ({ page, request }) => {
    const pm = await apiLogin(request, 'pm.olivia')
    const project = await createProject(request, pm, { endDate: '2026-02-01', name: `e2e delayed ${Date.now()}` })
    try {
      await login(page, 'pm.olivia')
      await page.goto(`/projects/${project.id}`)
      await expect(page.getByTestId('delayed-badge').first()).toBeVisible()

      await page.goto('/projects')
      const card = page.locator('a[href^="/projects/"]', { hasText: project.name })
      await expect(card.getByTestId('delayed-badge')).toBeVisible()
      await page.getByRole('button', { name: /^Filter/ }).click()
      await page.getByLabel('Delayed', { exact: true }).check()
      await page.keyboard.press('Escape')
      await expect(card).toBeVisible()
      for (const text of await page.locator('a[href^="/projects/"]').allInnerTexts()) expect(text).toContain('Delayed')
    } finally {
      await request.delete(`/api/projects/${project.id}`, { headers: pm })
    }
  })

  test('Team Tasks lists members with their tasks, and a Team Leader can reassign a task', async ({ page, request }) => {
    const pm = await apiLogin(request, 'pm.olivia')
    const project = await createProject(request, pm)
    try {
      await addMembers(request, pm, project, [['lead.owen', 'ADMIN'], ['dev.chen', 'MEMBER'], ['dev.mia', 'MEMBER']])
      const task = await addTask(request, pm, project, 'Move me', 'dev.chen', { status: 'IN_PROGRESS' })
      await addTask(request, pm, project, 'Unclaimed work', null)

      await login(page, 'lead.owen')
      await page.goto(`/projects/${project.id}`)
      await page.getByRole('link', { name: 'Team tasks' }).click()
      await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/team$`))

      const chenCard = page.getByTestId('team-member').filter({ hasText: 'Chen Wu' })
      await expect(chenCard.getByTestId('team-task-row').filter({ hasText: 'Move me' })).toBeVisible()
      await expect(page.getByTestId('team-unassigned').getByText('Unclaimed work')).toBeVisible()

      // reassign Chen's task to Mia
      await chenCard.getByLabel('Reassign Move me').selectOption({ label: 'Mia Alvarez' })
      await expect(page.getByText('Task reassigned')).toBeVisible()
      const miaCard = page.getByTestId('team-member').filter({ hasText: 'Mia Alvarez' })
      await expect(miaCard.getByTestId('team-task-row').filter({ hasText: 'Move me' })).toBeVisible()
      const assignments = await (await request.get(`/api/task-assignees`, { headers: pm })).json()
      expect(assignments.filter((a) => a.task.id === task.id).map((a) => a.user.username)).toEqual(['dev.mia'])

      // assign the unclaimed task, and follow up by opening one
      await page.getByTestId('team-unassigned').getByLabel('Reassign Unclaimed work').selectOption({ label: 'Chen Wu' })
      await expect(page.getByTestId('team-unassigned').getByText('Every task has someone on it.')).toBeVisible()
      await expect(chenCard.getByTestId('team-task-row').filter({ hasText: 'Unclaimed work' })).toBeVisible()
      await miaCard.getByRole('button', { name: 'Move me' }).click()
      await expect(page.getByRole('heading', { name: 'Move me' })).toBeVisible()
    } finally {
      await request.delete(`/api/projects/${project.id}`, { headers: pm })
    }
  })

  test('the Workload tab marks the overloaded and underloaded; a Team Member cannot open it', async ({ page, request }) => {
    const pm = await apiLogin(request, 'pm.olivia')
    const project = await createProject(request, pm)
    try {
      await addMembers(request, pm, project, [['dev.chen', 'MEMBER'], ['dev.mia', 'MEMBER']])
      for (const n of [1, 2, 3]) await addTask(request, pm, project, `heavy ${n}`, 'dev.chen', { status: 'IN_PROGRESS' })

      await login(page, 'pm.olivia')
      await page.goto(`/projects/${project.id}/workload`)
      const rows = page.getByTestId('workload-row')
      await expect(rows).toHaveCount(2)
      await expect(rows.filter({ hasText: 'Chen Wu' }).locator('[data-level]')).toHaveAttribute('data-level', 'OVERLOADED')
      await expect(rows.filter({ hasText: 'Mia' }).locator('[data-level]')).toHaveAttribute('data-level', 'UNDERLOADED')
      await expect(page.getByText(/Team average:/)).toBeVisible()

      const memberPage = await page.context().browser().newPage()
      await login(memberPage, 'dev.chen')
      await memberPage.goto(`/projects/${project.id}/workload`)
      await expect(memberPage.getByText('Only the Owner, a Team Leader or an Administrator can see this')).toBeVisible()
      await memberPage.goto(`/projects/${project.id}`)
      await expect(memberPage.getByRole('link', { name: 'Team tasks' })).toHaveCount(0)
      await expect(memberPage.getByRole('link', { name: 'Timeline' })).toBeVisible()
      await memberPage.close()
    } finally {
      await request.delete(`/api/projects/${project.id}`, { headers: pm })
    }
  })

  test('the Timeline draws the project, its milestones and tasks; selecting opens them', async ({ page, request }) => {
    const pm = await apiLogin(request, 'pm.olivia')
    const project = await createProject(request, pm, { startDate: '2026-10-01', endDate: '2026-12-31' })
    try {
      await addMembers(request, pm, project, [['dev.chen', 'MEMBER']])
      await addTask(request, pm, project, 'Design the header', 'dev.chen', { startDate: '2026-10-05', dueDate: '2026-10-20', status: 'IN_PROGRESS' })
      await addTask(request, pm, project, 'Build the footer', null, { startDate: '2026-11-01', dueDate: '2026-11-15' })
      expect((await request.post('/api/milestones', { headers: pm, data: { projectId: project.id, title: 'Design complete', dueDate: '2026-11-30', description: 'All screens signed off' } })).status()).toBe(201)

      // a plain member can open the timeline
      await login(page, 'dev.chen')
      await page.goto(`/projects/${project.id}/timeline`)
      const timeline = page.getByTestId('timeline')
      await expect(timeline).toBeVisible()
      await expect(page.getByTestId('timeline-project')).toBeVisible()
      await expect(page.getByTestId('timeline-task')).toHaveCount(2)
      await expect(page.getByTestId('timeline-milestone')).toHaveCount(1)

      // bars sit in date order on the axis
      const left = async (name) => (await page.getByRole('button', { name: new RegExp(`Task ${name}`) }).boundingBox()).x
      expect(await left('Design the header')).toBeLessThan(await left('Build the footer'))

      // select a milestone: its details; select a task: the usual panel
      await page.getByTestId('timeline-milestone').click()
      await expect(page.getByTestId('timeline-milestone-detail')).toContainText('All screens signed off')
      await page.getByRole('button', { name: /Task Design the header/ }).click()
      await expect(page.getByRole('heading', { name: 'Design the header' })).toBeVisible()
    } finally {
      await request.delete(`/api/projects/${project.id}`, { headers: pm })
    }
  })

  test('the Owner changes a member\'s role and transfers ownership from the members list', async ({ page, request }) => {
    const pm = await apiLogin(request, 'pm.olivia')
    const marcus = await apiLogin(request, 'pm.marcus')
    const project = await createProject(request, pm)
    let ownerHeaders = pm
    try {
      await addMembers(request, pm, project, [['dev.chen', 'MEMBER'], ['pm.marcus', 'MEMBER']])

      await login(page, 'pm.olivia')
      await page.goto(`/projects/${project.id}`)

      // a Team Member becomes a Team Leader
      const chenRole = page.getByLabel('Project role of Chen Wu')
      await expect(chenRole).toBeVisible()
      await chenRole.selectOption('ADMIN')
      await expect(page.getByText('Chen Wu is now a Team Leader')).toBeVisible()
      expect((await membership(request, pm, project.id, 'dev.chen')).projectRole).toBe('ADMIN')
      // the Owner has no picker on their own row
      await expect(page.getByLabel('Project role of Olivia Bennett')).toHaveCount(0)

      // only someone who can own projects is offered "Owner"
      await expect(chenRole.locator('option', { hasText: 'Owner' })).toHaveCount(0)
      const marcusRole = page.getByLabel(/^Project role of .*Marcus/)
      await marcusRole.selectOption({ label: 'Owner (transfer ownership)' })
      await expect(page.getByText(/A project has exactly one Owner/)).toBeVisible()
      await page.getByRole('button', { name: 'Transfer ownership' }).last().click()
      await expect(page.getByText(/is now the Owner of/)).toBeVisible()
      ownerHeaders = marcus

      expect((await membership(request, marcus, project.id, 'pm.marcus')).projectRole).toBe('OWNER')
      expect((await membership(request, marcus, project.id, 'pm.olivia')).projectRole).toBe('ADMIN')
      const owners = (await (await request.get(`/api/project-members/project/${project.id}`, { headers: marcus })).json())
        .filter((m) => m.projectRole === 'OWNER' && m.status === 'ACTIVE')
      expect(owners).toHaveLength(1)
    } finally {
      await request.delete(`/api/projects/${project.id}`, { headers: ownerHeaders })
    }
  })
})
