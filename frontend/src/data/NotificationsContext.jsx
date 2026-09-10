import { createContext, useCallback, useContext, useMemo } from 'react'
import { useApi } from '../api/useApi'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api/notifications'
import { useAuth } from '../auth/AuthContext'

const NotificationsContext = createContext(null)

export function NotificationsProvider({ children }) {
  const { isAuthenticated } = useAuth()
  // Same isAuthenticated guard as UsersProvider — avoids a 401 on the login
  // page and refetches once a login succeeds.
  const fetcher = useCallback(
    () => (isAuthenticated ? getNotifications() : Promise.resolve([])),
    [isAuthenticated]
  )
  const { data, loading, refetch } = useApi(fetcher)

  const notifications = useMemo(() => data ?? [], [data])
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])

  const markRead = useCallback(
    async (id) => {
      await markNotificationRead(id)
      refetch()
    },
    [refetch]
  )

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead()
    refetch()
  }, [refetch])

  const value = useMemo(
    () => ({ notifications, unreadCount, loading, refetch, markRead, markAllRead }),
    [notifications, unreadCount, loading, refetch, markRead, markAllRead]
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- context + hook live together deliberately
export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
  return ctx
}
