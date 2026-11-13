const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

export function getToken() {
  return localStorage.getItem('access_token')
}

export function setToken(token) {
  if (token) localStorage.setItem('access_token', token)
  else localStorage.removeItem('access_token')
}

export function getRefreshToken() {
  return localStorage.getItem('refresh_token')
}

export function setRefreshToken(token) {
  if (token) localStorage.setItem('refresh_token', token)
  else localStorage.removeItem('refresh_token')
}

/** Thrown for any non-2xx response; carries the server's {code,message,...} envelope. */
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || 'Request failed')
    this.status = status
    this.code = body?.error?.code
    this.retryAfterSeconds = body?.error?.retryAfterSeconds
    this.suggestion = body?.error?.suggestion
  }
}

function forceLogout() {
  setToken(null)
  setRefreshToken(null)
  if (location.pathname !== '/login') location.href = '/login'
}

// The access token expires after 60 minutes; without this, every request
// after that would 401 and force a logout. Concurrent 401s share one
// in-flight refresh call since the server's refresh token is single-use
// (rotates on every call) — firing it twice would invalidate the first.
let refreshInFlight = null
async function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = getRefreshToken()
      if (!refreshToken) throw new Error('No refresh token')
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
      if (!res.ok) throw new Error('Refresh failed')
      const { access_token, refresh_token } = await res.json()
      setToken(access_token)
      setRefreshToken(refresh_token)
      return access_token
    })().finally(() => { refreshInFlight = null })
  }
  return refreshInFlight
}

async function doFetch(path, { method, body, isFormData, token }) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body && !isFormData) headers['Content-Type'] = 'application/json'
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  })
}

/**
 * Talks to `server/` only — never `ai-service/` directly, per the project's
 * frontend/backend boundary.
 */
export async function apiFetch(path, { method = 'GET', body, isFormData = false } = {}) {
  let res = await doFetch(path, { method, body, isFormData, token: getToken() })

  if (res.status === 401 && getRefreshToken() && path !== '/auth/refresh') {
    try {
      const newToken = await refreshAccessToken()
      res = await doFetch(path, { method, body, isFormData, token: newToken })
    } catch {
      forceLogout()
    }
  } else if (res.status === 401) {
    forceLogout()
  }

  if (res.status === 204) return null

  const contentType = res.headers.get('content-type') || ''
  const payload = contentType.includes('application/json') ? await res.json() : await res.blob()

  if (!res.ok) throw new ApiError(res.status, payload)
  return payload
}

export async function downloadFile(path, filename) {
  let res = await doFetch(path, { method: 'GET', token: getToken() })
  if (res.status === 401 && getRefreshToken()) {
    try {
      const newToken = await refreshAccessToken()
      res = await doFetch(path, { method: 'GET', token: newToken })
    } catch {
      forceLogout()
    }
  } else if (res.status === 401) {
    forceLogout()
  }
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null))
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
