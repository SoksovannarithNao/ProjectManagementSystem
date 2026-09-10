import { createContext, useCallback, useContext, useMemo } from 'react'
import { useApi } from '../api/useApi'
import { getUsers } from '../api/users'
import { colorForId, initialsFor } from '../api/format'
import { useAuth } from '../auth/AuthContext'

const UsersContext = createContext(null)

export function UsersProvider({ children }) {
  const { isAuthenticated } = useAuth()
  // Guarded on isAuthenticated so this doesn't fire (and fail with 401) on
  // the login page, and refetches once a login succeeds.
  const fetcher = useCallback(
    () => (isAuthenticated ? getUsers() : Promise.resolve([])),
    [isAuthenticated]
  )
  const { data, loading, error, refetch } = useApi(fetcher)

  const value = useMemo(() => {
    const members = (data ?? []).map((u) => ({
      id: u.id,
      name: u.fullName,
      initials: initialsFor(u.fullName),
      color: colorForId(u.id),
      role: u.role,
      email: u.email,
    }))
    const byId = new Map(members.map((m) => [String(m.id), m]))
    return {
      members,
      loading,
      error,
      refetch,
      getMember: (id) => (id == null ? undefined : byId.get(String(id))),
    }
  }, [data, loading, error, refetch])

  return <UsersContext.Provider value={value}>{children}</UsersContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- context + hook live together deliberately
export function useMembers() {
  const ctx = useContext(UsersContext)
  if (!ctx) throw new Error('useMembers must be used within UsersProvider')
  return ctx
}
