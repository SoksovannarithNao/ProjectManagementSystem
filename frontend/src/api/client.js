const STORAGE_KEY = 'taskflow.auth'

let unauthorizedHandler = null

// The short-lived access token lives only here, in memory. What survives a reload is who signed
// in (username and role, kept in localStorage) and the httpOnly refresh cookie the browser holds,
// which is traded for a new access token by refreshSession(). The token itself is never stored.
let accessToken = null

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

// { username, role, token }; after a reload the token is null until refreshSession() succeeds.
export function getStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const saved = raw ? JSON.parse(raw) : null
    return saved ? { ...saved, token: accessToken } : null
  } catch {
    return null
  }
}

export function storeAuth(auth) {
  accessToken = auth?.token ?? null
  try {
    if (auth) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ username: auth.username, role: auth.role }))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Storage unavailable (private browsing, etc.) — the session just won't survive a reload.
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

// Trades the refresh cookie for a new access token. Calls made at the same moment share one
// request. Resolves to { token, username, role }, or null when there is no live session (no
// cookie, expired, signed out elsewhere, account no longer active, server unreachable).
let refreshing = null

export function refreshSession() {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const response = await send('/api/auth/refresh', { method: 'POST' })
        if (!response.ok) return null
        const data = await response.json()
        storeAuth({ token: data.token, username: data.username, role: data.role })
        return data
      } catch {
        return null
      }
    })().finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

// Ends the session on the server (deletes the refresh token and clears the cookie). Best effort:
// the person is signed out in the browser whether or not this reaches the server.
export async function endSession() {
  try {
    await send('/api/auth/logout', { method: 'POST' })
  } catch {
    // unreachable server: nothing more to do
  }
}

// Sends a request that needs the access token. When the server answers 401 (the token ran out)
// it asks for a new one once and repeats the request; only a failed refresh means signed out.
// build() runs again for the retry so it picks up the new token.
async function sendAuthorized(url, build, skipAuth) {
  const response = await send(url, build())
  if (response.status === 401 && !skipAuth && (await refreshSession())) {
    return send(url, build())
  }
  return response
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

function authorizedInit(init, skipAuth) {
  const headers = { ...init.headers }
  if (!skipAuth && accessToken) headers.Authorization = `Bearer ${accessToken}`
  return { ...init, headers }
}

export async function apiFetch(path, { method = 'GET', body, skipAuth = false } = {}) {
  const build = () =>
    authorizedInit(
      {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      },
      skipAuth
    )

  const response = await sendAuthorized(`/api${path}`, build, skipAuth)

  return handleResponse(response, skipAuth)
}

// Fetches a file the API only serves to a signed-in user (an attachment): an
// <a href> cannot carry the Authorization header, so the bytes are fetched
// here and handed back as a Blob. Errors come back as the usual JSON body.
export async function apiDownload(path) {
  const response = await sendAuthorized(`/api${path}`, () => authorizedInit({}, false), false)
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
  const response = await sendAuthorized(`/api${path}`, () => authorizedInit({ method, body: formData }, false), false)

  return handleResponse(response, false)
}
