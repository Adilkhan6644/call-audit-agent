import { apiFetch } from './client'

export const listCategories = () => apiFetch('/categories')

export const createCategory = (name) => apiFetch('/categories', { method: 'POST', body: { name } })

export const deleteCategory = (id) => apiFetch(`/categories/${id}`, { method: 'DELETE' })
