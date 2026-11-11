import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { listCategories, createCategory, deleteCategory } from './categories'

function mockJson(body, status = 200) {
  return {
    ok: status < 400,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  }
}

describe('categories api', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
  afterEach(() => vi.unstubAllGlobals())

  it('lists categories via GET /categories', async () => {
    fetch.mockResolvedValue(mockJson([{ _id: '1', name: 'Sales' }]))
    const result = await listCategories()
    expect(fetch.mock.calls[0][0]).toContain('/categories')
    expect(result).toEqual([{ _id: '1', name: 'Sales' }])
  })

  it('creates a category with the given name', async () => {
    fetch.mockResolvedValue(mockJson({ _id: '2', name: 'Custom' }, 201))
    await createCategory('Custom')
    const [, options] = fetch.mock.calls[0]
    expect(JSON.parse(options.body)).toEqual({ name: 'Custom' })
  })

  it('deletes a category by id', async () => {
    fetch.mockResolvedValue({ ok: true, status: 204, headers: new Headers() })
    await deleteCategory('2')
    const [url, options] = fetch.mock.calls[0]
    expect(url).toContain('/categories/2')
    expect(options.method).toBe('DELETE')
  })
})
