import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', () => ({ apiFetch: vi.fn(() => Promise.resolve({})) }))

import { apiFetch } from './client'
import { advanceTaskStatus, canAdvanceStatus, setTaskStatus, taskResponseToRequest, toggleTaskCompletion } from './tasks'

const task = (extra = {}) => ({
  id: 5,
  project: { id: 10 },
  milestone: { id: 3 },
  title: 'Draft the homepage',
  description: 'text',
  priority: 'HIGH',
  status: 'TODO',
  startDate: '2026-10-01',
  dueDate: '2026-10-20',
  estimatedHours: 4,
  progress: 25,
  completedAt: null,
  createdBy: { id: 1 },
  ...extra,
})

const sent = () => apiFetch.mock.calls.at(-1)

beforeEach(() => apiFetch.mockClear())

describe('canAdvanceStatus (the quick-advance circle)', () => {
  it('moves To Do and In Progress forward for everyone', () => {
    expect(canAdvanceStatus('TODO', false)).toBe(true)
    expect(canAdvanceStatus('IN_PROGRESS', false)).toBe(true)
  })

  it('leaves In Review to someone who may approve', () => {
    expect(canAdvanceStatus('IN_REVIEW', false)).toBe(false)
    expect(canAdvanceStatus('IN_REVIEW', true)).toBe(true)
  })

  it('never reopens a finished task by a stray click', () => {
    expect(canAdvanceStatus('COMPLETED', true)).toBe(false)
    expect(canAdvanceStatus('CANCELLED', true)).toBe(false)
  })
})

describe('advanceTaskStatus', () => {
  it('takes To Do to In Progress, never straight to Completed', async () => {
    await advanceTaskStatus(task({ status: 'TODO' }), true)
    expect(sent()[0]).toBe('/tasks/5')
    expect(sent()[1].method).toBe('PUT')
    expect(sent()[1].body.status).toBe('IN_PROGRESS')
    expect(sent()[1].body.completedAt).toBeNull()
  })

  it('submits for review when the user may not approve', async () => {
    await advanceTaskStatus(task({ status: 'IN_PROGRESS' }), false)
    expect(sent()[1].body.status).toBe('IN_REVIEW')
    expect(sent()[1].body.progress).toBe(25)
  })

  it('completes the task at 100% with a completion time when the user may approve', async () => {
    await advanceTaskStatus(task({ status: 'IN_PROGRESS' }), true)
    expect(sent()[1].body.status).toBe('COMPLETED')
    expect(sent()[1].body.progress).toBe(100)
    expect(new Date(sent()[1].body.completedAt).getTime()).not.toBeNaN()
  })

  it('resends the whole task, because the API replaces it', async () => {
    await advanceTaskStatus(task({ status: 'TODO' }), true)
    expect(sent()[1].body).toMatchObject({
      projectId: 10,
      milestoneId: 3,
      title: 'Draft the homepage',
      priority: 'HIGH',
      startDate: '2026-10-01',
      dueDate: '2026-10-20',
      estimatedHours: 4,
      createdById: 1,
    })
  })
})

describe('taskResponseToRequest', () => {
  it('maps a response back to a request and applies overrides', () => {
    const request = taskResponseToRequest(task({ milestone: null, createdBy: null }), { title: 'New title' })
    expect(request.milestoneId).toBeNull()
    expect(request.createdById).toBeNull()
    expect(request.title).toBe('New title')
  })
})

describe('toggleTaskCompletion / setTaskStatus', () => {
  it('completes an open task and reopens a completed one', async () => {
    await toggleTaskCompletion(task({ status: 'IN_PROGRESS' }))
    expect(sent()[1].body.status).toBe('COMPLETED')
    expect(sent()[1].body.progress).toBe(100)

    await toggleTaskCompletion(task({ status: 'COMPLETED', progress: 100, completedAt: '2026-10-12T00:00:00Z' }))
    expect(sent()[1].body.status).toBe('TODO')
    expect(sent()[1].body.completedAt).toBeNull()
  })

  it('sets a chosen status', async () => {
    await setTaskStatus(task(), 'CANCELLED')
    expect(sent()[1].body.status).toBe('CANCELLED')
  })
})
