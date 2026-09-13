import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'

const ThemeContext = createContext(null)
const STORAGE_KEY = 'taskflow.theme'
const VALID_THEMES = ['LIGHT', 'DARK', 'SYSTEM']

function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'DARK') root.setAttribute('data-theme', 'dark')
  else if (theme === 'LIGHT') root.setAttribute('data-theme', 'light')
  else root.removeAttribute('data-theme')
}

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return VALID_THEMES.includes(stored) ? stored : 'SYSTEM'
  } catch {
    return 'SYSTEM'
  }
}

// Single source of truth for the app's light/dark/system appearance. Works
// before login (falls back to whatever was last stored locally) and syncs
// to the authenticated user's saved preference once their profile loads —
// so Settings only ever needs to call the preferences API + refreshProfile()
// and this picks the change up automatically, rather than every page that
// might change it also having to poke this context directly.
export function ThemeProvider({ children }) {
  const { profile } = useAuth()
  const [theme, setThemeState] = useState(readStoredTheme)
  // Tracks the last profile.themePreference this provider has already
  // adopted, so a genuine change (fresh login, or Settings -> refreshProfile)
  // is applied exactly once — adjusting state during render (React's
  // documented pattern for "sync state to a prop, but still allow local
  // overrides") rather than in an effect, which avoids a redundant extra
  // render and the react-hooks/set-state-in-effect lint rule.
  const [syncedProfileTheme, setSyncedProfileTheme] = useState(null)

  if (
    profile?.themePreference &&
    VALID_THEMES.includes(profile.themePreference) &&
    profile.themePreference !== syncedProfileTheme
  ) {
    setSyncedProfileTheme(profile.themePreference)
    setThemeState(profile.themePreference)
    try {
      localStorage.setItem(STORAGE_KEY, profile.themePreference)
    } catch {
      // Storage unavailable — theme still applies for this session, just won't persist.
    }
  }

  useLayoutEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback((next) => {
    if (!VALID_THEMES.includes(next)) return
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage unavailable — theme still applies for this session, just won't persist.
    }
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- context + hook live together deliberately
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
