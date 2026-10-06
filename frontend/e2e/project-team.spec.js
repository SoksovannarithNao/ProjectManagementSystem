import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD } from './helpers.js'

// Seed data (database/init/02-seed.sql): pm.olivia is OWNER of PRJ-2001 and
// dev.chen a plain MEMBER of it. newuser (ACTIVE) and dev.hana (ACTIVE, not on
// PRJ-2001) are invitable; contractor.felix is INACTIVE and exemployee.diego
// SUSPENDED. The seed also leaves one PENDING invitation on PRJ-2001
// (dev.tomas), so counts are asserted relative to a baseline. Every
// invitation a test sends is deleted again in afterEach.
const PROJECT_CODE = 'PRJ-2001'

async function authHeaders(request, username) {
  const r = await request.post('/api/auth/login', { data: { username, password: SEED_PASSWORD } })
  return { Authorization: `Bearer ${(await r.json()).token}` }
}

async function projectId(request, headers) {
  const projects = await (await request.get('/api/projects', { headers })).json()
  return projects.find((p) => p.projectCode === PROJECT_CODE).id
}

const searchUsernames = async (request, headers, id, q) =>
  (await (await request.get(`/api/project-members/project/${id}/invitable-users?q=${encodeURIComponent(q)}`, { headers })).json()).map(
    (u) => u.username
  )

test.describe.configure({ mode: 'serial' })

