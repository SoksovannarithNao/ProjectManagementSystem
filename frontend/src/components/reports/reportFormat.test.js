import { describe, expect, it } from 'vitest'
import { fullDate, hours, pct } from './reportFormat'

describe('report formatting', () => {
  it('writes dates with their year', () => {
    expect(fullDate('2026-10-12')).toBe('Oct 12, 2026')
    expect(fullDate('2026-01-05')).toBe('Jan 5, 2026')
  })

  it('shows a dash for a missing or invalid date', () => {
    expect(fullDate('')).toBe('—')
    expect(fullDate(null)).toBe('—')
    expect(fullDate('nope')).toBe('—')
  })

  it('writes a rate with one decimal, and a dash when there was nothing to divide by', () => {
    expect(pct(50)).toBe('50.0%')
    expect(pct(33.333)).toBe('33.3%')
    expect(pct(0)).toBe('0.0%')
    expect(pct(null)).toBe('—')
    expect(pct(undefined)).toBe('—')
  })

  it('writes hours without a trailing .0', () => {
    expect(hours(2)).toBe('2')
    expect(hours(1.5)).toBe('1.5')
    expect(hours(null)).toBe('0')
  })
})
