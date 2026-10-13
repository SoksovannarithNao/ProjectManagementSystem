import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD } from './helpers.js'

// A Team Leader can be named the project's lead beside the Owner (#18, D-09). Each test
// builds its own throw-away project (owner pm.olivia) and deletes it afterwards. Seed:
// lead.owen and pm.marcus are not members of the new project until the test invites
// them; dev.chen is a plain Team Member.

const apiLogin = async (request, username) => {
  const res = await request.post('/api/auth/login', { data: { username, password: SEED_PASSWORD } })
  expect(res.status()).toBe(200)
  return { Authorization: `Bearer ${(await res.json()).token}` }
}

async function createProject(request, pm) {
  const res = await request.post('/api/projects', {
    headers: pm,
    data: { name: `e2e lead ${Date.now()}`, priority: 'LOW', status: 'IN_PROGRESS', startDate: '2026-01-01', endDate: '2026-12-31' },
  })
  expect(res.status()).toBe(201)
  return res.json()
}

async function addMember(request, pm, project, username, role) {
  expect((await request.post('/api/project-members/invite', { headers: pm, data: { projectId: project.id, username, projectRole: role } })).status()).toBe(201)
  const theirs = await apiLogin(request, username)
  expect((await request.post(`/api/project-members/project/${project.id}/accept`, { headers: theirs })).status()).toBe(200)
}

const userId = async (request, headers, username) =>
  (await (await request.get(`/api/users/username/${username}`, { headers })).json()).id
const membership = async (request, headers, projectId, username) =>
  (await (await request.get(`/api/project-members/project/${projectId}`, { headers })).json()).find((m) => m.user.username === username)
const setLead = (request, headers, projectId, uid) =>
  request.put(`/api/projects/${projectId}/lead`, { headers, data: { userId: uid } })
const getProject = async (request, headers, projectId) =>
  (await request.get(`/api/projects/${projectId}`, { headers })).json()

