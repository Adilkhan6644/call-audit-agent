import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listApiKeys, listAlerts } from '../api/admin'

export default function Admin() {
  const [apiKeys, setApiKeys] = useState(null)
  const [alertCount, setAlertCount] = useState(null)

  useEffect(() => {
    listApiKeys().then(setApiKeys).catch(() => {})
    listAlerts(false).then((alerts) => setAlertCount(alerts.length)).catch(() => {})
  }, [])

  return (
    <div>
      <div className="label" style={{ marginBottom: 12 }}>ADMIN CONSOLE</div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="panel" style={{ flex: 1, minWidth: 200 }}>
          <div className="label">Unresolved alerts</div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>{alertCount ?? '—'}</div>
          <Link to="/admin/alerts">View alert queue →</Link>
        </div>
        <div className="panel" style={{ flex: 1, minWidth: 200 }}>
          <div className="label">Provider keys configured</div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>
            {apiKeys ? `${apiKeys.filter((k) => k.configured).length}/${apiKeys.length}` : '—'}
          </div>
          <Link to="/admin/api-keys">Manage keys →</Link>
        </div>
      </div>
    </div>
  )
}
