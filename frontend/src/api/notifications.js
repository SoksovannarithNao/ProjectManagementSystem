import { apiFetch } from './client'

export function getNotifications() {
  return apiFetch('/notifications')
}

export function getUnreadNotificationCount() {
  return apiFetch('/notifications/unread-count')
}

export function markNotificationRead(id) {
  return apiFetch(`/notifications/${id}/read`, { method: 'PUT' })
}

export function markAllNotificationsRead() {
  return apiFetch('/notifications/read-all', { method: 'POST' })
}
