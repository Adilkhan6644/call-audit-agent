import { useEffect, useState } from 'react'
import { getUsage } from '../api/usage'

function isoDaysAgo(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export default function Usage() {
  const [from, setFrom] = useState(isoDaysAgo(30))
  const [to, setTo] = useState(isoDaysAgo(0))
  const [usage, setUsage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getUsage(from, to).then(setUsage).catch((err) => setError(err.message))
  }, [from, to])

  return (
    <div>
      <div className="label" style={{ marginBottom: 12 }}>USAGE</div>
      {error && <div className="error-state" style={{ marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <div className="panel">
        <div className="label">Total audits run ({from} to {to})</div>
        <div style={{ fontSize: 40, fontWeight: 700 }}>{usage ? usage.total : '—'}</div>
      </div>
    </div>
  )
}
