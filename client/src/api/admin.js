import { apiFetch } from './client'

export const listApiKeys = () => apiFetch('/admin/api-keys')
export const rotateApiKey = (provider, value) =>
  apiFetch(`/admin/api-keys/${provider}`, { method: 'PUT', body: { value } })

export const listAlerts = (resolved = false) => apiFetch(`/admin/alerts?resolved=${resolved}`)
export const resolveAlert = (id) => apiFetch(`/admin/alerts/${id}/resolve`, { method: 'PATCH' })
