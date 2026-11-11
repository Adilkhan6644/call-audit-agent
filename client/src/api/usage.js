import { apiFetch } from './client'

export const getUsage = (from, to) => {
  const query = new URLSearchParams()
  if (from) query.set('from', from)
  if (to) query.set('to', to)
  return apiFetch(`/usage?${query.toString()}`)
}
