import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', () => ({ apiFetch: vi.fn(() => Promise.resolve([])) }))

import { apiFetch } from './client'
import { getMilestones } from './milestones'

describe('getMilestones', () => {
  beforeEach(() => apiFetch.mockClear())

  it('reads every milestone when no window is given', () => {
    getMilestones()

    expect(apiFetch).toHaveBeenCalledWith('/milestones')
  })

  it('reads the milestones due in a window, both days included', () => {
    getMilestones({ from: '2026-10-12', to: '2026-10-18' })

    expect(apiFetch).toHaveBeenCalledWith('/milestones?dueFrom=2026-10-12&dueTo=2026-10-18')
  })

  it('an open end is left out of the request', () => {
    getMilestones({ from: '2026-10-12' })

    expect(apiFetch).toHaveBeenCalledWith('/milestones?dueFrom=2026-10-12')
  })
})
