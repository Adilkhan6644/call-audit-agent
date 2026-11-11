import { useEffect, useState } from 'react'
import heroImage from '../assets/ai-dashboard-cover.jpg'
import { listCategories } from '../api/categories'
import { listAudits } from '../api/audits'
import { getUsage } from '../api/usage'
import CategoryAuditGraph from '../components/CategoryAuditGraph'
import AskAgentBar from '../components/AskAgentBar'

function daysAgoIso(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

export default function Dashboard() {
  const [categories, setCategories] = useState([])
  const [audits, setAudits] = useState([])
  const [usage, setUsage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      listCategories(),
      listAudits({ pageSize: 50 }),
      getUsage(daysAgoIso(30)),
    ])
      .then(([cats, auditPage, usageTotal]) => {
        setCategories(cats)
        setAudits(auditPage.items)
        setUsage(usageTotal.total)
      })
      .catch((err) => setError(err.message))
  }, [])

  const completed = audits.filter((a) => a.status === 'completed' && a.result)
  const avgScore = completed.length
    ? Math.round(completed.reduce((sum, a) => sum + a.result.score, 0) / completed.length)
    : null
  const passRate = completed.length
    ? Math.round((completed.filter((a) => a.result.score >= 60).length / completed.length) * 100)
    : null

  return (
    <div>
      <div
        className="panel"
        style={{
          marginBottom: 20,
          backgroundImage: `linear-gradient(90deg, rgba(24,55,79,0.9), rgba(24,55,79,0.55)), url(${heroImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          color: '#fff',
          padding: 32,
        }}
      >
        <div className="label" style={{ color: '#cfe3f5' }}>SYSTEM STATUS</div>
        <h2 style={{ margin: '6px 0' }}>Audit Agent online.</h2>
        <p style={{ color: '#cfe3f5', margin: 0 }}>Every recorded call, scanned and scored automatically.</p>
      </div>

      {error && <div className="error-state" style={{ marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatTile label="Audits (30d)" value={usage ?? '—'} />
        <StatTile label="Categories" value={categories.length} />
        <StatTile label="Avg Score" value={avgScore != null ? avgScore : '—'} />
        <StatTile label="Pass Rate" value={passRate != null ? `${passRate}%` : '—'} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <div className="label" style={{ marginBottom: 8 }}>CATEGORY / AUDIT NETWORK</div>
        <CategoryAuditGraph categories={categories} audits={audits} />
      </div>

      <AskAgentBar />
    </div>
  )
}

function StatTile({ label, value }) {
  return (
    <div className="panel">
      <div className="label">{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--navy)', fontFamily: 'var(--font-mono)' }}>{value}</div>
    </div>
  )
}
