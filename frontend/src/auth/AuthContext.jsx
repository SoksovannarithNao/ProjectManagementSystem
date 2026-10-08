import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { login as loginRequest } from '../api/auth'
import { getUserByUsername, getMyPermissions } from '../api/users'
import { getStoredAuth, setUnauthorizedHandler, storeAuth } from '../api/client'
import { EMPTY_PERMISSIONS, canAnywhere, canInProject, canSystem } from '../api/permissions'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(getStoredAuth)
  const [profile, setProfile] = useState(null)
  // What the user may do (GET /api/users/me/permissions). Loaded together with
  // the profile; the UI hides whatever it does not allow.
  const [permissions, setPermissions] = useState(EMPTY_PERMISSIONS)
  // Only start "loading" when there's a stored token to look up — a fresh,
  // never-logged-in session has nothing to fetch, so no effect runs at all.
  const [loading, setLoading] = useState(() => Boolean(getStoredAuth()?.token))

  const logout = useCallback(() => {
    storeAuth(null)
    setAuth(null)
    setProfile(null)
    setPermissions(EMPTY_PERMISSIONS)
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
    Promise.all([getUserByUsername(auth.username), getMyPermissions()])
      .then(([user, perms]) => {
        if (cancelled) return
        setProfile(user)
        setPermissions(perms)
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
    const [user, perms] = await Promise.all([getUserByUsername(result.username), getMyPermissions()])
    setProfile(user)
    setPermissions(perms)
    return user
  }, [])

  // Re-fetches the profile after a self-service edit (Settings page) so the
  // sidebar/topbar name and other cached fields update without a re-login.
  // Also re-reads the permissions, which an administrator may have changed.
  const refreshProfile = useCallback(async () => {
    if (!auth?.username) return
    const [user, perms] = await Promise.all([getUserByUsername(auth.username), getMyPermissions()])
    setProfile(user)
    setPermissions(perms)
  }, [auth])

  // Permission questions for the UI. Advisory only: the server checks again.
  //   can('TASK', 'CREATE', projectId)   inside one project
  //   canSys('PROJECT', 'CREATE')        not about one project
  //   canAny('TASK', 'CREATE')           in at least one of the user's projects
  const can = useCallback((resource, action, projectId) => canInProject(permissions, resource, action, projectId), [permissions])
  const canSys = useCallback((resource, action) => canSystem(permissions, resource, action), [permissions])
  const canAny = useCallback((resource, action) => canAnywhere(permissions, resource, action), [permissions])

  const value = useMemo(
    () => ({
      token: auth?.token ?? null,
      username: auth?.username ?? null,
      role: permissions.role ?? auth?.role ?? null,
      isAdministrator: permissions.administrator,
      permissions,
      can,
      canSys,
      canAny,
      profile,
      isAuthenticated: Boolean(auth?.token),
      loading,
      login,
      logout,
      refreshProfile,
    }),
    [auth, permissions, can, canSys, canAny, profile, loading, login, logout, refreshProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- context + hook live together deliberately
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