test.describe('project team: invitations, eligibility and suggestions', () => {
  const sentInvites = []

  test.afterEach(async ({ request }) => {
    const headers = await authHeaders(request, 'pm.olivia')
    for (const memberId of sentInvites.splice(0)) {
      await request.delete(`/api/project-members/${memberId}`, { headers })
    }
  })

  async function invite(request, headers, id, username) {
    const r = await request.post('/api/project-members/invite', { headers, data: { projectId: id, username } })
    if (r.ok()) sentInvites.push((await r.json()).id)
    return r
  }

  // ---- duplicate project code -> clean 409 --------------------------------

  test('creating a project with an existing code returns a clean 409, not the raw database error', async ({ request }) => {
    const headers = await authHeaders(request, 'pm.olivia')
    const r = await request.post('/api/projects', {
      headers,
      data: { projectCode: PROJECT_CODE, name: 'E2E duplicate code', startDate: '2026-10-01', endDate: '2026-12-31' },
    })
    expect(r.status()).toBe(409)
    const body = await r.json()
    expect(body.message).toBe('Project code already exists.')
    expect(JSON.stringify(body)).not.toMatch(/duplicate key|projects_project_code_key|violates/i)
  })

  // ---- INACTIVE / SUSPENDED are not eligible ------------------------------

  test('INACTIVE and SUSPENDED users cannot be invited (backend), ACTIVE users still can', async ({ request }) => {
    const headers = await authHeaders(request, 'pm.olivia')
    const id = await projectId(request, headers)

    for (const username of ['contractor.felix', 'exemployee.diego']) {
      const r = await invite(request, headers, id, username)
      expect(r.status(), username).toBe(400)
      expect((await r.json()).message).toContain('inactive account')
    }

    const ok = await invite(request, headers, id, 'dev.hana')
    expect(ok.status()).toBe(201)
    expect((await ok.json()).status).toBe('PENDING')
  })

  test('INACTIVE/SUSPENDED users cannot be added through the direct member endpoint either', async ({ request }) => {
    const headers = await authHeaders(request, 'pm.olivia')
    const id = await projectId(request, headers)
    // Direct-add takes a user id; an admin sees the whole directory, so resolve ids as one.
    const adminHeaders = await authHeaders(request, 'admin.system')
    const all = await (await request.get('/api/users', { headers: adminHeaders })).json()
    for (const username of ['contractor.felix', 'exemployee.diego']) {
      const target = all.find((u) => u.username === username)
      const r = await request.post('/api/project-members', {
        headers,
        data: { projectId: id, userId: target.id, projectRole: 'MEMBER' },
      })
      expect(r.status(), username).toBe(400)
    }
  })

  // ---- suggestions ---------------------------------------------------------

  test('suggestions search the whole org and exclude self, members, pending and inactive users', async ({ request }) => {
    const headers = await authHeaders(request, 'pm.olivia')
    const id = await projectId(request, headers)

    // newuser shares no project with pm.olivia, yet is found by username and by name
    expect(await searchUsernames(request, headers, id, 'newuser')).toContain('newuser')
    expect(await searchUsernames(request, headers, id, 'new user')).toContain('newuser')
    expect(await searchUsernames(request, headers, id, 'NEWUS')).toContain('newuser')

    // the full eligible list: never the caller, active members, or inactive/suspended accounts
    const all = await searchUsernames(request, headers, id, '')
    expect(all).not.toContain('pm.olivia') // the caller
    expect(all).not.toContain('dev.chen') // already an ACTIVE member of PRJ-2001
    expect(all).not.toContain('contractor.felix') // INACTIVE
    expect(all).not.toContain('exemployee.diego') // SUSPENDED
    expect(await searchUsernames(request, headers, id, 'felix')).toEqual([])
    expect(await searchUsernames(request, headers, id, 'diego')).toEqual([])

    // a pending invitee disappears from the suggestions
    expect(await searchUsernames(request, headers, id, 'dev.hana')).toEqual(['dev.hana'])
    expect((await invite(request, headers, id, 'dev.hana')).status()).toBe(201)
    expect(await searchUsernames(request, headers, id, 'dev.hana')).toEqual([])
  })

  test('suggestion search is capped, treats % and _ literally, and is limited to project managers', async ({ request }) => {
    const headers = await authHeaders(request, 'pm.olivia')
    const id = await projectId(request, headers)

    const capped = await (await request.get(`/api/project-members/project/${id}/invitable-users?limit=3`, { headers })).json()
    expect(capped.length).toBeLessThanOrEqual(3)
    expect(await searchUsernames(request, headers, id, '%')).toEqual([])
    expect(await searchUsernames(request, headers, id, '_')).toEqual([])

    // narrow response: no email/phone
    const sample = await (await request.get(`/api/project-members/project/${id}/invitable-users?q=newuser`, { headers })).json()
    expect(Object.keys(sample[0]).sort()).toEqual(['fullName', 'id', 'positionName', 'profilePhotoUrl', 'username'])

    // a plain MEMBER (dev.chen) may not browse for people to invite, nor see the pending count
    const member = await authHeaders(request, 'dev.chen')
    expect((await request.get(`/api/project-members/project/${id}/invitable-users`, { headers: member })).status()).toBe(403)
    expect((await request.get(`/api/project-members/project/${id}/invitations/count`, { headers: member })).status()).toBe(403)
  })

  // ---- pending invitation count -------------------------------------------

  test('pending count comes from PENDING invitations and shows on the project page', async ({ page, request }) => {
    const headers = await authHeaders(request, 'pm.olivia')
    const id = await projectId(request, headers)
    const count = async () =>
      (await (await request.get(`/api/project-members/project/${id}/invitations/count`, { headers })).json()).count

    const before = await count()
    const seededPending = await (await request.get(`/api/project-members/project/${id}/invitations`, { headers })).json()
    expect(before).toBe(seededPending.length) // counted from PENDING rows, not from the (ACTIVE-only) members list
    expect((await invite(request, headers, id, 'newuser')).status()).toBe(201)
    expect(await count()).toBe(before + 1)
    expect((await invite(request, headers, id, 'dev.hana')).status()).toBe(201)
    expect(await count()).toBe(before + 2)

    await login(page, 'pm.olivia')
    await page.goto(`/projects/${id}`)
    await expect(page.getByText(`${before + 2} pending invitations`, { exact: true })).toBeVisible()
  })

  test('pending line is hidden from a plain member', async ({ page, request }) => {
    const headers = await authHeaders(request, 'pm.olivia')
    const id = await projectId(request, headers)
    expect((await invite(request, headers, id, 'newuser')).status()).toBe(201)

    await login(page, 'dev.chen')
    await page.goto(`/projects/${id}`)
    await expect(page.getByRole('heading', { name: 'Members', exact: true })).toBeVisible()
    // PRJ-2001 does have pending invitations (seeded + the one just sent) — a plain member just isn't shown them
    await expect(page.getByText(/pending invitation/)).toHaveCount(0)
  })

  // ---- the picker in the UI ----------------------------------------------

  test('Add member picker finds users who share no project, by name or username, and updates the pending count', async ({ page, request }) => {
    const headers = await authHeaders(request, 'pm.olivia')
    const id = await projectId(request, headers)

    await login(page, 'pm.olivia')
    const countNow = async () =>
      (await (await request.get(`/api/project-members/project/${id}/invitations/count`, { headers })).json()).count
    const before = await countNow()

    await page.goto(`/projects/${id}`)
    await page.getByRole('button', { name: /add member/i }).click()
    const dialog = page.locator('div.animate-scale-in')
    const input = dialog.getByPlaceholder('Search by name or username')
    const options = dialog.locator('datalist option')

    await input.fill('new user') // by full name
    await expect(options).toHaveCount(1)
    await expect(options.first()).toHaveAttribute('value', 'newuser')

    await input.fill('felix') // INACTIVE -> never suggested
    await expect(options).toHaveCount(0)

    await input.fill('newuser')
    await expect(options.first()).toHaveAttribute('value', 'newuser')
    await dialog.getByRole('button', { name: /send invitation/i }).click()
    await expect(page.getByText('Invitation sent to newuser')).toBeVisible()
    await expect(page.getByText(`${before + 1} pending invitation${before + 1 === 1 ? '' : 's'}`, { exact: true })).toBeVisible()

    const pending = await (await request.get(`/api/project-members/project/${id}/invitations`, { headers })).json()
    // Only the invitation this test sent — the seed data has pending invitations of its own
    // (e.g. dev.tomas on PRJ-2001) that must not be cleaned up.
    sentInvites.push(...pending.filter((p) => p.user.username === 'newuser').map((p) => p.id))
  })

  test('inviting an inactive account from the UI shows the backend message', async ({ page, request }) => {
    const headers = await authHeaders(request, 'pm.olivia')
    const id = await projectId(request, headers)

    await login(page, 'pm.olivia')
    const before = (await (await request.get(`/api/project-members/project/${id}/invitations/count`, { headers })).json()).count

    await page.goto(`/projects/${id}`)
    await page.getByRole('button', { name: /add member/i }).click()
    const dialog = page.locator('div.animate-scale-in')
    await dialog.getByPlaceholder('Search by name or username').fill('contractor.felix')
    await dialog.getByRole('button', { name: /send invitation/i }).click()
    await expect(dialog.locator('p.text-danger')).toContainText('inactive account')
    expect(await (await request.get(`/api/project-members/project/${id}/invitations/count`, { headers })).json()).toEqual({ count: before })
  })
})
