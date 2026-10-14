// Report export to Excel and PDF (G-14, optional in the specification). It runs in the browser from
// the report the server already calculated, so a file always matches what is on the screen and no
// endpoint, permission or stored file is involved.
//
// Every report is turned into the same plain document first:
//   { title, scope, tables: [{ heading, head: [text], rows: [[text|number]], right: [bool], empty? }] }
// and the two writers (xlsx, pdf) only know that shape. The libraries are loaded the first time a
// file is asked for, so they are not part of the page everyone downloads.

import { fullDate, hours, pct } from './reportFormat'
import { formatLongDate, humanizeEnum, projectRoleLabel } from '../../api/format'

const DASH = '—'

const people = (names) => (names?.length ? names.join(', ') : 'Unassigned')
const percent = (value) => `${Math.round(Number(value ?? 0))}%`
const dates = (from, to) => `${fullDate(from)} - ${fullDate(to)}`

// { head, cell(row), right? } -> a table
function table(heading, columns, rows, empty) {
  return {
    heading,
    head: columns.map((c) => c.head),
    right: columns.map((c) => Boolean(c.right)),
    rows: (rows ?? []).map((row) => columns.map((c) => c.cell(row))),
    empty,
  }
}

const TASK = {
  title: { head: 'Task', cell: (r) => r.title },
  project: { head: 'Project', cell: (r) => r.projectName },
  assignees: { head: 'Assignee', cell: (r) => people(r.assignees) },
  priority: { head: 'Priority', cell: (r) => humanizeEnum(r.priority) },
  status: { head: 'Status', cell: (r) => humanizeEnum(r.status) },
  progress: { head: 'Progress', right: true, cell: (r) => percent(r.progress) },
  start: { head: 'Start', cell: (r) => fullDate(r.startDate) },
  due: { head: 'Due', cell: (r) => fullDate(r.dueDate) },
  estimated: { head: 'Est. h', right: true, cell: (r) => (r.estimatedHours == null ? DASH : hours(r.estimatedHours)) },
  daysOverdue: { head: 'Days overdue', right: true, cell: (r) => r.daysOverdue },
  completedAt: { head: 'Completed', cell: (r) => fullDate(r.completedAt?.slice(0, 10)) },
}

// ---------------------------------------------------------------- the tables of each report

export function projectReportTables(r) {
  const p = r.project
  const details = [
    ['Project', p.name],
    ['Code', p.projectCode],
    ['Status', humanizeEnum(p.status)],
    ['Priority', p.priority ? humanizeEnum(p.priority) : DASH],
    ['Owner', p.owner?.fullName ?? DASH],
    ['Dates', dates(p.startDate, p.endDate)],
    ['Completed on', p.completedAt ? formatLongDate(p.completedAt) : DASH],
    ['Progress', percent(p.progress)],
    ['Description', r.description || DASH],
  ]
  const counts = r.taskCounts
  return [
    { heading: 'Project', head: ['Field', 'Value'], right: [false, false], rows: details },
    {
      heading: 'Tasks',
      head: ['Tasks', 'To Do', 'In Progress', 'In Review', 'Completed', 'Cancelled', 'Overdue'],
      right: Array(7).fill(true),
      rows: [[counts.total, counts.todo, counts.inProgress, counts.inReview, counts.completed, counts.cancelled, counts.overdue]],
    },
    table(
      `Team (${r.team.length})`,
      [
        { head: 'Member', cell: (m) => m.user.fullName },
        { head: 'Project role', cell: (m) => projectRoleLabel(m.projectRole) },
      ],
      r.team
    ),
    table(
      `Milestones (${r.milestones.length})`,
      [
        { head: 'Milestone', cell: (m) => m.title },
        { head: 'Due', cell: (m) => fullDate(m.dueDate) },
        { head: 'Status', cell: (m) => humanizeEnum(m.status) },
        { head: 'Progress', right: true, cell: (m) => percent(m.progress) },
      ],
      r.milestones,
      'No milestones.'
    ),
    table(
      'Upcoming deadlines (next 14 days, including overdue)',
      [TASK.title, TASK.assignees, TASK.due, TASK.status],
      r.upcomingDeadlines,
      'No open task is due in the next 14 days.'
    ),
  ]
}

export function taskReportTables(r) {
  return [
    table(
      `Tasks (${r.rows.length})`,
      [TASK.title, TASK.project, TASK.assignees, TASK.priority, TASK.status, TASK.progress, TASK.start, TASK.due, TASK.estimated],
      r.rows,
      'No task matches these filters.'
    ),
  ]
}

