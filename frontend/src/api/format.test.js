import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  blockedReason,
  colorForId,
  daysUntil,
  dueSoonLabel,
  formatDate,
  formatLongDate,
  humanizeEnum,
  initialsFor,
  taskDisplayTitle,
  timeAgo,
} from './format'

describe('taskDisplayTitle', () => {
  it('drops a trailing " — <project>" that the project group already shows', () => {
    expect(taskDisplayTitle('Kickoff — Website Redesign', 'Website Redesign')).toBe('Kickoff')
  })

  it('leaves other titles alone', () => {
    expect(taskDisplayTitle('Kickoff', 'Website Redesign')).toBe('Kickoff')
    expect(taskDisplayTitle('Kickoff — Other', 'Website Redesign')).toBe('Kickoff — Other')
    expect(taskDisplayTitle(null, 'Website Redesign')).toBe('')
    expect(taskDisplayTitle('Kickoff', undefined)).toBe('Kickoff')
  })
})

describe('blockedReason', () => {
  it('names what still has to be finished', () => {
    expect(blockedReason({ blockingTaskTitles: ['Design', 'Review'] })).toBe('Blocked by: Design, Review')
  })

  it('has a generic fallback', () => {
    expect(blockedReason({ blockingTaskTitles: [] })).toBe('Blocked by an incomplete dependency')
    expect(blockedReason(undefined)).toBe('Blocked by an incomplete dependency')
  })
})

describe('humanizeEnum', () => {
  it.each([
    ['TODO', 'To Do'],
    ['IN_PROGRESS', 'In Progress'],
    ['IN_REVIEW', 'In Review'],
    ['PROJECT_MANAGER', 'Project Manager'],
    ['LOW', 'Low'],
    ['', ''],
    [null, ''],
    [undefined, ''],
  ])('turns %j into %j', (value, text) => {
    expect(humanizeEnum(value)).toBe(text)
  })
})

describe('avatars', () => {
  it('derives the same colour for the same id, from the fixed palette', () => {
    expect(colorForId(42)).toBe(colorForId('42'))
    expect(colorForId(42)).toMatch(/^#[0-9A-F]{6}$/)
  })

  it.each([
    ['Chen Wu', 'CW'],
    ['Mia Anne Park', 'MP'],
    ['Cher', 'C'],
    ['  owen   lead  ', 'OL'],
    ['', '?'],
    [null, '?'],
  ])('writes the initials of %j as %j', (name, initials) => {
    expect(initialsFor(name)).toBe(initials)
  })
})

describe('dates', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 12, 12, 0, 0)) // Oct 12, 2026, local noon
  })
  afterEach(() => vi.useRealTimers())

  it('formats a date without or with its year', () => {
    expect(formatDate('2026-10-12T12:00:00')).toBe('Oct 12')
    expect(formatLongDate('2026-10-12T12:00:00')).toBe('Oct 12, 2026')
  })

  it('shows a dash for nothing or nonsense', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate('not a date')).toBe('—')
    expect(formatLongDate('')).toBe('—')
  })

  it('counts whole calendar days from today', () => {
    expect(daysUntil('2026-10-12')).toBe(0)
    expect(daysUntil('2026-10-13')).toBe(1)
    expect(daysUntil('2026-10-15')).toBe(3)
    expect(daysUntil('2026-10-09')).toBe(-3)
    expect(daysUntil('2026-10-12T23:59:59Z')).toBe(0)
    expect(daysUntil(null)).toBeNull()
    expect(daysUntil('soon')).toBeNull()
  })

  it('words the near-deadline flag', () => {
    expect(dueSoonLabel('2026-10-12')).toBe('Due today')
    expect(dueSoonLabel('2026-10-13')).toBe('Due tomorrow')
    expect(dueSoonLabel('2026-10-15')).toBe('Due in 3 days')
    expect(dueSoonLabel(undefined)).toBe('Due soon')
  })

  it('says how long ago something happened', () => {
    const ago = (ms) => new Date(Date.now() - ms).toISOString()
    expect(timeAgo(ago(20 * 1000))).toBe('Just now')
    expect(timeAgo(ago(5 * 60 * 1000))).toBe('5m ago')
    expect(timeAgo(ago(3 * 3600 * 1000))).toBe('3h ago')
    expect(timeAgo(ago(2 * 86400 * 1000))).toBe('2d ago')
    expect(timeAgo(ago(30 * 86400 * 1000))).toBe('Sep 12')
    expect(timeAgo(null)).toBe('')
  })
})
