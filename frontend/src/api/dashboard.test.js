import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', () => ({ apiFetch: vi.fn(() => Promise.resolve([])) }))

import { apiFetch } from './client'
import { getTaskActivity } from './dashboard'

describe('getTaskActivity', () => {
  beforeEach(() => apiFetch.mockClear())

  const urlOf = () => new URL(apiFetch.mock.calls.at(-1)[0], 'http://x')

  it('asks for the last N days in the browser time zone', () => {
    getTaskActivity(30)

    const url = urlOf()
    expect(url.pathname).toBe('/dashboard/task-activity')
    expect(url.searchParams.get('days')).toBe('30')
    expect(url.searchParams.get('zone')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
    expect(url.searchParams.has('projectId')).toBe(false)
  })

  it('can be limited to one project', () => {
    getTaskActivity(7, { projectId: 12 })

    expect(urlOf().searchParams.get('projectId')).toBe('12')
  })
})
