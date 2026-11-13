import { useEffect, useState } from 'react'
import { listAlerts, resolveAlert } from '../api/admin'

export default function AdminAlerts() {
  const [showResolved, setShowResolved] = useState(false)
  const [alerts, setAlerts] = useState(null)
  const [error, setError] = useState(null)

  function refresh() {
    listAlerts(showResolved).then(setAlerts).catch((err) => setError(err.message))
  }

  useEffect(refresh, [showResolved])

  async function handleResolve(id) {
    try {
      await resolveAlert(id)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="label">ALERT QUEUE</div>
        <label style={{ fontSize: 13 }}>
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
          {' '}Show resolved history
        </label>
      </div>
      {error && <div className="error-state" style={{ marginBottom: 12 }}>{error}</div>}

      {!alerts ? (
        <div className="loading-state">LOADING ALERTS…</div>
      ) : alerts.length === 0 ? (
        <div className="empty-state">{showResolved ? 'No resolved alerts.' : 'No unresolved alerts.'}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.map((a) => (
            <div
              key={a._id}
              className="panel"
              style={!a.resolved ? { borderColor: 'var(--danger)', background: 'rgba(255,0,0,0.06)' } : undefined}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, color: a.resolved ? undefined : 'var(--danger)' }}>{a.type}</div>
                  <p style={{ margin: '4px 0' }}>{a.message}</p>
                  <div className="label">
                    Occurred {a.occurrenceCount}× · first {new Date(a.firstSeenAt).toLocaleString()} · last {new Date(a.lastSeenAt).toLocaleString()}
                  </div>
                </div>
                {!a.resolved && <button onClick={() => handleResolve(a._id)}>Resolve</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
