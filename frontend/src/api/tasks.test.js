import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', () => ({ apiFetch: vi.fn(() => Promise.resolve({})) }))

import { apiFetch } from './client'
import { advanceTaskStatus, canAdvanceStatus, checkTaskMove, moveTaskToStatus, setTaskStatus, taskResponseToRequest, toggleTaskCompletion } from './tasks'

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

describe('checkTaskMove (Kanban drag and the Move to menu)', () => {
  const may = { canChange: true, canApprove: false }
  const approver = { canChange: true, canApprove: true }

  it('lets someone who may change the task move it between the open columns', () => {
    expect(checkTaskMove(task({ status: 'TODO' }), 'IN_PROGRESS', may)).toEqual({ ok: true })
    expect(checkTaskMove(task({ status: 'IN_PROGRESS' }), 'IN_REVIEW', may)).toEqual({ ok: true })
    expect(checkTaskMove(task({ status: 'IN_REVIEW' }), 'TODO', may)).toEqual({ ok: true })
  })

  it('does nothing when the task is already in that column', () => {
    expect(checkTaskMove(task({ status: 'IN_PROGRESS' }), 'IN_PROGRESS', may)).toEqual({ ok: false, message: '' })
  })

  it('refuses someone who may not change the task, with a reason', () => {
    const result = checkTaskMove(task(), 'IN_PROGRESS', { canChange: false, canApprove: false })
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/cannot change the status/)
  })

  it('leaves Completed to an approver, and points everyone else to In Review', () => {
    const open = task({ status: 'IN_PROGRESS' })
    expect(checkTaskMove(open, 'COMPLETED', approver)).toEqual({ ok: true })
    const refused = checkTaskMove(open, 'COMPLETED', may)
    expect(refused.ok).toBe(false)
    expect(refused.message).toMatch(/Only an approver.*In Review/)
  })

  it('refuses Completed while a subtask is open', () => {
    const result = checkTaskMove(task({ status: 'IN_PROGRESS', totalSubtasks: 3, completedSubtasks: 2 }), 'COMPLETED', approver)
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/Complete all subtasks/)
    expect(checkTaskMove(task({ status: 'IN_PROGRESS', totalSubtasks: 3, completedSubtasks: 3 }), 'COMPLETED', approver).ok).toBe(true)
  })

  it('keeps a blocked task in To Do and says what blocks it', () => {
    const blocked = task({ status: 'TODO', blocked: true, blockingTaskTitles: ['Design', 'Copy'] })
    const result = checkTaskMove(blocked, 'IN_PROGRESS', approver)
    expect(result).toEqual({ ok: false, message: 'Blocked by: Design, Copy' })
    expect(checkTaskMove(blocked, 'TODO', approver).message).toBe('')
  })

  it('never offers the Blocked column as a place to drop', () => {
    const result = checkTaskMove(task({ status: 'TODO' }), 'BLOCKED', approver)
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/Blocked is not a status/)
  })
})

describe('checkTaskMove: the order of the stages', () => {
  const approver = { canChange: true, canApprove: true }

  it('starts a task in In Progress: no jump from To Do to review or Completed', () => {
    for (const target of ['IN_REVIEW', 'COMPLETED']) {
      const result = checkTaskMove(task({ status: 'TODO' }), target, approver)
      expect(result.ok).toBe(false)
      expect(result.message).toMatch(/starts in In Progress/)
    }
    expect(checkTaskMove(task({ status: 'TODO' }), 'IN_PROGRESS', approver).ok).toBe(true)
  })

  it('goes on from In Progress to review, or to Completed for an approver, as the circle does', () => {
    expect(checkTaskMove(task({ status: 'IN_PROGRESS' }), 'IN_REVIEW', approver).ok).toBe(true)
    expect(checkTaskMove(task({ status: 'IN_PROGRESS' }), 'COMPLETED', approver).ok).toBe(true)
    expect(checkTaskMove(task({ status: 'IN_REVIEW' }), 'COMPLETED', approver).ok).toBe(true)
  })

  it('lets a task be taken back one stage or more on purpose', () => {
    expect(checkTaskMove(task({ status: 'IN_REVIEW' }), 'IN_PROGRESS', approver).ok).toBe(true)
    expect(checkTaskMove(task({ status: 'IN_REVIEW' }), 'TODO', approver).ok).toBe(true)
    expect(checkTaskMove(task({ status: 'COMPLETED' }), 'IN_PROGRESS', approver).ok).toBe(true)
    expect(checkTaskMove(task({ status: 'COMPLETED' }), 'TODO', approver).ok).toBe(true)
  })
})

describe('moveTaskToStatus (reads the task again before saving)', () => {
  const approver = () => ({ canChange: true, canApprove: true })

  it('saves the fresh copy, not the board copy, so a newer edit is not overwritten', async () => {
    const onBoard = task({ status: 'TODO', title: 'Old title' })
    apiFetch.mockResolvedValueOnce(task({ status: 'TODO', title: 'Edited by someone else', description: 'new text' }))
    apiFetch.mockResolvedValueOnce({ id: 5, status: 'IN_PROGRESS' })

    const result = await moveTaskToStatus(onBoard, 'IN_PROGRESS', approver)

    expect(result.moved).toBe(true)
    expect(apiFetch.mock.calls[0]).toEqual(['/tasks/5'])
    expect(apiFetch.mock.calls[1][0]).toBe('/tasks/5')
    expect(apiFetch.mock.calls[1][1].method).toBe('PUT')
    expect(apiFetch.mock.calls[1][1].body).toMatchObject({ title: 'Edited by someone else', description: 'new text', status: 'IN_PROGRESS' })
  })

  it('does not move a task someone else has already moved, and says so', async () => {
    apiFetch.mockResolvedValueOnce(task({ status: 'IN_PROGRESS' }))

    const result = await moveTaskToStatus(task({ status: 'TODO' }), 'IN_PROGRESS', approver)

    expect(result).toMatchObject({ moved: false, stale: true })
    expect(result.message).toMatch(/changed by someone else/)
    expect(apiFetch).toHaveBeenCalledTimes(1) // only the read: nothing was saved
  })

  it('checks the rules against the fresh task: a prerequisite that has been reopened blocks it', async () => {
    apiFetch.mockResolvedValueOnce(task({ status: 'TODO', blocked: true, blockingTaskTitles: ['Design'] }))

    const result = await moveTaskToStatus(task({ status: 'TODO' }), 'IN_PROGRESS', approver)

    expect(result).toEqual({ moved: false, stale: false, message: 'Blocked by: Design' })
    expect(apiFetch).toHaveBeenCalledTimes(1)
  })

  it('checks the approver rights against the fresh task too', async () => {
    const fresh = task({ status: 'IN_PROGRESS', approver: { id: 99 } })
    apiFetch.mockResolvedValueOnce(fresh)
    const abilitiesFor = vi.fn(() => ({ canChange: true, canApprove: false }))

    const result = await moveTaskToStatus(task({ status: 'IN_PROGRESS' }), 'COMPLETED', abilitiesFor)

    expect(abilitiesFor).toHaveBeenCalledWith(fresh)
    expect(result.moved).toBe(false)
    expect(result.message).toMatch(/Only an approver/)
  })
})
