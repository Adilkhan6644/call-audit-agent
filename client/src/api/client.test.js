import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { apiFetch, setToken } from './client'

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

  it('clears the stored token on a 401 response', async () => {
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
})
