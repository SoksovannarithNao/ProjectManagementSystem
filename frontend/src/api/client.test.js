import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiDownload, apiFetch, getStoredAuth, setUnauthorizedHandler, storeAuth } from './client'

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

  it('signs the user out on a 401, but not for login itself', async () => {
    storeAuth({ token: 'old' })
    fetchMock.mockResolvedValue(reply(401, { message: 'expired' }))

    await expect(apiFetch('/tasks')).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(getStoredAuth()).toBeNull()

    storeAuth({ token: 'new' })
    await expect(apiFetch('/auth/login', { method: 'POST', body: {}, skipAuth: true })).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(getStoredAuth()).not.toBeNull()
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
