import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAudits } from '../api/audits'
import { listCategories } from '../api/categories'
import { downloadFile } from '../api/client'
import StatusChip from '../components/StatusChip'
import ScoreBadge from '../components/ScoreBadge'

export default function AuditHistory() {
  const [categories, setCategories] = useState([])
  const [status, setStatus] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    listCategories().then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    listAudits({ status, categoryId, page, pageSize: 20 })
      .then(setData)
      .catch((err) => setError(err.message))
  }, [status, categoryId, page])

  const categoryName = (id) => categories.find((c) => c._id === id)?.name || id

  if (!data) return <div className="loading-state">LOADING AUDIT HISTORY…</div>

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))

  return (
    <div>
      <div className="label" style={{ marginBottom: 12 }}>AUDIT HISTORY</div>
      {error && <div className="error-state" style={{ marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1) }}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={() => downloadFile('/audits/export.csv', 'audits.csv')}>Export CSV</button>
        <button onClick={() => downloadFile('/audits/export.pdf', 'audits.pdf')}>Export PDF</button>
      </div>

      {data.items.length === 0 ? (
        <div className="empty-state">No audits recorded. Upload a call and run your first scan.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.items.map((job) => (
            <Link key={job._id} to={`/audits/${job._id}`} className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none' }}>
              <div>
                <div>{categoryName(job.categoryId)}</div>
                <div className="label">{new Date(job.createdAt).toLocaleString()}</div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {job.result && <ScoreBadge score={job.result.score} />}
                <StatusChip status={job.status} />
              </div>
            </Link>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
        <span className="label">Page {data.page} of {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </div>
  )
}