export function projectStatusTables(r) {
  const columns = [
    { head: 'Project', cell: (p) => p.name },
    { head: 'Code', cell: (p) => p.projectCode },
    { head: 'Owner', cell: (p) => p.owner?.fullName ?? DASH },
    { head: 'Priority', cell: (p) => humanizeEnum(p.priority) },
    { head: 'Dates', cell: (p) => dates(p.startDate, p.endDate) },
    { head: 'Completed on', cell: (p) => (p.completedAt ? formatLongDate(p.completedAt) : DASH) },
    { head: 'Progress', right: true, cell: (p) => percent(p.progress) },
    { head: 'Days delayed', right: true, cell: (p) => (p.delayed ? p.daysDelayed : DASH) },
  ]
  return r.groups.map((g) =>
    table(`${g.label} (${g.count})`, columns, g.projects, `No ${g.label.toLowerCase()} projects.`)
  )
}

export function taskCompletionTables(r) {
  return [
    {
      heading: 'Overall',
      head: ['Tasks due in the range', 'Completed', 'Completion'],
      right: [true, true, true],
      rows: [[r.overall.total, r.overall.completed, pct(r.overall.percentage)]],
    },
    table(
      `By ${r.groupBy === 'member' ? 'team member' : r.groupBy}`,
      [
        { head: humanizeEnum(r.groupBy === 'member' ? 'team_member' : r.groupBy), cell: (g) => g.label },
        { head: 'Tasks', right: true, cell: (g) => g.total },
        { head: 'Completed', right: true, cell: (g) => g.completed },
        { head: 'Completion', right: true, cell: (g) => pct(g.percentage) },
      ],
      r.groups,
      'No tasks are due in this range.'
    ),
    table(
      `Completed tasks (${r.completedTasks.length})`,
      [TASK.title, TASK.project, TASK.assignees, TASK.due, TASK.completedAt],
      r.completedTasks,
      'Nothing was completed.'
    ),
  ]
}

export function overdueTables(r) {
  return [
    table(
      `Overdue tasks (${r.rows.length})`,
      [TASK.title, TASK.project, TASK.assignees, TASK.due, TASK.daysOverdue, TASK.status],
      r.rows,
      'Nothing is overdue.'
    ),
  ]
}

export function teamPerformanceTables(r) {
  return [
    table(
      'Team performance',
      [
        { head: 'Member', cell: (m) => m.user.fullName },
        { head: 'Assigned', right: true, cell: (m) => m.assigned },
        { head: 'Completed', right: true, cell: (m) => m.completed },
        { head: 'To Do (pending)', right: true, cell: (m) => m.todo },
        { head: 'In Progress', right: true, cell: (m) => m.inProgress },
        { head: 'In Review', right: true, cell: (m) => m.inReview },
        { head: 'Overdue', right: true, cell: (m) => m.overdue },
        { head: 'Completion rate', right: true, cell: (m) => pct(m.completionRate) },
      ],
      r.members,
      'No member has tasks in this scope.'
    ),
  ]
}

export function workloadTables(r) {
  return [
    table(
      'Workload',
      [
        { head: 'Member', cell: (m) => m.user.fullName },
        { head: 'Assigned', right: true, cell: (m) => m.assigned },
        { head: 'Active', right: true, cell: (m) => m.active },
        { head: 'Overdue', right: true, cell: (m) => m.overdue },
        { head: 'Estimated h', right: true, cell: (m) => hours(m.estimatedHours) },
        { head: 'Actual h', right: true, cell: (m) => hours(m.actualHours) },
        { head: 'Load', cell: (m) => humanizeEnum(m.level) },
      ],
      r.workload?.members,
      'No team members to compare.'
    ),
  ]
}

// `help` maps the indicator keys to their formulas (the tiles' tooltips).
export function kpiTables(data, help) {
  const days = data.averageTaskCompletionDays
  const b = data.basis
  return [
    {
      heading: 'Key performance indicators',
      head: ['Indicator', 'Value', 'Formula'],
      right: [false, true, false],
      rows: [
        ['Project completion rate', pct(data.projectCompletionRate), help.project],
        ['Task completion rate', pct(data.taskCompletionRate), help.task],
        ['Overdue rate', pct(data.overdueRate), help.overdue],
        ['Average task completion time', days == null ? DASH : `${Number(days).toFixed(1)} days`, help.days],
        ['On-time completion rate', pct(data.onTimeCompletionRate), help.onTime],
      ],
    },
    {
      heading: 'Based on',
      head: ['Projects', 'Tasks', 'Completed', 'Cancelled', 'Overdue'],
      right: Array(5).fill(true),
      rows: [[b.projects, b.tasks, b.completedTasks, b.cancelledTasks, b.overdueTasks]],
    },
  ]
}

