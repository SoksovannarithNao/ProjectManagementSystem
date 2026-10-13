import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  getNotificationsPage,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../api/notifications'
import { useAuth } from '../auth/AuthContext'

const NotificationsContext = createContext(null)

// The bell shows the newest notifications first and loads more a page at a time, so a long
// history is never fetched all at once (the server caps a page at 200).
export const NOTIFICATIONS_PAGE_SIZE = 20
const MAX_SHOWN = 200

const EMPTY = { owner: null, items: [], total: 0, unreadCount: 0, loading: true, loadingMore: false }

export function NotificationsProvider({ children }) {
  const { isAuthenticated, username } = useAuth()
  // What is loaded belongs to whoever was signed in when it arrived (`owner`), so a person who
  // signs in after someone else never sees the previous list.
  const [state, setState] = useState(EMPTY)
  // How many the bell shows, always whole pages: a refresh after an action reloads that many.
  const shown = useRef(NOTIFICATIONS_PAGE_SIZE)

  // Loads the first `shown` notifications again, and the unread count from the server (it counts
  // the unread ones that are not loaded as well).
  const refetch = useCallback(() => {
    if (!isAuthenticated) return Promise.resolve()
    return Promise.all([
      getNotificationsPage(0, Math.min(shown.current, MAX_SHOWN)),
      getUnreadNotificationCount(),
    ])
      .then(([page, unread]) => {
        setState((prev) => ({
          ...prev,
          owner: username,
          items: page.items,
          total: page.total,
          unreadCount: unread.count,
          loading: false,
        }))
      })
      .catch(() => setState((prev) => ({ ...prev, owner: username, loading: false })))
  }, [isAuthenticated, username])

  useEffect(() => {
    shown.current = NOTIFICATIONS_PAGE_SIZE
    refetch()
  }, [refetch])

  const loadMore = useCallback(async () => {
    const owner = username
    setState((prev) => ({ ...prev, loadingMore: true }))
    try {
      const page = await getNotificationsPage(Math.floor(shown.current / NOTIFICATIONS_PAGE_SIZE), NOTIFICATIONS_PAGE_SIZE)
      shown.current = Math.min(shown.current + NOTIFICATIONS_PAGE_SIZE, MAX_SHOWN)
      setState((prev) => {
        if (prev.owner !== owner) return prev
        // A notification that arrived meanwhile pushes the older ones down a page: skip repeats.
        const known = new Set(prev.items.map((n) => n.id))
        return {
          ...prev,
          items: [...prev.items, ...page.items.filter((n) => !known.has(n.id))],
          total: page.total,
          loadingMore: false,
        }
      })
    } catch {
      setState((prev) => ({ ...prev, loadingMore: false }))
    }
  }, [username])

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

  const dismiss = useCallback(
    async (id) => {
      await deleteNotification(id)
      refetch()
    },
    [refetch]
  )

  const mine = isAuthenticated && state.owner === username
  const notifications = useMemo(() => (mine ? state.items : []), [mine, state.items])
  const total = mine ? state.total : 0
  const unreadCount = mine ? state.unreadCount : 0
  const loading = isAuthenticated ? !mine || state.loading : false
  const hasMore = notifications.length < total && notifications.length < MAX_SHOWN

  const value = useMemo(
    () => ({
      notifications,
      total,
      unreadCount,
      loading,
      hasMore,
      loadingMore: state.loadingMore,
      loadMore,
      refetch,
      markRead,
      markAllRead,
      dismiss,
    }),
    [notifications, total, unreadCount, loading, hasMore, state.loadingMore, loadMore, refetch, markRead, markAllRead, dismiss]
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- context + hook live together deliberately
export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
  return ctx
}
