import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { login as loginRequest, googleLogin, googleRegister, verifyLoginCode } from '../api/auth'
import { getUserByUsername, getMyPermissions } from '../api/users'
import { endSession, getStoredAuth, refreshSession, setUnauthorizedHandler, storeAuth } from '../api/client'
import { EMPTY_PERMISSIONS, canAnywhere, canInProject, canSystem } from '../api/permissions'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(getStoredAuth)
  const [profile, setProfile] = useState(null)
  // What the user may do (GET /api/users/me/permissions). Loaded together with
  // the profile; the UI hides whatever it does not allow.
  const [permissions, setPermissions] = useState(EMPTY_PERMISSIONS)
  // Only start "loading" when someone was signed in before this page load — a fresh,
  // never-logged-in session has nothing to fetch, so no effect runs at all. The access token
  // lives in memory only, so after a reload it is first renewed from the refresh cookie (below).
  const [loading, setLoading] = useState(() => Boolean(getStoredAuth()?.username))

  const logout = useCallback(() => {
    // Ends the session on the server too (the refresh token is deleted); the browser is
    // signed out whether or not that reaches it.
    endSession()
    storeAuth(null)
    setAuth(null)
    setProfile(null)
    setPermissions(EMPTY_PERMISSIONS)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
  }, [logout])

  // After a reload: someone was signed in but the access token is gone, so trade the refresh
  // cookie for a new one. Without a live session the person goes back to the sign-in page.
  useEffect(() => {
    const saved = getStoredAuth()
    if (!saved?.username || saved.token) return undefined
    let cancelled = false
    refreshSession().then((result) => {
      if (cancelled) return
      if (result) {
        setAuth({ token: result.token, username: result.username, role: result.role })
      } else {
        logout()
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
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

  // Starts the session from { token, username, role } and loads the profile and permissions.
  const startSession = useCallback(async (result) => {
    const nextAuth = { token: result.token, username: result.username, role: result.role }
    storeAuth(nextAuth)
    setAuth(nextAuth)
    const [user, perms] = await Promise.all([getUserByUsername(result.username), getMyPermissions()])
    setProfile(user)
    setPermissions(perms)
    return user
  }, [])

  // Resolves to the signed-in user, or to { twoFactorRequired: true, username, maskedEmail } when an
  // administrator still has to enter the code e-mailed to them (then call loginWithCode).
  const finishSignIn = useCallback(
    async (result) => {
      if (result.twoFactorRequired) {
        return { twoFactorRequired: true, username: result.username, maskedEmail: result.maskedEmail }
      }
      if (result.signupRequired) {
        return { signupRequired: true, email: result.email, name: result.name }
      }
      return startSession(result)
    },
    [startSession]
  )

  const login = useCallback(async (username, password) => finishSignIn(await loginRequest(username, password)), [finishSignIn])

  // Same result as login, from the ID token Google gave the browser (an account connected to that Google
  // account beforehand; an administrator still gets the e-mailed-code step).
  const loginWithGoogle = useCallback(async (credential) => finishSignIn(await googleLogin(credential)), [finishSignIn])

  // A Google account connected to nobody: creates the account with the chosen username and signs in.
  const registerWithGoogle = useCallback(
    async (credential, username) => startSession(await googleRegister(credential, username)),
    [startSession]
  )

  const loginWithCode = useCallback(async (username, otp) => startSession(await verifyLoginCode(username, otp)), [startSession])

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
      loginWithGoogle,
      registerWithGoogle,
      loginWithCode,
      logout,
      refreshProfile,
    }),
    [auth, permissions, can, canSys, canAny, profile, loading, login, loginWithGoogle, registerWithGoogle, loginWithCode, logout, refreshProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- context + hook live together deliberately
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
