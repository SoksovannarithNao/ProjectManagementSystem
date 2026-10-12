import { describe, expect, it } from 'vitest'
import { describePasswordProblem, isPasswordComplex, passwordErrorMessage } from './validation'

describe('isPasswordComplex (mirrors the backend PasswordPolicy)', () => {
  it.each([['Passw0rd!'], ['DevPassword123!'], ['aA1!aaaa'], ['Ünïcode-Pass9']])('accepts %s', (password) => {
    expect(isPasswordComplex(password)).toBe(true)
  })

  it.each([
    ['Sh0rt!', 'too short'],
    ['alllowercase1!', 'no uppercase'],
    ['ALLUPPERCASE1!', 'no lowercase'],
    ['NoDigitsHere!', 'no digit'],
    ['NoSpecial123', 'no special character'],
    ['', 'empty'],
  ])('rejects %j (%s)', (password) => {
    expect(isPasswordComplex(password)).toBe(false)
  })

  it('treats a missing password as invalid', () => {
    expect(isPasswordComplex(undefined)).toBe(false)
    expect(isPasswordComplex(null)).toBe(false)
  })
})

describe('describePasswordProblem', () => {
  it('says nothing for a good password', () => {
    expect(describePasswordProblem('Passw0rd!')).toBe('')
  })

  it('names every rule that is missing', () => {
    const message = describePasswordProblem('abc')
    expect(message).toContain('8+ characters')
    expect(message).toContain('1 uppercase letter')
    expect(message).toContain('1 number')
    expect(message).toContain('1 special character')
    expect(message).not.toContain('1 lowercase letter')
  })

  it('treats a missing password as empty', () => {
    expect(describePasswordProblem(undefined)).toContain('8+ characters')
  })
})

describe('passwordErrorMessage', () => {
  it('prefers the password field message from the server', () => {
    const err = { message: 'One or more fields are invalid', fieldErrors: { email: 'bad', password: 'Too weak' } }
    expect(passwordErrorMessage(err, 'fallback')).toBe('Too weak')
  })

  it('also reads newPassword', () => {
    expect(passwordErrorMessage({ fieldErrors: { newPassword: 'Too weak' } }, 'fallback')).toBe('Too weak')
  })

  it('falls back to the first field message, then the error message, then the fallback', () => {
    expect(passwordErrorMessage({ fieldErrors: { email: 'Invalid email' } }, 'fallback')).toBe('Invalid email')
    expect(passwordErrorMessage({ message: 'Server said no', fieldErrors: {} }, 'fallback')).toBe('Server said no')
    expect(passwordErrorMessage({}, 'fallback')).toBe('fallback')
    expect(passwordErrorMessage(undefined, 'fallback')).toBe('fallback')
  })
})
