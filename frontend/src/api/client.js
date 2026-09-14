const STORAGE_KEY = 'taskflow.auth'

let unauthorizedHandler = null

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

export function getStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function storeAuth(auth) {
  try {
    if (auth) localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable (private browsing, etc.) — auth just won't persist across reloads.
  }
}

export class ApiError extends Error {
  constructor(status, message, fieldErrors) {
    super(message)
    this.status = status
    this.fieldErrors = fieldErrors ?? null
  }
}

async function handleResponse(response, skipAuth) {
  if (response.status === 204) return null

  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    if (response.status === 401 && !skipAuth) {
      storeAuth(null)
      unauthorizedHandler?.()
    }
    throw new ApiError(response.status, data?.message || response.statusText, data?.fieldErrors)
  }

  return data
}

export async function apiFetch(path, { method = 'GET', body, skipAuth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (!skipAuth) {
    const auth = getStoredAuth()
    if (auth?.token) headers.Authorization = `Bearer ${auth.token}`
  }

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  return handleResponse(response, skipAuth)
}

// For multipart/form-data uploads (e.g. a profile photo) — no Content-Type
// header (the browser sets one with the correct multipart boundary itself
// once it sees a FormData body) and no JSON.stringify.
export async function apiUpload(path, formData, { method = 'PUT' } = {}) {
  const headers = {}
  const auth = getStoredAuth()
  if (auth?.token) headers.Authorization = `Bearer ${auth.token}`

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: formData,
  })

  return handleResponse(response, false)
}
