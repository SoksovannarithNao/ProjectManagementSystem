import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  IDLE_LIMIT_MS,
  IDLE_WARNING_MS,
  clearIdleSignOutNotice,
  readSharedActivity,
  rememberIdleSignOut,
  wasSignedOutForInactivity,
  writeSharedActivity,
} from './idleTimeout'

function memoryStorage() {
  const data = new Map()
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  }
}

const brokenStorage = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
  removeItem: () => {
    throw new Error('blocked')
  },
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('sessionStorage', memoryStorage())
})
afterEach(() => vi.unstubAllGlobals())

describe('auto-logout limits', () => {
  it('warn after 15 idle minutes and sign out a minute later', () => {
    expect(IDLE_LIMIT_MS).toBe(15 * 60 * 1000)
    expect(IDLE_WARNING_MS).toBe(60 * 1000)
  })
})

describe('activity shared between tabs', () => {
  it('stores and reads the last activity time', () => {
    expect(readSharedActivity()).toBe(0)
    writeSharedActivity(1_700_000_000_000)
    expect(readSharedActivity()).toBe(1_700_000_000_000)
  })

  it('ignores junk in storage', () => {
    localStorage.setItem('taskflow.lastActive', 'yesterday')
    expect(readSharedActivity()).toBe(0)
  })

  it('keeps working when storage is blocked', () => {
    vi.stubGlobal('localStorage', brokenStorage)
    expect(() => writeSharedActivity(5)).not.toThrow()
    expect(readSharedActivity()).toBe(0)
  })
})

describe('the "signed out for inactivity" notice', () => {
  it('is remembered until the login page clears it', () => {
    expect(wasSignedOutForInactivity()).toBe(false)
    rememberIdleSignOut()
    expect(wasSignedOutForInactivity()).toBe(true)
    clearIdleSignOutNotice()
    expect(wasSignedOutForInactivity()).toBe(false)
  })

  it('does nothing harmful when storage is blocked', () => {
    vi.stubGlobal('sessionStorage', brokenStorage)
    expect(() => rememberIdleSignOut()).not.toThrow()
    expect(wasSignedOutForInactivity()).toBe(false)
    expect(() => clearIdleSignOutNotice()).not.toThrow()
  })
})
