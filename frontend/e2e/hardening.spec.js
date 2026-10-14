import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD, SEED_ADMIN_USERNAME } from './helpers.js'

// Weaknesses from the issue register, checked against the live stack:
//   I-08  the code endpoints do not tell a caller which usernames exist
//   I-09  the sign-in lockout is per client address, and a client cannot pose as another one
//   I-11  a refused write never shows a table, column or constraint name
//   I-12  an invitation reaches a person who turned task notifications off
//   I-13  a pending invitation can be seen and cancelled, and its notice goes with it

const apiLogin = async (request, username, password = SEED_PASSWORD) => {
  const res = await request.post('/api/auth/login', { data: { username, password } })
  expect(res.status()).toBe(200)
  return { Authorization: `Bearer ${(await res.json()).token}` }
}

test.describe('hardening', () => {
  test('I-08: verifying or asking for a code reveals nothing about which usernames exist', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const stamp = `${Date.now()}`
    const pending = `pending.probe.${stamp}`
    const registered = await request.post('/api/auth/register', {
      data: { username: pending, email: `${pending}@example.test`, password: 'Sup3rSecret!pw', confirmPassword: 'Sup3rSecret!pw' },
    })
    expect(registered.status()).toBe(201)
    try {
      const verify = async (username) => {
        const res = await request.post('/api/auth/verify-otp', { data: { username, otp: '000000' } })
        return { status: res.status(), message: (await res.json()).message }
      }
      // an unknown name, an account that is already verified and a pending one with a wrong code all answer alike
      const unknown = await verify(`ghost.${stamp}`)
      const verified = await verify(SEED_ADMIN_USERNAME)
      const wrongCode = await verify(pending)
      expect(unknown.status).toBe(400)
      expect(verified).toEqual(unknown)
      expect(wrongCode).toEqual(unknown)
      expect(unknown.message).toMatch(/incorrect or has expired/i)
      // asking for a new code never says whether the account exists
      for (const username of [`ghost.${stamp}`, SEED_ADMIN_USERNAME]) {
        expect((await request.post('/api/auth/resend-otp', { data: { username } })).status(), username).toBe(200)
      }
    } finally {
      const found = await request.get(`/api/users/username/${pending}`, { headers: admin })
      if (found.ok()) await request.delete(`/api/users/${(await found.json()).id}`, { headers: admin })
    }
  })

  test('I-13: a pending invitation is listed with its inviter and can be cancelled, and the invitee notice goes with it', async ({ page, request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const pm = await apiLogin(request, 'pm.olivia')
    const stamp = `${Date.now()}`
    const username = `invited.${stamp}`
    const fullName = `Invited Person ${stamp}`
    const created = await request.post('/api/users', {
      headers: admin,
      data: { fullName, username, email: `${username}@example.com`, password: SEED_PASSWORD, accountStatus: 'ACTIVE' },
    })
    expect(created.status()).toBe(201)
    const userId = (await created.json()).id
    const projectRes = await request.post('/api/projects', {
      headers: pm,
      data: { name: `e2e invitations ${stamp}`, priority: 'LOW', status: 'IN_PROGRESS', startDate: '2026-01-01', endDate: '2099-12-31' },
    })
    expect(projectRes.status()).toBe(201)
    const project = await projectRes.json()
    try {
      expect((await request.post('/api/project-members/invite', { headers: pm, data: { projectId: project.id, username, projectRole: 'MEMBER' } })).status()).toBe(201)
      const theirs = await apiLogin(request, username)
      const notices = async () => (await (await request.get('/api/notifications', { headers: theirs })).json()).filter((n) => n.type === 'TEAM_INVITATION')
      expect(await notices()).toHaveLength(1)

      await login(page, 'pm.olivia')
      await page.goto(`/projects/${project.id}`)
      await expect(page.getByText('1 pending invitation', { exact: true })).toBeVisible()
      const list = page.getByTestId('pending-invitations')
      await expect(list).toContainText(fullName)
      await expect(list).toContainText('Team Member')
      await expect(list).toContainText('invited by')

      await page.getByRole('button', { name: `Cancel the invitation to ${fullName}` }).click()
      await expect(page.getByText(`The invitation to ${fullName} was cancelled`)).toBeVisible()
      await expect(page.getByTestId('pending-invitations')).toHaveCount(0)
      // the invitation row and the invitee notice offering Accept / Decline are both gone
      expect((await (await request.get(`/api/project-members/project/${project.id}/invitations`, { headers: pm })).json())).toHaveLength(0)
      expect(await notices()).toHaveLength(0)
    } finally {
      await request.delete(`/api/projects/${project.id}`, { headers: pm })
      await request.delete(`/api/users/${userId}`, { headers: admin })
    }
  })

  test('I-09: five failed sign-ins lock the name for that client, and a spoofed X-Forwarded-For does not help', async ({ request }) => {
    // a name no account has, so only this test's own lockout is touched
    const username = `lockout.probe.${Date.now()}`
    const attempt = (headers = {}) =>
      request.post('/api/auth/login', { headers, data: { username, password: 'Wrong-Passw0rd!' } })

    for (let i = 1; i <= 5; i++) expect((await attempt()).status(), `attempt ${i}`).toBe(401)
    expect((await attempt()).status()).toBe(429)
    // the proxy sets the address itself from the connection, so a header from the client is ignored
    expect((await attempt({ 'X-Forwarded-For': '203.0.113.9' })).status()).toBe(429)
  })

  test('I-11: a refused write answers in plain words, with no database names', async ({ request }) => {
    const pm = await apiLogin(request, 'pm.olivia')
    const stamp = `${Date.now()}`
    const projectRes = await request.post('/api/projects', {
      headers: pm,
      data: { name: `e2e hardening ${stamp}`, priority: 'LOW', status: 'IN_PROGRESS', startDate: '2026-01-01', endDate: '2099-12-31' },
    })
    expect(projectRes.status()).toBe(201)
    const project = await projectRes.json()
    try {
      const res = await request.post('/api/tasks', {
        headers: pm,
        data: { projectId: project.id, title: `Backwards dates ${stamp}`, priority: 'LOW', status: 'TODO', startDate: '2026-06-10', dueDate: '2026-06-01' },
      })
      expect(res.status()).toBe(400)
      const body = await res.json()
      expect(body.message).toBe('The task due date cannot be before its start date.')
      expect(JSON.stringify(body)).not.toMatch(/violates|constraint|relation|tasks_check|new row/i)
    } finally {
      await request.delete(`/api/projects/${project.id}`, { headers: pm })
    }
  })

  test('I-12: an invitation is delivered even when the invitee switched task notifications off', async ({ request }) => {
    const admin = await apiLogin(request, SEED_ADMIN_USERNAME)
    const pm = await apiLogin(request, 'pm.olivia')
    const stamp = `${Date.now()}`
    const username = `quiet.${stamp}`
    const created = await request.post('/api/users', {
      headers: admin,
      data: { fullName: `Quiet Person ${stamp}`, username, email: `${username}@example.com`, password: SEED_PASSWORD, accountStatus: 'ACTIVE' },
    })
    expect(created.status()).toBe(201)
    const userId = (await created.json()).id
    const projectRes = await request.post('/api/projects', {
      headers: pm,
      data: { name: `e2e quiet ${stamp}`, priority: 'LOW', status: 'IN_PROGRESS', startDate: '2026-01-01', endDate: '2099-12-31' },
    })
    expect(projectRes.status()).toBe(201)
    const project = await projectRes.json()
    try {
      const theirs = await apiLogin(request, username)
      const prefs = await request.put('/api/users/me/preferences', {
        headers: theirs,
        data: { themePreference: 'SYSTEM', taskNotificationsEnabled: false },
      })
      expect(prefs.status()).toBe(200)

      const invite = await request.post('/api/project-members/invite', {
        headers: pm,
        data: { projectId: project.id, username, projectRole: 'MEMBER' },
      })
      expect(invite.status()).toBe(201)

      const notifications = await (await request.get('/api/notifications', { headers: theirs })).json()
      const invitation = notifications.find((n) => n.type === 'TEAM_INVITATION')
      expect(invitation, 'the invitation notification').toBeTruthy()
      expect(invitation.message).toContain(`e2e quiet ${stamp}`)
    } finally {
      await request.delete(`/api/projects/${project.id}`, { headers: pm })
      await request.delete(`/api/users/${userId}`, { headers: admin })
    }
  })
})
