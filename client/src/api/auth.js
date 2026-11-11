import { apiFetch } from './client'

export const register = (email, password) => apiFetch('/auth/register', { method: 'POST', body: { email, password } })

export const login = (email, password) => apiFetch('/auth/login', { method: 'POST', body: { email, password } })

export const getMe = () => apiFetch('/auth/me')
