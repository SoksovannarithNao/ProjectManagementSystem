import { describe, expect, it } from 'vitest'
import { calendarRange, monthGridStart, startOfWeek, toISODate } from './calendarRange'

// Local dates throughout (month is 0-based, like Date): 14 Oct 2026 is a Wednesday.
const wed = new Date(2026, 9, 14)

describe('calendarRange', () => {
  it('a day is just that day', () => {
    expect(calendarRange('Day', wed)).toEqual({ from: '2026-10-14', to: '2026-10-14' })
  })

  it('a week runs Monday to Sunday around the cursor', () => {
    expect(calendarRange('Week', wed)).toEqual({ from: '2026-10-12', to: '2026-10-18' })
    expect(calendarRange('Week', new Date(2026, 9, 18))).toEqual({ from: '2026-10-12', to: '2026-10-18' }) // a Sunday
    expect(calendarRange('Week', new Date(2026, 9, 12))).toEqual({ from: '2026-10-12', to: '2026-10-18' }) // a Monday
  })

  it('a month is the six-week grid, starting on the Monday on or before the 1st', () => {
    // 1 Oct 2026 is a Thursday: the grid starts Monday 28 Sep and ends 41 days later
    expect(calendarRange('Month', wed)).toEqual({ from: '2026-09-28', to: '2026-11-08' })
    // 1 Jun 2026 is a Monday: the grid starts that day
    expect(calendarRange('Month', new Date(2026, 5, 20))).toEqual({ from: '2026-06-01', to: '2026-07-12' })
  })

  it('crosses a year end and a leap day', () => {
    expect(calendarRange('Month', new Date(2026, 11, 5))).toEqual({ from: '2026-11-30', to: '2027-01-10' })
    expect(calendarRange('Week', new Date(2028, 1, 29))).toEqual({ from: '2028-02-28', to: '2028-03-05' })
  })

  it('the month range covers exactly 42 days', () => {
    const { from, to } = calendarRange('Month', wed)
    const days = (new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000 + 1
    expect(Math.round(days)).toBe(42)
  })
})

describe('the date helpers', () => {
  it('toISODate pads month and day', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('startOfWeek is Monday at midnight and does not change its argument', () => {
    const input = new Date(2026, 9, 14, 15, 30)
    const monday = startOfWeek(input)
    expect(toISODate(monday)).toBe('2026-10-12')
    expect(monday.getHours()).toBe(0)
    expect(input.getDate()).toBe(14)
  })

  it('monthGridStart is the Monday on or before the 1st', () => {
    expect(toISODate(monthGridStart(2026, 9))).toBe('2026-09-28')
    expect(toISODate(monthGridStart(2026, 5))).toBe('2026-06-01')
  })
})
