import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  apiDownload,
  apiFetch,
  endSession,
  getStoredAuth,
  refreshSession,
  setUnauthorizedHandler,
  storeAuth,
} from './client'

// A tiny in-memory localStorage; the module reads and writes the saved login through it.
function memoryStorage() {
  const data = new Map()
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  }
}

const reply = (status, body, { json = true } = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  statusText: `status ${status}`,
  text: () => Promise.resolve(body === undefined ? '' : json ? JSON.stringify(body) : body),
  json: () => Promise.resolve(body),
  blob: () => Promise.resolve(new Blob(['bytes'])),
})

let fetchMock
let onUnauthorized

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  onUnauthorized = vi.fn()
  setUnauthorizedHandler(onUnauthorized)
})
afterEach(() => vi.unstubAllGlobals())

describe('the saved login', () => {
  it('round-trips through storage and clears', () => {
    storeAuth({ token: 'abc', username: 'dev.chen' })
    expect(getStoredAuth()).toEqual({ token: 'abc', username: 'dev.chen' })
    storeAuth(null)
    expect(getStoredAuth()).toBeNull()
  })

  it('never writes the access token to storage: only who signed in', () => {
    storeAuth({ token: 'secret-token', username: 'dev.chen', role: 'USER' })

    const saved = localStorage.getItem('taskflow.auth')
    expect(saved).not.toContain('secret-token')
    expect(JSON.parse(saved)).toEqual({ username: 'dev.chen', role: 'USER' })
  })

  it('has no token after a reload until the session is renewed', () => {
    localStorage.setItem('taskflow.auth', JSON.stringify({ username: 'dev.chen', role: 'USER' }))
    storeAuth(null) // the in-memory token of an earlier test is gone
    localStorage.setItem('taskflow.auth', JSON.stringify({ username: 'dev.chen', role: 'USER' }))

    expect(getStoredAuth()).toEqual({ username: 'dev.chen', role: 'USER', token: null })
  })

  it('treats corrupt storage as signed out', () => {
    localStorage.setItem('taskflow.auth', '{not json')
    expect(getStoredAuth()).toBeNull()
  })
})

