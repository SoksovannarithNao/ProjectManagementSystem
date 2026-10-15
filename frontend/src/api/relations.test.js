import { describe, expect, it } from 'vitest'
import { buildProjectTaskStats } from './relations'

describe('buildProjectTaskStats', () => {
  it('maps each project to its counts from the server rows', () => {
    const map = buildProjectTaskStats([
      { projectId: 10, total: 12, completed: 8, overdue: 2 },
      { projectId: 20, total: 0, completed: 0, overdue: 0 },
    ])

    expect(map.get(10)).toEqual({ total: 12, completed: 8, overdue: 2 })
    expect(map.get(20)).toEqual({ total: 0, completed: 0, overdue: 0 })
    expect(map.get(30)).toBeUndefined()
  })

  it('copes with no rows yet and with a row that has no project', () => {
    expect(buildProjectTaskStats(null).size).toBe(0)
    expect(buildProjectTaskStats([{ total: 1, completed: 0, overdue: 0 }]).size).toBe(0)
  })
})
