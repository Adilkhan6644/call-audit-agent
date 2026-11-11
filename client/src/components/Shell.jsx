import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navLinkClass = ({ isActive }) => (isActive ? 'active' : undefined)

export default function Shell() {
  const { user, logout } = useAuth()

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={{ width: 200, borderRight: '1px solid var(--border)', padding: 16 }}>
        <div className="label" style={{ marginBottom: 16 }}>AUDIT AGENT</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <NavLink to="/" className={navLinkClass}>Dashboard</NavLink>
          <NavLink to="/categories" className={navLinkClass}>Categories</NavLink>
          <NavLink to="/recordings" className={navLinkClass}>Recordings</NavLink>
          <NavLink to="/audits/new" className={navLinkClass}>Run Audit</NavLink>
          <NavLink to="/audits" className={navLinkClass}>Audit History</NavLink>
          <NavLink to="/usage" className={navLinkClass}>Usage</NavLink>
          {user?.role === 'admin' && (
            <>
              <div className="label" style={{ marginTop: 12 }}>ADMIN</div>
              <NavLink to="/admin" className={navLinkClass}>Console</NavLink>
              <NavLink to="/admin/api-keys" className={navLinkClass}>API Keys</NavLink>
              <NavLink to="/admin/alerts" className={navLinkClass}>Alerts</NavLink>
            </>
          )}
        </div>
      </nav>
      <main style={{ flex: 1, padding: 24 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <span className="label">{user?.email}</span>
          <button onClick={logout}>Logout</button>
        </header>
        <Outlet />
      </main>
    </div>
  )
}
