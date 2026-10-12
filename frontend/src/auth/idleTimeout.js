// Auto-logout (brief Part A "Security & Sessions", B6): after IDLE_LIMIT_MS without
// any activity the user is warned, and IDLE_WARNING_MS later signed out. The values
// are the prototype's choice (the brief leaves them undefined).
export const IDLE_LIMIT_MS = 15 * 60 * 1000
export const IDLE_WARNING_MS = 60 * 1000

// Set (in sessionStorage) when the app signed the user out for inactivity, so the
// login page can say why. Cleared as soon as the login page has shown it.
export const IDLE_SIGNED_OUT_KEY = 'taskflow.signedOutForInactivity'

// The last moment of activity in ANY open tab, so working in one tab keeps the
// others signed in (the token itself is shared between tabs through localStorage).
const LAST_ACTIVE_KEY = 'taskflow.lastActive'

export function readSharedActivity() {
  try {
    return Number(localStorage.getItem(LAST_ACTIVE_KEY)) || 0
  } catch {
    return 0
  }
}

export function writeSharedActivity(timestamp) {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(timestamp))
  } catch {
    // Storage unavailable: each tab then only counts its own activity.
  }
}

export function rememberIdleSignOut() {
  try {
    sessionStorage.setItem(IDLE_SIGNED_OUT_KEY, '1')
  } catch {
    // The login page just will not explain why.
  }
}

export function wasSignedOutForInactivity() {
  try {
    return sessionStorage.getItem(IDLE_SIGNED_OUT_KEY) === '1'
  } catch {
    return false
  }
}

export function clearIdleSignOutNotice() {
  try {
    sessionStorage.removeItem(IDLE_SIGNED_OUT_KEY)
  } catch {
    // nothing to clear
  }
}
