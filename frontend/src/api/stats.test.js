import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computePeriodTaskStats, computeTaskOverview, groupTasksByStatus, taskOverviewFromStats } from './stats'

const t = (id, status, extra = {}) => ({ id, status, ...extra })

describe('groupTasksByStatus', () => {
  const tasks = [
    t(1, 'TODO'),
    t(2, 'TODO', { blocked: true }),
    t(3, 'IN_PROGRESS'),
    t(4, 'IN_REVIEW'),
    t(5, 'COMPLETED'),
    t(6, 'CANCELLED'),
  ]

  it('gives the four board columns by default (the dashboard mini-board)', () => {
    const columns = groupTasksByStatus(tasks)
    expect(columns.map((c) => c.title)).toEqual(['To Do', 'In Progress', 'In Review', 'Completed'])
    expect(columns[0].tasks.map((x) => x.id)).toEqual([1, 2])
  })

  it('splits a computed Blocked column out of To Do, so a task is in exactly one of them', () => {
    const columns = groupTasksByStatus(tasks, { includeBlocked: true })
    expect(columns.map((c) => c.title)).toEqual(['To Do', 'In Progress', 'In Review', 'Blocked', 'Completed'])
    expect(columns[0].tasks.map((x) => x.id)).toEqual([1])
    expect(columns[3].tasks.map((x) => x.id)).toEqual([2])
  })

  it('has no column for cancelled tasks and copes with no tasks', () => {
    const all = groupTasksByStatus(tasks).flatMap((c) => c.tasks)
    expect(all.find((x) => x.status === 'CANCELLED')).toBeUndefined()
    expect(groupTasksByStatus(undefined).every((c) => c.tasks.length === 0)).toBe(true)
  })
})

describe('task overview', () => {
  it('counts each status with its share of all tasks', () => {
    const overview = computeTaskOverview([t(1, 'TODO'), t(2, 'TODO'), t(3, 'COMPLETED'), t(4, 'IN_PROGRESS')])
    const byKey = Object.fromEntries(overview.map((o) => [o.key, o]))
    expect(byKey.todo).toMatchObject({ count: 2, percent: 50 })
    expect(byKey.completed).toMatchObject({ count: 1, percent: 25 })
    expect(byKey.in_review).toMatchObject({ count: 0, percent: 0 })
  })

  it('has zero shares for no tasks', () => {
    expect(computeTaskOverview([]).every((o) => o.count === 0 && o.percent === 0)).toBe(true)
  })

  it('shows the same rows from the counts the server calculated', () => {
    const overview = taskOverviewFromStats({ total: 8, todo: 4, inProgress: 2, inReview: 1, completed: 1, cancelled: 0 })
    expect(overview.map((o) => [o.label, o.count, o.percent])).toEqual([
      ['To Do', 4, 50],
      ['In Progress', 2, 25],
      ['In Review', 1, 13],
      ['Completed', 1, 13],
    ])
    expect(taskOverviewFromStats(undefined).every((o) => o.count === 0)).toBe(true)
  })
})

describe('computePeriodTaskStats', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 12, 15, 0, 0)) // Monday Oct 12, 2026
  })
  afterEach(() => vi.useRealTimers())

  it('returns one point per day, oldest first, ending today', () => {
    const points = computePeriodTaskStats([], 7)
    expect(points).toHaveLength(7)
    expect(points.at(-1).day).toBe('Mon')
    expect(points[0].day).toBe('Tue')
  })

  it('switches to M/D labels for longer periods', () => {
    expect(computePeriodTaskStats([], 30).at(-1).day).toBe('10/12')
  })

  it('counts created and completed tasks on their own day', () => {
    const tasks = [
      t(1, 'COMPLETED', { createdAt: new Date(2026, 9, 10, 9).toISOString(), completedAt: new Date(2026, 9, 12, 9).toISOString() }),
      t(2, 'TODO', { createdAt: new Date(2026, 9, 12, 8).toISOString() }),
      t(3, 'TODO', { createdAt: new Date(2026, 8, 1).toISOString() }), // before the window
    ]
    const points = computePeriodTaskStats(tasks, 7)
    const today = points.at(-1)
    const twoDaysAgo = points.at(-3)
    expect(today.created).toBe(1)
    expect(today.completed).toBe(1)
    expect(twoDaysAgo.created).toBe(1)
    expect(points.reduce((sum, p) => sum + p.created, 0)).toBe(2)
  })

  it('counts open tasks that were already past due on each day', () => {
    const tasks = [
      t(1, 'IN_PROGRESS', { dueDate: '2026-10-10' }),
      t(2, 'COMPLETED', { dueDate: '2026-10-10' }), // finished work is never overdue
      t(3, 'TODO', { dueDate: null }),
    ]
    const points = computePeriodTaskStats(tasks, 7)
    expect(points.at(-1).overdue).toBe(1)
    expect(points.at(-4).overdue).toBe(0) // Oct 9: not yet due
  })
})
