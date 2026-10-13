import { readFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import { login } from './helpers.js'

// G-14: every report (and the KPIs) can be saved as an Excel or a PDF file. The files are made in
// the browser from the report on the screen, so there is nothing to call on the server; the specs
// generate each report for the seeded project "Website Redesign" (read only) and check that the
// downloads are real files of the right kind.

const PROJECT = 'Website Redesign'

const REPORTS = [
  { tab: 'Project Report', testId: 'report-project', title: 'Project Report', project: true },
  { tab: 'Task Report', testId: 'report-tasks', title: 'Task Report' },
  { tab: 'Project Status', testId: 'report-project-status', title: 'Project Status Report' },
  { tab: 'Task Completion', testId: 'report-task-completion', title: 'Task Completion Report', range: true },
  { tab: 'Overdue Tasks', testId: 'report-overdue', title: 'Overdue Task Report' },
  { tab: 'Team Performance', testId: 'report-team-performance', title: 'Team Performance Report' },
  { tab: 'Workload', testId: 'report-workload', title: 'Workload Report' },
]

async function download(page, scope, button) {
  const [file] = await Promise.all([page.waitForEvent('download'), scope.getByRole('button', { name: button, exact: true }).click()])
  return { name: file.suggestedFilename(), bytes: await readFile(await file.path()) }
}

test.describe('report export', () => {
  test('nothing can be exported before a report is generated', async ({ page }) => {
    await login(page, 'pm.olivia')
    await page.goto('/reports?tab=tasks')
    const report = page.getByTestId('report-tasks')
    await expect(report.getByRole('button', { name: 'Generate' })).toBeVisible()
    await expect(report.getByTestId('report-export')).toHaveCount(0)
  })

  for (const r of REPORTS) {
    test(`${r.title}: saved as an Excel file and as a PDF`, async ({ page }) => {
      await login(page, 'pm.olivia')
      await page.getByRole('navigation').getByRole('link', { name: 'Reports' }).click()
      await page.getByRole('tab', { name: r.tab }).click()
      const report = page.getByTestId(r.testId)
      if (r.project) await report.getByLabel('Project').selectOption({ label: PROJECT })
      if (r.range) {
        await report.getByLabel('Due from').fill('2026-01-01')
        await report.getByLabel('Due to').fill('2027-12-31')
      }
      await report.getByRole('button', { name: 'Generate' }).click()
      await expect(report.getByTestId('report-result')).toBeVisible()

      const slug = r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')

      const excel = await download(page, report, 'Excel')
      expect(excel.name).toMatch(new RegExp(`^${slug}-\\d{4}-\\d{2}-\\d{2}\\.xlsx$`))
      // an .xlsx is a zip archive holding the worksheet
      expect(excel.bytes.subarray(0, 2).toString()).toBe('PK')
      expect(excel.bytes.includes('xl/worksheets/sheet1.xml')).toBe(true)
      await expect(page.getByText('Excel file saved')).toBeVisible()

      const pdf = await download(page, report, 'PDF')
      expect(pdf.name).toMatch(new RegExp(`^${slug}-\\d{4}-\\d{2}-\\d{2}\\.pdf$`))
      expect(pdf.bytes.subarray(0, 5).toString()).toBe('%PDF-')
      // the page is not compressed, so the title is readable in the file
      expect(pdf.bytes.toString('latin1')).toContain(r.title)
      await expect(page.getByText('PDF file saved')).toBeVisible()
    })
  }

  test('the KPIs are exported too', async ({ page }) => {
    await login(page, 'pm.olivia')
    await page.goto('/reports?tab=kpis')
    const view = page.getByTestId('kpi-view')
    await expect(view.getByTestId('kpi-task-completion')).toBeVisible()

    const excel = await download(page, view, 'Excel')
    expect(excel.name).toMatch(/^key-performance-indicators-\d{4}-\d{2}-\d{2}\.xlsx$/)
    expect(excel.bytes.subarray(0, 2).toString()).toBe('PK')

    const pdf = await download(page, view, 'PDF')
    expect(pdf.bytes.toString('latin1')).toContain('Task completion rate')
  })
})
