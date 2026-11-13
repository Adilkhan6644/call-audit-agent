import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { apiFetch, setToken, setRefreshToken } from './client'

describe('apiFetch', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('attaches the bearer token when present', async () => {
    setToken('tok123')
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ ok: true }),
    })
    await apiFetch('/categories')
    const [, options] = fetch.mock.calls[0]
    expect(options.headers.Authorization).toBe('Bearer tok123')
  })

  it('omits the Authorization header when no token is stored', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ ok: true }),
    })
    await apiFetch('/categories')
    const [, options] = fetch.mock.calls[0]
    expect(options.headers.Authorization).toBeUndefined()
  })

  it('clears the stored token on a 401 response with no refresh token available', async () => {
    setToken('tok123')
    fetch.mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: { code: 'unauthorized', message: 'nope' } }),
    })
    await expect(apiFetch('/categories')).rejects.toThrow()
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('transparently refreshes an expired access token and retries the original request', async () => {
    setToken('expired-token')
    setRefreshToken('refresh-token')
    fetch
      .mockResolvedValueOnce({ ok: false, status: 401, headers: new Headers(), json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ access_token: 'new-token', refresh_token: 'new-refresh' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ items: [] }),
      })

    const result = await apiFetch('/categories')

    expect(result).toEqual({ items: [] })
    expect(localStorage.getItem('access_token')).toBe('new-token')
    expect(fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer new-token')
  })

  it('logs out when the refresh token itself is rejected', async () => {
    setToken('expired-token')
    setRefreshToken('dead-refresh-token')
    fetch.mockResolvedValue({ ok: false, status: 401, headers: new Headers(), json: async () => ({}) })

    await expect(apiFetch('/categories')).rejects.toThrow()
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })
})
