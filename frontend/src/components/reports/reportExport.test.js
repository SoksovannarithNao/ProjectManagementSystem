import { describe, expect, it } from 'vitest'
import {
  buildDocument,
  exportFileName,
  kpiTables,
  overdueTables,
  projectReportTables,
  projectStatusTables,
  sheetOf,
  taskCompletionTables,
  taskReportTables,
  teamPerformanceTables,
  workloadTables,
} from './reportExport'

const task = (extra = {}) => ({
  id: 1,
  title: 'Draft the homepage',
  projectName: 'Website Redesign',
  assignees: ['Chen Wu', 'Mia Alvarez'],
  priority: 'HIGH',
  status: 'IN_PROGRESS',
  progress: 41.6,
  startDate: '2026-10-01',
  dueDate: '2026-10-20',
  estimatedHours: 8,
  daysOverdue: 3,
  completedAt: '2026-10-12T09:30:00Z',
  ...extra,
})

// Every table must be rectangular: as many cells in each row as headings.
const expectRectangular = (tables) => {
  for (const t of tables) {
    expect(t.right).toHaveLength(t.head.length)
    for (const row of t.rows) expect(row).toHaveLength(t.head.length)
  }
}

describe('the tables of each report', () => {
  it('writes a task row the way the screen does', () => {
    const [t] = taskReportTables({ rows: [task(), task({ assignees: [], estimatedHours: null, progress: 0 })] })
    expectRectangular([t])
    expect(t.heading).toBe('Tasks (2)')
    expect(t.head).toEqual(['Task', 'Project', 'Assignee', 'Priority', 'Status', 'Progress', 'Start', 'Due', 'Est. h'])
    expect(t.rows[0]).toEqual([
      'Draft the homepage', 'Website Redesign', 'Chen Wu, Mia Alvarez', 'High', 'In Progress', '42%',
      'Oct 1, 2026', 'Oct 20, 2026', '8',
    ])
    expect(t.rows[1][2]).toBe('Unassigned')
    expect(t.rows[1][8]).toBe('—')
  })

  it('keeps the numeric columns right-aligned', () => {
    const [t] = taskReportTables({ rows: [] })
    expect(t.head.filter((_, i) => t.right[i])).toEqual(['Progress', 'Est. h'])
    expect(t.empty).toBe('No task matches these filters.')
  })

  it('has a table per project status group, including the empty ones', () => {
    const tables = projectStatusTables({
      groups: [
        {
          key: 'DELAYED', label: 'Delayed', count: 1,
          projects: [{ name: 'Alpha', projectCode: 'PRJ-1', owner: { fullName: 'Olivia Bennett' }, priority: 'LOW', startDate: '2026-01-01', endDate: '2026-02-01', progress: 10, delayed: true, daysDelayed: 5 }],
        },
        { key: 'ON_HOLD', label: 'On Hold', count: 0, projects: [] },
      ],
    })
    expectRectangular(tables)
    expect(tables.map((t) => t.heading)).toEqual(['Delayed (1)', 'On Hold (0)'])
    expect(tables[0].rows[0]).toEqual(['Alpha', 'PRJ-1', 'Olivia Bennett', 'Low', 'Jan 1, 2026 - Feb 1, 2026', '—', '10%', 5])
    expect(tables[1].empty).toBe('No on hold projects.')
  })

  it('writes the project report as details, task counts, team, milestones and deadlines', () => {
    const tables = projectReportTables({
      project: { name: 'Alpha', projectCode: 'PRJ-1', status: 'IN_PROGRESS', priority: null, owner: { fullName: 'Olivia Bennett' }, startDate: '2026-01-01', endDate: '2026-02-01', progress: 50, completedAt: null },
      description: '',
      taskCounts: { total: 7, todo: 1, inProgress: 2, inReview: 1, completed: 2, cancelled: 1, overdue: 1 },
      team: [{ user: { fullName: 'Chen Wu' }, projectRole: 'MEMBER' }],
      milestones: [],
      upcomingDeadlines: [task()],
    })
    expectRectangular(tables)
    expect(tables.map((t) => t.heading)).toEqual([
      'Project', 'Tasks', 'Team (1)', 'Milestones (0)', 'Upcoming deadlines (next 14 days, including overdue)',
    ])
    expect(tables[0].rows).toContainEqual(['Priority', '—'])
    expect(tables[0].rows).toContainEqual(['Progress', '50%'])
    expect(tables[1].rows[0]).toEqual([7, 1, 2, 1, 2, 1, 1])
    expect(tables[2].rows).toEqual([['Chen Wu', 'Member (Team Member)']])
    expect(tables[3].empty).toBe('No milestones.')
  })

  it('writes the completion report with the grouping named', () => {
    const tables = taskCompletionTables({
      groupBy: 'member',
      overall: { total: 4, completed: 3, percentage: 75 },
      groups: [{ label: 'Chen Wu', total: 4, completed: 3, percentage: 75 }],
      completedTasks: [task()],
    })
    expectRectangular(tables)
    expect(tables[0].rows[0]).toEqual([4, 3, '75.0%'])
    expect(tables[1].heading).toBe('By team member')
    expect(tables[1].head[0]).toBe('Team Member')
    expect(tables[2].rows[0].at(-1)).toBe('Oct 12, 2026')
  })

  it('writes overdue, team performance and workload as one table each', () => {
    const user = { fullName: 'Chen Wu' }
    const tables = [
      ...overdueTables({ rows: [task()] }),
      ...teamPerformanceTables({ members: [{ user, assigned: 5, completed: 3, todo: 1, inProgress: 1, inReview: 0, overdue: 1, completionRate: 60 }] }),
      ...workloadTables({ workload: { members: [{ user, assigned: 5, active: 2, overdue: 1, estimatedHours: 12.5, actualHours: 9, level: 'OVERLOADED' }] } }),
    ]
    expectRectangular(tables)
    expect(tables[0].rows[0]).toEqual(['Draft the homepage', 'Website Redesign', 'Chen Wu, Mia Alvarez', 'Oct 20, 2026', 3, 'In Progress'])
    expect(tables[1].rows[0]).toEqual(['Chen Wu', 5, 3, 1, 1, 0, 1, '60.0%'])
    expect(tables[2].rows[0]).toEqual(['Chen Wu', 5, 2, 1, '12.5', '9', 'Overloaded'])
  })

  it('writes the KPIs with their formulas, and a dash where there is nothing to divide', () => {
    const help = { project: 'p', task: 't', overdue: 'o', days: 'd', onTime: 'ot' }
    const tables = kpiTables(
      {
        projectCompletionRate: 50, taskCompletionRate: null, overdueRate: 12.34, averageTaskCompletionDays: 4.25, onTimeCompletionRate: 100,
        basis: { projects: 3, tasks: 10, completedTasks: 4, cancelledTasks: 1, overdueTasks: 2 },
      },
      help
    )
    expectRectangular(tables)
    expect(tables[0].rows.map((r) => r[1])).toEqual(['50.0%', '—', '12.3%', '4.3 days', '100.0%'])
    expect(tables[0].rows[0][2]).toBe('p')
    expect(tables[1].rows[0]).toEqual([3, 10, 4, 1, 2])
  })
})

