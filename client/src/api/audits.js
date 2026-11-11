import { apiFetch } from './client'

export const runAudit = (categoryId, recordingId) =>
  apiFetch('/audits', { method: 'POST', body: { categoryId, recordingId } })

export const getAudit = (id) => apiFetch(`/audits/${id}`)

export const listAudits = (params = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v))
  return apiFetch(`/audits?${query.toString()}`)
}
