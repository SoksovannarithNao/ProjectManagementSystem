import { test, expect } from '@playwright/test'
import { login, SEED_PASSWORD } from './helpers.js'

// Gantt Chart Prototype (optional feature, workflow A8): task duration bars on a
// time axis, dependency arrows, overlap highlighting and a start-before-prerequisite
// warning. One throw-away project (owner pm.olivia) is built for the whole file
// and deleted afterwards.
//
//   Design the header   10-05 -> 10-15
//   Build the footer    10-12 -> 10-25   depends on Design (starts before it ends: a conflict)
//   Launch the site     11-10 -> 11-20   depends on Build  (starts after it ends)

const apiLogin = async (request, username) => {
  const res = await request.post('/api/auth/login', { data: { username, password: SEED_PASSWORD } })
  expect(res.status()).toBe(200)
  return { Authorization: `Bearer ${(await res.json()).token}` }
}

async function addTask(request, pm, project, title, fields = {}) {
  const res = await request.post('/api/tasks', {
    headers: pm,
    data: { projectId: project.id, title, priority: 'LOW', status: 'TODO', estimatedHours: 4, ...fields },
  })
  expect(res.status()).toBe(201)
  return res.json()
}

const depend = async (request, pm, task, prerequisite) =>
  expect((await request.post('/api/task-dependencies', { headers: pm, data: { taskId: task.id, dependsOnTaskId: prerequisite.id } })).status()).toBe(201)

test.describe.configure({ mode: 'serial' })

test.describe('Gantt chart', () => {
  let pm
  let project

  test.beforeAll(async ({ request }) => {
    pm = await apiLogin(request, 'pm.olivia')
    const res = await request.post('/api/projects', {
      headers: pm,
      data: { name: `e2e gantt ${Date.now()}`, priority: 'LOW', status: 'IN_PROGRESS', startDate: '2026-10-01', endDate: '2026-12-31' },
    })
    expect(res.status()).toBe(201)
    project = await res.json()

    const design = await addTask(request, pm, project, 'Design the header', { startDate: '2026-10-05', dueDate: '2026-10-15', status: 'IN_PROGRESS' })
    const build = await addTask(request, pm, project, 'Build the footer', { startDate: '2026-10-12', dueDate: '2026-10-25' })
    const launch = await addTask(request, pm, project, 'Launch the site', { startDate: '2026-11-10', dueDate: '2026-11-20' })
    await depend(request, pm, build, design)
    await depend(request, pm, launch, build)
  })

  test.afterAll(async ({ request }) => {
    if (project) await request.delete(`/api/projects/${project.id}`, { headers: pm })
  })

  test('draws a bar per task in date order, and every member can open it', async ({ page }) => {
    await login(page, 'pm.olivia')
    await page.goto(`/projects/${project.id}`)
    await page.getByRole('link', { name: 'Gantt' }).click()
    await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/gantt$`))

    await expect(page.getByTestId('gantt')).toBeVisible()
    await expect(page.getByTestId('gantt-task')).toHaveCount(3)
    await expect(page.getByTestId('gantt-count')).toHaveText('3 tasks')
    await expect(page.getByTestId('gantt-today')).toBeVisible()

    const left = async (name) => (await page.getByRole('button', { name: new RegExp(`Task ${name}`) }).boundingBox()).x
    expect(await left('Design the header')).toBeLessThan(await left('Build the footer'))
    expect(await left('Build the footer')).toBeLessThan(await left('Launch the site'))

    // the duration is written next to the name
    await expect(page.getByText('11 days').first()).toBeVisible()

    // a plain member sees the same chart (the Timeline and Gantt are open to every member)
    const memberRes = await page.request.post('/api/project-members/invite', {
      headers: pm,
      data: { projectId: project.id, username: 'dev.chen', projectRole: 'MEMBER' },
    })
    expect(memberRes.status()).toBe(201)
    const chen = await apiLogin(page.request, 'dev.chen')
    expect((await page.request.post(`/api/project-members/project/${project.id}/accept`, { headers: chen })).status()).toBe(200)
    const memberPage = await page.context().browser().newPage()
    await login(memberPage, 'dev.chen')
    await memberPage.goto(`/projects/${project.id}/gantt`)
    await expect(memberPage.getByTestId('gantt-task')).toHaveCount(3)
    await memberPage.close()
  })

  test('draws an arrow for each dependency and flags the one that starts before its prerequisite ends', async ({ page }) => {
    await login(page, 'pm.olivia')
    await page.goto(`/projects/${project.id}/gantt`)

    const arrows = page.getByTestId('gantt-dependency')
    await expect(arrows).toHaveCount(2)
    // Build the footer starts (10-12) before Design the header is due (10-15); Launch starts after Build ends
    await expect(page.locator('[data-testid="gantt-dependency"][data-conflict="true"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="gantt-dependency"][data-conflict="false"]')).toHaveCount(1)
    await expect(page.getByTestId('gantt-conflicts')).toHaveText('1 task starts before a prerequisite ends')
  })

  test('hovering a bar fades the tasks that do not overlap it', async ({ page }) => {
    await login(page, 'pm.olivia')
    await page.goto(`/projects/${project.id}/gantt`)

    const design = page.getByRole('button', { name: /Task Design the header/ })
    const build = page.getByRole('button', { name: /Task Build the footer/ })
    const launch = page.getByRole('button', { name: /Task Launch the site/ })

    await design.hover()
    await expect(launch).toHaveClass(/opacity-25/) // 11-10 -> 11-20 does not touch 10-05 -> 10-15
    await expect(build).not.toHaveClass(/opacity-25/) // 10-12 -> 10-25 overlaps it
    await expect(design).not.toHaveClass(/opacity-25/)

    await page.mouse.move(0, 0)
    await expect(launch).not.toHaveClass(/opacity-25/)
  })

  test('zooming out to months makes the bars narrower, and a bar opens the task panel', async ({ page }) => {
    await login(page, 'pm.olivia')
    await page.goto(`/projects/${project.id}/gantt`)

    const build = page.getByRole('button', { name: /Task Build the footer/ })
    const weeks = (await build.boundingBox()).width
    await page.getByRole('button', { name: 'Months' }).click()
    await expect(page.getByRole('button', { name: 'Months' })).toHaveAttribute('aria-pressed', 'true')
    expect((await build.boundingBox()).width).toBeLessThan(weeks)

    await build.click()
    await expect(page.getByRole('heading', { name: 'Build the footer' })).toBeVisible()
  })
})