describe('the Excel sheet', () => {
  const doc = buildDocument('Overdue Task Report', { projectName: 'Alpha', projects: 1, from: null, to: null, generatedAt: '2026-10-13T10:00:00Z' }, [
    { heading: 'Overdue tasks (1)', head: ['Task', 'Days overdue'], right: [false, true], rows: [['Draft the homepage', 3]] },
    { heading: 'Nothing here', head: ['Task'], right: [false], rows: [], empty: 'Nothing is overdue.' },
  ])
  const { data, columns } = sheetOf(doc)

  it('stacks the title, the scope and the tables with a blank row between', () => {
    expect(data.map((row) => row.map((c) => c.value))).toEqual([
      ['Overdue Task Report'],
      [expect.stringContaining('Alpha · generated')],
      [],
      ['Overdue tasks (1)'],
      ['Task', 'Days overdue'],
      ['Draft the homepage', 3],
      [],
      ['Nothing here'],
      ['Nothing is overdue.'],
    ])
  })

  it('bolds the headings and right-aligns the numbers', () => {
    expect(data[3][0].fontWeight).toBe('bold')
    expect(data[4][1]).toMatchObject({ fontWeight: 'bold', align: 'right' })
    expect(data[5][1]).toMatchObject({ value: 3, align: 'right' })
  })

  it('sizes each column to its longest text, within limits', () => {
    expect(columns[0].width).toBe('Draft the homepage'.length + 2)
    expect(columns[1].width).toBeGreaterThanOrEqual(8)
    const wide = sheetOf({ title: 't', scope: null, tables: [{ heading: 'h', head: ['x'], right: [false], rows: [['y'.repeat(200)]] }] })
    expect(wide.columns[0].width).toBe(50)
  })

  it('leaves an empty value as an empty cell', () => {
    const blank = sheetOf({ title: 't', scope: null, tables: [{ heading: 'h', head: ['a', 'b'], right: [false, false], rows: [['', null]] }] })
    expect(blank.data.at(-1).map((c) => c.value)).toEqual([null, null])
  })
})

describe('the file name', () => {
  it('is the report title and the day', () => {
    expect(exportFileName('Task Completion Report', 'xlsx', new Date(2026, 9, 5))).toBe('task-completion-report-2026-10-05.xlsx')
    expect(exportFileName('Key performance indicators', 'pdf', new Date(2026, 10, 25))).toBe('key-performance-indicators-2026-11-25.pdf')
  })
})
