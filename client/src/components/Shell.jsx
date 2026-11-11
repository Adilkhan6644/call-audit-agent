import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const linkStyle = { color: '#cfe3f5', padding: '8px 10px', borderRadius: 6, display: 'block' }
function navLinkStyle({ isActive }) {
  return isActive ? { ...linkStyle, background: 'rgba(255,255,255,0.12)', color: '#fff' } : linkStyle
}

export default function Shell() {
  const { user, logout } = useAuth()

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={{ width: 210, background: 'var(--navy-dark)', padding: 16 }}>
        <div style={{ color: '#fff', fontWeight: 700, letterSpacing: '0.04em', marginBottom: 20 }}>AUDIT AGENT</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <NavLink to="/" end style={navLinkStyle}>Dashboard</NavLink>
          <NavLink to="/categories" style={navLinkStyle}>Categories</NavLink>
          <NavLink to="/recordings" style={navLinkStyle}>Recordings</NavLink>
          <NavLink to="/audits/new" style={navLinkStyle}>Run Audit</NavLink>
          <NavLink to="/audits" style={navLinkStyle}>Audit History</NavLink>
          <NavLink to="/usage" style={navLinkStyle}>Usage</NavLink>
          {user?.role === 'admin' && (
            <>
              <div className="label" style={{ color: '#7fa2c2', marginTop: 16, marginBottom: 4 }}>ADMIN</div>
              <NavLink to="/admin" style={navLinkStyle}>Console</NavLink>
              <NavLink to="/admin/api-keys" style={navLinkStyle}>API Keys</NavLink>
              <NavLink to="/admin/alerts" style={navLinkStyle}>Alerts</NavLink>
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
