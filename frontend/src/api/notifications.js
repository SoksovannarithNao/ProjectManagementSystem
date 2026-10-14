import { apiFetch } from './client'

// One page of the signed-in person's notifications, newest first: { items, total, page, size }.
export function getNotificationsPage(page, size) {
  return apiFetch(`/notifications?page=${page}&size=${size}`)
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

export function deleteNotification(id) {
  return apiFetch(`/notifications/${id}`, { method: 'DELETE' })
}
