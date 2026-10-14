import { describe, expect, it } from 'vitest'
import { formatClock, formatHours, localDateString, parseDuration } from './duration'

describe('parseDuration', () => {
  it.each([
    ['4', 4],
    ['1.5', 1.5],
    ['1,5', 1.5],
    ['90m', 1.5],
    ['45 min', 0.75],
    ['2h 30m', 2.5],
    ['1h30', 1.5],
    ['1:30', 1.5],
    ['2d', 16],
    ['1d 4h', 12],
    ['  3H  ', 3],
  ])('reads %j as %d hours', (text, hours) => {
    expect(parseDuration(text)).toBe(hours)
  })

  it('rounds to two decimals', () => {
    expect(parseDuration('20m')).toBe(0.33)
  })

  it.each([[''], ['   '], [null], [undefined]])('has no answer for empty text (%j)', (text) => {
    expect(parseDuration(text)).toBeNull()
  })

  it.each([['abc'], ['2 apples'], ['1h banana'], ['1:75'], ['h'], ['-3']])('rejects %j instead of guessing', (text) => {
    expect(parseDuration(text)).toBeNull()
  })
})

describe('formatHours', () => {
  it.each([
    [0.5, '30m'],
    [1.5, '1h 30m'],
    [4, '4h'],
    [0, '0h'],
    [13, '13h'],
    [0.25, '15m'],
  ])('writes %d hours as %s', (hours, text) => {
    expect(formatHours(hours)).toBe(text)
  })

  it('shows a dash when there is nothing to show', () => {
    expect(formatHours(null)).toBe('—')
    expect(formatHours(undefined)).toBe('—')
    expect(formatHours(Number.NaN)).toBe('—')
  })
})

describe('formatClock', () => {
  it('shows a running timer as h:mm:ss', () => {
    expect(formatClock(309000)).toBe('0:05:09')
    expect(formatClock(3723000)).toBe('1:02:03')
  })

  it('never goes negative', () => {
    expect(formatClock(-5000)).toBe('0:00:00')
  })
})

describe('localDateString', () => {
  it('uses the local calendar date, zero-padded', () => {
    expect(localDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(localDateString(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31')
  })
})
