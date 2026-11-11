import { apiFetch } from './client'

export const listInstructions = (categoryId) => apiFetch(`/audit-instructions?categoryId=${categoryId}`)

export const getActiveInstruction = (categoryId) =>
  apiFetch(`/audit-instructions/active?categoryId=${categoryId}`)

export const createInstruction = (categoryId, content) =>
  apiFetch('/audit-instructions', { method: 'POST', body: { categoryId, content } })
