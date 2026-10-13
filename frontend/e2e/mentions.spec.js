import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD } from './helpers.js'

// G-14 / D-21: @mentions in task comments. Comments only, active project members only. A
// throw-away project holds the people involved: dev.chen (assignee), dev.mia (mentioned),
// lead.owen (Team Leader, the author) and pm.olivia (Owner); pm.marcus is NOT a member.

const apiLogin = async (request, username) => {
  const res = await request.post('/api/auth/login', { data: { username, password: SEED_PASSWORD } })
  expect(res.status()).toBe(200)
  return { Authorization: `Bearer ${(await res.json()).token}` }
}

test.describe.configure({ mode: 'serial' })

test.describe('@mentions in comments', () => {
  const stamp = Date.now()
  let pm, chen, mia, owen
  let project, task

  const idOf = async (request, headers, username) =>
    (await (await request.get(`/api/users/username/${username}`, { headers })).json()).id

  const mine = async (request, headers, type) =>
    (await (await request.get('/api/notifications', { headers })).json()).filter(
      (n) => n.type === type && n.projectId === project.id
    )

  test.beforeAll(async ({ request }) => {
    pm = await apiLogin(request, 'pm.olivia')
    chen = await apiLogin(request, 'dev.chen')
    mia = await apiLogin(request, 'dev.mia')
    owen = await apiLogin(request, 'lead.owen')

    const created = await request.post('/api/projects', {
      headers: pm,
      data: { name: `E2E mentions ${stamp}`, startDate: '2026-01-01', endDate: '2027-12-31', priority: 'LOW', status: 'IN_PROGRESS' },
    })
    expect(created.status()).toBe(201)
    project = await created.json()

    for (const [username, role] of [['dev.chen', 'MEMBER'], ['dev.mia', 'MEMBER'], ['lead.owen', 'ADMIN']]) {
      const added = await request.post('/api/project-members', {
        headers: pm,
        data: { projectId: project.id, userId: await idOf(request, pm, username), projectRole: role },
      })
      expect(added.status(), `add ${username}`).toBe(201)
    }

    const t = await request.post('/api/tasks', {
      headers: pm,
      data: { projectId: project.id, title: `E2E mention task ${stamp}`, priority: 'LOW', status: 'TODO', startDate: '2026-01-01', dueDate: '2027-06-30' },
    })
    expect(t.status()).toBe(201)
    task = await t.json()
    const assigned = await request.post('/api/task-assignees', {
      headers: pm,
      data: { taskId: task.id, userId: await idOf(request, pm, 'dev.chen') },
    })
    expect(assigned.status()).toBe(201)
  })

  test.afterAll(async ({ request }) => {
    if (project) await request.delete(`/api/projects/${project.id}`, { headers: pm })
  })

  test('API: a mentioned member gets a MENTION notification instead of the generic one; the author and outsiders get none', async ({ request }) => {
    const res = await request.post('/api/comments', {
      headers: owen,
      data: { taskId: task.id, message: 'Please check, @dev.mia. cc @lead.owen and @pm.marcus' },
    })
    expect(res.status()).toBe(201)
    const comment = await res.json()

    // the response names who the text mentions among the project's active members
    expect(comment.mentions.map((m) => m.username)).toEqual(['dev.mia', 'lead.owen'])

    const miaMentions = await mine(request, mia, 'MENTION')
    expect(miaMentions).toHaveLength(1)
    expect(miaMentions[0].title).toBe('You were mentioned')
    expect(miaMentions[0].message).toContain('mentioned you')
    expect(await mine(request, mia, 'COMMENT_ADDED')).toHaveLength(0)

    // the assignee and the Owner still get the ordinary new-comment notice
    expect(await mine(request, chen, 'COMMENT_ADDED')).toHaveLength(1)
    expect(await mine(request, pm, 'COMMENT_ADDED')).toHaveLength(1)
    // nobody is told about being mentioned by themselves
    expect(await mine(request, owen, 'MENTION')).toHaveLength(0)
    // a user outside the project is never reached
    const marcus = await apiLogin(request, 'pm.marcus')
    expect(await mine(request, marcus, 'MENTION')).toHaveLength(0)
  })

  test('API: editing a comment tells only the people it newly mentions', async ({ request }) => {
    const created = await request.post('/api/comments', { headers: owen, data: { taskId: task.id, message: 'Question for @dev.chen' } })
    const comment = await created.json()
    expect((await mine(request, chen, 'MENTION')).length).toBe(1)

    const edited = await request.put(`/api/comments/${comment.id}`, {
      headers: owen,
      data: { taskId: task.id, message: 'Question for @dev.chen and @dev.mia' },
    })
    expect(edited.status()).toBe(200)
    expect((await edited.json()).mentions.map((m) => m.username)).toEqual(['dev.chen', 'dev.mia'])

    expect((await mine(request, chen, 'MENTION')).length).toBe(1)
    expect((await mine(request, mia, 'MENTION')).length).toBe(2)
  })

  test('UI: typing @ offers the project members, the pick is highlighted, and the mentioned person sees it in the bell', async ({ page, browser }) => {
    await login(page, 'lead.owen')
    await page.goto('/tasks')
    await page.getByTestId('task-row').filter({ hasText: `E2E mention task ${stamp}` }).click()

    const composer = page.getByPlaceholder(/^Add a comment/)
    await composer.click()
    await composer.pressSequentially('Ready for you @mi')

    const list = page.getByRole('listbox', { name: 'Mention a member' })
    await expect(list).toBeVisible()
    // only members of this project, never the author
    await expect(list.getByRole('option')).toHaveCount(1)
    await expect(list.getByRole('option', { name: /dev\.mia/ })).toBeVisible()
    await list.getByRole('option', { name: /dev\.mia/ }).click()
    await expect(composer).toHaveValue('Ready for you @dev.mia ')

    // a bare @ lists the other members (never the author, never an outsider)
    await composer.pressSequentially('thanks @')
    await expect(list.getByRole('option', { name: /dev\.chen/ })).toBeVisible()
    await expect(list.getByRole('option', { name: /lead\.owen/ })).toHaveCount(0)
    await expect(list.getByRole('option', { name: /pm\.marcus/ })).toHaveCount(0)
    await composer.press('Escape')
    await expect(list).toHaveCount(0)
    await composer.fill('Ready for you @dev.mia, thanks')

    await page.getByRole('button', { name: 'Send comment' }).click()
    const mention = page.locator('[data-mention="dev.mia"]').last()
    await expect(mention).toHaveText('@dev.mia')
    await expect(mention).toHaveAttribute('title', /Mia/)

    // the mentioned person's own browser (the session lives in localStorage)
    const miaContext = await browser.newContext()
    try {
      const miaPage = await miaContext.newPage()
      await login(miaPage, 'dev.mia')
      await miaPage.getByRole('button', { name: 'Notifications' }).click()
      await expect(miaPage.getByText('You were mentioned').first()).toBeVisible()
      await expect(miaPage.getByText(new RegExp(`mentioned you on "E2E mention task ${stamp}"`)).first()).toBeVisible()
    } finally {
      await miaContext.close()
    }
  })
})
