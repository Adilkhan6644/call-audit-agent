import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listCategories, createCategory, deleteCategory } from '../api/categories'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Categories() {
  const [categories, setCategories] = useState(null)
  const [error, setError] = useState(null)
  const [newName, setNewName] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)

  function refresh() {
    listCategories().then(setCategories).catch((err) => setError(err.message))
  }

  useEffect(refresh, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      await createCategory(newName.trim())
      setNewName('')
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete() {
    try {
      await deleteCategory(pendingDelete._id)
      setPendingDelete(null)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!categories) return <div className="loading-state">SCANNING CATEGORIES…</div>

  return (
    <div>
      <div className="label" style={{ marginBottom: 12 }}>CALL CATEGORIES</div>
      {error && <div className="error-state" style={{ marginBottom: 12 }}>{error}</div>}

      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          placeholder="new custom category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="submit">Add</button>
      </form>

      {categories.length === 0 ? (
        <div className="empty-state">No categories available.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {categories.map((cat) => (
            <div key={cat._id} className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Link to={`/categories/${cat._id}/instructions`}>
                {cat.isBuiltin && '🔒 '}
                {cat.name}
              </Link>
              {!cat.isBuiltin && (
                <button onClick={() => setPendingDelete(cat)} style={{ color: 'var(--danger)' }}>
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          message={`Delete category "${pendingDelete.name}"?`}
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
