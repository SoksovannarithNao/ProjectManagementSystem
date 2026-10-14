import { describe, expect, it } from 'vitest'
import { activityToPeriodPoints, computeTaskOverview, taskOverviewFromStats } from './stats'

const t = (id, status, extra = {}) => ({ id, status, ...extra })

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

describe('activityToPeriodPoints', () => {
  const rows = [
    { date: '2026-10-12', created: 2, completed: 1, overdue: 0 },
    { date: '2026-10-13', created: 0, completed: 3, overdue: 4 },
  ]

  it('turns the server rows into the chart points, keeping the order and the figures', () => {
    const points = activityToPeriodPoints(rows, 7)

    expect(points).toHaveLength(2)
    expect(points[0]).toMatchObject({ completed: 1, created: 2, overdue: 0 })
    expect(points[1]).toMatchObject({ completed: 3, created: 0, overdue: 4 })
  })

  it('reads each date as that day in local time, labelled by weekday for a week and M/D for longer', () => {
    const week = activityToPeriodPoints(rows, 7)
    expect(week[0].date.getFullYear()).toBe(2026)
    expect(week[0].date.getMonth()).toBe(9)
    expect(week[0].date.getDate()).toBe(12)
    expect(week[0].day).toBe('Mon') // 12 Oct 2026 is a Monday
    expect(week[1].day).toBe('Tue')

    expect(activityToPeriodPoints(rows, 30).map((p) => p.day)).toEqual(['10/12', '10/13'])
  })

  it('gives no points before the rows have arrived', () => {
    expect(activityToPeriodPoints(null, 7)).toEqual([])
    expect(activityToPeriodPoints(undefined, 30)).toEqual([])
  })
})
