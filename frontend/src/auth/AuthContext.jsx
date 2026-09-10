import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { login as loginRequest } from '../api/auth'
import { getUserByUsername } from '../api/users'
import { getStoredAuth, setUnauthorizedHandler, storeAuth } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(getStoredAuth)
  const [profile, setProfile] = useState(null)
  // Only start "loading" when there's a stored token to look up — a fresh,
  // never-logged-in session has nothing to fetch, so no effect runs at all.
  const [loading, setLoading] = useState(() => Boolean(getStoredAuth()?.token))

  const logout = useCallback(() => {
    storeAuth(null)
    setAuth(null)
    setProfile(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
  }, [logout])

  const syncProfile = useCallback(() => {
    // No setState here when there's no token — `loading` is already `false`
    // in that case (see its initializer), so nothing needs resetting
    // (avoids react-hooks/set-state-in-effect on a synchronous call).
    if (!auth?.token) return undefined
    let cancelled = false
    getUserByUsername(auth.username)
      .then((user) => {
        if (cancelled) return
        setProfile(user)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        logout()
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [auth, logout])

  useEffect(() => syncProfile(), [syncProfile])

  const login = useCallback(async (username, password) => {
    const result = await loginRequest(username, password)
    const nextAuth = { token: result.token, username: result.username, role: result.role }
    storeAuth(nextAuth)
    setAuth(nextAuth)
    const user = await getUserByUsername(result.username)
    setProfile(user)
    return user
  }, [])

  // Re-fetches the profile after a self-service edit (Settings page) so the
  // sidebar/topbar name and other cached fields update without a re-login.
  const refreshProfile = useCallback(async () => {
    if (!auth?.username) return
    const user = await getUserByUsername(auth.username)
    setProfile(user)
  }, [auth])

  const value = {
    token: auth?.token ?? null,
    username: auth?.username ?? null,
    role: auth?.role ?? null,
    profile,
    isAuthenticated: Boolean(auth?.token),
    loading,
    login,
    logout,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- context + hook live together deliberately
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
