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

const NETWORK_ERROR_MESSAGE = 'Could not reach the server. Check your connection and try again.'
const UNEXPECTED_RESPONSE_MESSAGE = 'The server sent an unexpected response. Please try again.'

// fetch() rejects with the browser's own wording ("Failed to fetch",
// "NetworkError when attempting...") when the server cannot be reached.
async function send(url, init) {
  try {
    return await fetch(url, init)
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE)
  }
}

async function handleResponse(response, skipAuth) {
  if (response.status === 204) return null

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // Not JSON (e.g. an HTML error page from the proxy while the backend is down).
    if (response.ok) throw new ApiError(response.status, UNEXPECTED_RESPONSE_MESSAGE)
  }

  if (!response.ok) {
    if (response.status === 401 && !skipAuth) {
      storeAuth(null)
      unauthorizedHandler?.()
    }
    throw new ApiError(response.status, data?.message || response.statusText || UNEXPECTED_RESPONSE_MESSAGE, data?.fieldErrors)
  }

  return data
}

export async function apiFetch(path, { method = 'GET', body, skipAuth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (!skipAuth) {
    const auth = getStoredAuth()
    if (auth?.token) headers.Authorization = `Bearer ${auth.token}`
  }

  const response = await send(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  return handleResponse(response, skipAuth)
}

// Fetches a file the API only serves to a signed-in user (an attachment): an
// <a href> cannot carry the Authorization header, so the bytes are fetched
// here and handed back as a Blob. Errors come back as the usual JSON body.
export async function apiDownload(path) {
  const headers = {}
  const auth = getStoredAuth()
  if (auth?.token) headers.Authorization = `Bearer ${auth.token}`

  const response = await send(`/api${path}`, { headers })
  if (!response.ok) {
    if (response.status === 401) {
      storeAuth(null)
      unauthorizedHandler?.()
    }
    let message = response.statusText
    try {
      message = (await response.json())?.message || message
    } catch {
      // not JSON: keep the status text
    }
    throw new ApiError(response.status, message)
  }
  return response.blob()
}

// For multipart/form-data uploads (e.g. a profile photo) — no Content-Type
// header (the browser sets one with the correct multipart boundary itself
// once it sees a FormData body) and no JSON.stringify.
export async function apiUpload(path, formData, { method = 'PUT' } = {}) {
  const headers = {}
  const auth = getStoredAuth()
  if (auth?.token) headers.Authorization = `Bearer ${auth.token}`

  const response = await send(`/api${path}`, {
    method,
    headers,
    body: formData,
  })

  return handleResponse(response, false)
}
