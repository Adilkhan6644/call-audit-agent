import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { listInstructions, getActiveInstruction, createInstruction } from '../api/instructions'
import AuditTrailList from '../components/AuditTrailList'

export default function Instructions() {
  const { id: categoryId } = useParams()
  const [versions, setVersions] = useState(null)
  const [active, setActive] = useState(null)
  const [content, setContent] = useState('')
  const [error, setError] = useState(null)
  const [publishing, setPublishing] = useState(false)

  function refresh() {
    listInstructions(categoryId).then(setVersions).catch((err) => setError(err.message))
    getActiveInstruction(categoryId)
      .then(setActive)
      .catch(() => setActive(null))
  }

  useEffect(refresh, [categoryId])

  async function handlePublish(e) {
    e.preventDefault()
    if (!content.trim()) return
    setPublishing(true)
    setError(null)
    try {
      await createInstruction(categoryId, content.trim())
      setContent('')
      refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setPublishing(false)
    }
  }

  if (!versions) return <div className="loading-state">LOADING AUDIT TRAIL…</div>

  return (
    <div>
      <Link to="/categories">&larr; Categories</Link>
      <div className="label" style={{ margin: '16px 0 8px' }}>INSTRUCTION AUDIT TRAIL</div>
      {error && <div className="error-state" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="label" style={{ marginBottom: 8 }}>CURRENTLY ACTIVE</div>
        {active ? (
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{active.content}</pre>
        ) : (
          <span className="empty-state">No active instruction yet — publish one below.</span>
        )}
      </div>

      <form onSubmit={handlePublish} className="panel" style={{ marginBottom: 16 }}>
        <div className="label" style={{ marginBottom: 8 }}>PUBLISH NEW VERSION</div>
        <textarea
          rows={6}
          style={{ width: '100%', resize: 'vertical' }}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Grading criteria for this category…"
        />
        <div style={{ marginTop: 8 }}>
          <button type="submit" disabled={publishing}>
            {publishing ? 'Publishing…' : 'Publish New Version'}
          </button>
        </div>
      </form>

      <div className="label" style={{ marginBottom: 8 }}>VERSION HISTORY</div>
      <AuditTrailList
        entries={versions}
        activeId={active?._id}
        renderLabel={(v) => `v${v.version} — ${new Date(v.createdAt).toLocaleString()}`}
      />
    </div>
  )
}