// ---------------------------------------------------------------- the files

// The scope line under a report's title: which projects, the date range, when it was generated.
export function scopeText(scope) {
  const range = scope.from || scope.to ? ` · ${fullDate(scope.from)} – ${fullDate(scope.to)}` : ''
  return `${scope.projectName ?? `All your projects (${scope.projects})`}${range} · generated ${new Date(scope.generatedAt).toLocaleString()}`
}

export function buildDocument(title, scope, tables) {
  return { title, scope: scope ? scopeText(scope) : null, tables }
}

// report-title-2026-10-13.xlsx
export function exportFileName(title, extension, today = new Date()) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return `${slug}-${day}.${extension}`
}

const WIDTH_MIN = 8
const WIDTH_MAX = 50

// The cells of one sheet (the tables stacked, a blank row between) and the column widths.
export function sheetOf(doc) {
  const cell = (value, extra) => ({ value: value === '' || value == null ? null : value, ...extra })
  const bold = { fontWeight: 'bold' }
  const data = [[cell(doc.title, { fontWeight: 'bold', fontSize: 14 })]]
  if (doc.scope) data.push([cell(doc.scope, { textColor: '#666666' })])
  const widths = []
  const widen = (index, value) => {
    const length = String(value ?? '').length
    widths[index] = Math.min(WIDTH_MAX, Math.max(widths[index] ?? WIDTH_MIN, length + 2))
  }

  for (const t of doc.tables) {
    data.push([])
    data.push([cell(t.heading, bold)])
    if (t.rows.length === 0 && t.empty) {
      data.push([cell(t.empty, { textColor: '#666666' })])
      continue
    }
    t.head.forEach((h, i) => widen(i, h))
    data.push(t.head.map((h, i) => cell(h, { ...bold, backgroundColor: '#eeeeee', align: t.right[i] ? 'right' : 'left' })))
    for (const row of t.rows) {
      row.forEach((v, i) => widen(i, v))
      data.push(row.map((v, i) => cell(v, t.right[i] ? { align: 'right' } : undefined)))
    }
  }
  return { data, columns: widths.map((width) => ({ width })) }
}

export async function downloadExcel(doc) {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const { data, columns } = sheetOf(doc)
  await writeExcelFile(data, { columns, sheet: doc.title.slice(0, 31) }).toFile(exportFileName(doc.title, 'xlsx'))
}

export async function downloadPdf(doc) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const margin = 36
  let y = margin

  pdf.setFont('helvetica', 'bold').setFontSize(16).text(doc.title, margin, y + 8)
  y += 26
  if (doc.scope) {
    pdf.setFont('helvetica', 'normal').setFontSize(9).setTextColor(100).text(doc.scope, margin, y)
    y += 10
  }
  pdf.setTextColor(0)

  for (const t of doc.tables) {
    // a heading never stays alone at the bottom of a page
    if (y > pdf.internal.pageSize.getHeight() - 90) {
      pdf.addPage()
      y = margin
    }
    y += 16
    pdf.setFont('helvetica', 'bold').setFontSize(11).text(t.heading, margin, y)
    y += 6
    if (t.rows.length === 0 && t.empty) {
      pdf.setFont('helvetica', 'normal').setFontSize(9).setTextColor(100).text(t.empty, margin, y + 10)
      pdf.setTextColor(0)
      y += 14
      continue
    }
    autoTable(pdf, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [t.head],
      body: t.rows.map((row) => row.map((v) => (v == null ? '' : String(v)))),
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [60, 60, 66], textColor: 255 },
      columnStyles: Object.fromEntries(t.right.map((right, i) => [i, { halign: right ? 'right' : 'left' }])),
    })
    y = pdf.lastAutoTable.finalY
  }

  const pages = pdf.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page)
    pdf.setFont('helvetica', 'normal').setFontSize(8).setTextColor(120)
    pdf.text(`Page ${page} of ${pages}`, pdf.internal.pageSize.getWidth() - margin, pdf.internal.pageSize.getHeight() - 16, { align: 'right' })
  }
  pdf.save(exportFileName(doc.title, 'pdf'))
}