describe('apiFetch', () => {
  it('sends JSON to /api with the bearer token', async () => {
    storeAuth({ token: 'abc' })
    fetchMock.mockResolvedValue(reply(200, { id: 1 }))

    const data = await apiFetch('/projects', { method: 'POST', body: { name: 'X' } })

    expect(data).toEqual({ id: 1 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/projects')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer abc')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe('{"name":"X"}')
  })

  it('leaves the token off when asked (login, register)', async () => {
    storeAuth({ token: 'abc' })
    fetchMock.mockResolvedValue(reply(200, {}))
    await apiFetch('/auth/login', { method: 'POST', body: {}, skipAuth: true })
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })

  it('returns null for 204 No Content', async () => {
    fetchMock.mockResolvedValue(reply(204))
    expect(await apiFetch('/tasks/1', { method: 'DELETE' })).toBeNull()
  })

  it('turns an error reply into an ApiError carrying the server message and field errors', async () => {
    fetchMock.mockResolvedValue(reply(400, { message: 'One or more fields are invalid', fieldErrors: { name: 'required' } }))

    const error = await apiFetch('/projects', { method: 'POST', body: {} }).catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(400)
    expect(error.message).toBe('One or more fields are invalid')
    expect(error.fieldErrors).toEqual({ name: 'required' })
  })

  it('signs the user out on a 401 that a refresh cannot fix, but not for login itself', async () => {
    storeAuth({ token: 'old' })
    fetchMock.mockResolvedValue(reply(401, { message: 'expired' }))

    await expect(apiFetch('/tasks')).rejects.toMatchObject({ status: 401 })
    // the request, then the refresh that was refused
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/tasks', '/api/auth/refresh'])
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(getStoredAuth()).toBeNull()

    storeAuth({ token: 'new' })
    await expect(apiFetch('/auth/login', { method: 'POST', body: {}, skipAuth: true })).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(getStoredAuth()).not.toBeNull()
  })

  it('renews the access token once on a 401 and repeats the request with the new one', async () => {
    storeAuth({ token: 'old', username: 'dev.chen' })
    fetchMock
      .mockResolvedValueOnce(reply(401, { message: 'expired' }))
      .mockResolvedValueOnce(reply(200, { token: 'fresh', username: 'dev.chen', role: 'USER' }))
      .mockResolvedValueOnce(reply(200, [{ id: 1 }]))

    const data = await apiFetch('/tasks')

    expect(data).toEqual([{ id: 1 }])
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/tasks', '/api/auth/refresh', '/api/tasks'])
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer old')
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer fresh')
    expect(fetchMock.mock.calls[1][1]).toEqual({ method: 'POST' }) // the cookie is the only credential
    expect(onUnauthorized).not.toHaveBeenCalled()
    expect(getStoredAuth()).toMatchObject({ token: 'fresh', username: 'dev.chen' })
  })

  it('shares one refresh between requests that run out of token together', async () => {
    storeAuth({ token: 'old' })
    let refreshes = 0
    fetchMock.mockImplementation((url, init) => {
      if (url === '/api/auth/refresh') {
        refreshes += 1
        return Promise.resolve(reply(200, { token: 'fresh', username: 'dev.chen', role: 'USER' }))
      }
      return Promise.resolve(init.headers.Authorization === 'Bearer fresh' ? reply(200, { ok: true }) : reply(401, {}))
    })

    const results = await Promise.all([apiFetch('/a'), apiFetch('/b'), apiFetch('/c')])

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }])
    expect(refreshes).toBe(1)
  })

  it('says so in plain words when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await apiFetch('/tasks').catch((e) => e)
    expect(error.status).toBe(0)
    expect(error.message).toMatch(/Could not reach the server/)
    expect(error.message).not.toMatch(/Failed to fetch/)
  })

  it('explains a reply that is not JSON, such as a proxy error page', async () => {
    fetchMock.mockResolvedValue(reply(200, '<html>502</html>', { json: false }))
    const error = await apiFetch('/tasks').catch((e) => e)
    expect(error.message).toMatch(/unexpected response/)

    fetchMock.mockResolvedValue(reply(502, '<html>Bad gateway</html>', { json: false }))
    const failure = await apiFetch('/tasks').catch((e) => e)
    expect(failure.status).toBe(502)
    expect(failure.message).toBe('status 502')
  })
})

describe('the session', () => {
  it('refreshSession keeps the new token in memory and reports no session when refused or unreachable', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { token: 'fresh', username: 'dev.chen', role: 'USER' }))
    expect(await refreshSession()).toEqual({ token: 'fresh', username: 'dev.chen', role: 'USER' })
    expect(getStoredAuth().token).toBe('fresh')
    expect(localStorage.getItem('taskflow.auth')).not.toContain('fresh')

    fetchMock.mockResolvedValueOnce(reply(401, { message: 'Session expired' }))
    expect(await refreshSession()).toBeNull()

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await refreshSession()).toBeNull()
  })

  it('endSession asks the server to end the session and never throws', async () => {
    fetchMock.mockResolvedValueOnce(reply(204))
    await endSession()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/logout')
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(endSession()).resolves.toBeUndefined()
  })
})

describe('apiDownload', () => {
  it('returns the bytes as a Blob, sending the token', async () => {
    storeAuth({ token: 'abc' })
    fetchMock.mockResolvedValue(reply(200, undefined))
    const blob = await apiDownload('/attachments/9/download')
    expect(blob).toBeInstanceOf(Blob)
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer abc')
  })

  it('reports the server message on failure and signs out on a 401', async () => {
    fetchMock.mockResolvedValue(reply(404, { message: 'Attachment not found' }))
    await expect(apiDownload('/attachments/9/download')).rejects.toMatchObject({ status: 404, message: 'Attachment not found' })

    fetchMock.mockResolvedValue(reply(401, { message: 'expired' }))
    await expect(apiDownload('/attachments/9/download')).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })
})
