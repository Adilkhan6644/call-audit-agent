const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

export function getToken() {
  return localStorage.getItem('access_token')
}

export function setToken(token) {
  if (token) localStorage.setItem('access_token', token)
  else localStorage.removeItem('access_token')
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

/**
 * Talks to `server/` only — never `ai-service/` directly, per the project's
 * frontend/backend boundary.
 */
export async function apiFetch(path, { method = 'GET', body, isFormData = false } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body && !isFormData) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    setToken(null)
    if (location.pathname !== '/login') location.href = '/login'
  }

  if (res.status === 204) return null

  const contentType = res.headers.get('content-type') || ''
  const payload = contentType.includes('application/json') ? await res.json() : await res.blob()

  if (!res.ok) throw new ApiError(res.status, payload)
  return payload
}

export async function downloadFile(path, filename) {
  const token = getToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null))
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