test.describe('project lead: API', () => {
  let pm
  let project

  test.beforeEach(async ({ request }) => {
    pm = await apiLogin(request, 'pm.olivia')
    project = await createProject(request, pm)
  })
  test.afterEach(async ({ request }) => {
    await request.delete(`/api/projects/${project.id}`, { headers: pm })
  })

  test('the Owner names a Team Leader as lead, and the project, its feed and the card show it', async ({ request }) => {
    await addMember(request, pm, project, 'lead.owen', 'ADMIN')
    const owen = await userId(request, pm, 'lead.owen')

    const res = await setLead(request, pm, project.id, owen)
    expect(res.status()).toBe(200)
    expect((await res.json()).lead.username).toBe('lead.owen')
    expect((await getProject(request, pm, project.id)).lead.id).toBe(owen)
    expect((await (await request.get('/api/projects', { headers: pm })).json()).find((p) => p.id === project.id).lead.id).toBe(owen)

    const feed = await (await request.get(`/api/activity-logs/project/${project.id}`, { headers: pm })).json()
    expect(feed.some((e) => e.action === 'PROJECT_LEAD_CHANGED' && e.description.includes('was named the project lead'))).toBe(true)

    // naming the same person again changes and logs nothing; null clears it
    await setLead(request, pm, project.id, owen)
    const again = await (await request.get(`/api/activity-logs/project/${project.id}`, { headers: pm })).json()
    expect(again.filter((e) => e.action === 'PROJECT_LEAD_CHANGED')).toHaveLength(1)
    const cleared = await setLead(request, pm, project.id, null)
    expect((await cleared.json()).lead).toBeNull()
  })

  test('only a Team Leader of this project can be the lead', async ({ request }) => {
    await addMember(request, pm, project, 'dev.chen', 'MEMBER')
    const chen = await userId(request, pm, 'dev.chen')
    const notLeader = await setLead(request, pm, project.id, chen)
    expect(notLeader.status()).toBe(400)
    expect((await notLeader.json()).message).toContain('Only a Team Leader can be its lead')

    const stranger = await userId(request, pm, 'dev.mia')
    expect((await setLead(request, pm, project.id, stranger)).status()).toBe(400)
    expect((await getProject(request, pm, project.id)).lead).toBeNull()
  })

  test('a Team Leader or Team Member cannot name the lead', async ({ request }) => {
    await addMember(request, pm, project, 'lead.owen', 'ADMIN')
    await addMember(request, pm, project, 'dev.chen', 'MEMBER')
    const owen = await userId(request, pm, 'lead.owen')
    expect((await setLead(request, await apiLogin(request, 'lead.owen'), project.id, owen)).status()).toBe(403)
    expect((await setLead(request, await apiLogin(request, 'dev.chen'), project.id, owen)).status()).toBe(403)
    expect((await getProject(request, pm, project.id)).lead).toBeNull()
  })

  test('the lead is cleared when that person is demoted, or removed from the project', async ({ request }) => {
    await addMember(request, pm, project, 'lead.owen', 'ADMIN')
    const owen = await userId(request, pm, 'lead.owen')
    await setLead(request, pm, project.id, owen)

    const row = await membership(request, pm, project.id, 'lead.owen')
    const demote = await request.put(`/api/project-members/${row.id}`, {
      headers: pm, data: { projectId: project.id, userId: owen, projectRole: 'MEMBER' },
    })
    expect(demote.status()).toBe(200)
    expect((await getProject(request, pm, project.id)).lead).toBeNull()

    // promoted again and named again, then removed from the project
    await request.put(`/api/project-members/${row.id}`, { headers: pm, data: { projectId: project.id, userId: owen, projectRole: 'ADMIN' } })
    expect((await setLead(request, pm, project.id, owen)).status()).toBe(200)
    expect((await request.delete(`/api/project-members/${row.id}`, { headers: pm })).status()).toBe(204)
    expect((await getProject(request, pm, project.id)).lead).toBeNull()
  })

  test('the lead is cleared when that Team Leader becomes the Owner', async ({ request }) => {
    await addMember(request, pm, project, 'pm.marcus', 'ADMIN')
    const marcus = await userId(request, pm, 'pm.marcus')
    await setLead(request, pm, project.id, marcus)
    const row = await membership(request, pm, project.id, 'pm.marcus')

    const transfer = await request.put(`/api/project-members/${row.id}`, {
      headers: pm, data: { projectId: project.id, userId: marcus, projectRole: 'OWNER' },
    })
    expect(transfer.status()).toBe(200)
    const after = await getProject(request, pm, project.id)
    expect(after.manager.username).toBe('pm.marcus')
    expect(after.lead).toBeNull()

    // the new owner deletes the project; the afterEach delete is then a harmless 404
    expect((await request.delete(`/api/projects/${project.id}`, { headers: await apiLogin(request, 'pm.marcus') })).status()).toBe(204)
  })
})

test.describe('project lead: screen', () => {
  test('the Owner makes a Team Leader the lead from the team list and removes them again', async ({ page, request }) => {
    const pm = await apiLogin(request, 'pm.olivia')
    const project = await createProject(request, pm)
    try {
      await addMember(request, pm, project, 'lead.owen', 'ADMIN')
      await addMember(request, pm, project, 'dev.chen', 'MEMBER')
      await login(page, 'pm.olivia')
      await page.goto(`/projects/${project.id}`)

      // only a Team Leader gets the button
      await expect(page.getByRole('button', { name: 'Make lead' })).toHaveCount(1)
      await page.getByRole('button', { name: 'Make lead' }).click()
      await expect(page.getByTestId('project-lead')).toContainText('Owen')
      await expect(page.getByRole('button', { name: 'Remove as lead' })).toBeVisible()

      await page.getByRole('button', { name: 'Remove as lead' }).click()
      await expect(page.getByTestId('project-lead')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Make lead' })).toBeVisible()
    } finally {
      await request.delete(`/api/projects/${project.id}`, { headers: pm })
    }
  })

  test('a Team Leader sees the lead but has no button to change it', async ({ page, request }) => {
    const pm = await apiLogin(request, 'pm.olivia')
    const project = await createProject(request, pm)
    try {
      await addMember(request, pm, project, 'lead.owen', 'ADMIN')
      await setLead(request, pm, project.id, await userId(request, pm, 'lead.owen'))
      await login(page, 'lead.owen')
      await page.goto(`/projects/${project.id}`)
      await expect(page.getByTestId('project-lead')).toContainText('Owen')
      await expect(page.getByRole('button', { name: /make lead|remove as lead/i })).toHaveCount(0)
    } finally {
      await request.delete(`/api/projects/${project.id}`, { headers: pm })
    }
  })
})
