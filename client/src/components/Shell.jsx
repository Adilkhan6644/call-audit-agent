import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listCategories } from '../api/categories'
import { listAudits } from '../api/audits'
import { listRecordings } from '../api/recordings'
import Icon from './icons'
import Sidebar from './Sidebar'

const NAV_ITEMS = [
  { to: '/', end: true, icon: 'grid', label: 'Dashboard' },
  { to: '/categories', icon: 'folder', label: 'Categories' },
  { to: '/recordings', icon: 'mic', label: 'Recordings' },
  { to: '/audits/new', icon: 'play', label: 'Run Audit' },
  { to: '/audits', icon: 'layers', label: 'Audit History' },
  { to: '/usage', icon: 'chart', label: 'Usage' },
]
const ADMIN_ITEMS = [{ to: '/admin', icon: 'shield', label: 'Admin' }]

export default function Shell() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const isCanvasPage = location.pathname === '/'
  const [menuOpen, setMenuOpen] = useState(false)
  const [data, setData] = useState({ categories: [], audits: [], recordings: [] })
  const [selection, setSelection] = useState(null)
  const [headerExtra, setHeaderExtra] = useState(null)

  useEffect(() => {
    Promise.all([listCategories(), listAudits({ pageSize: 50 }), listRecordings()])
      .then(([categories, auditPage, recordings]) =>
        setData({ categories, audits: auditPage.items, recordings })
      )
      .catch(() => {})
  }, [])

  const summary = useMemo(() => {
    const completed = data.audits.filter((a) => a.status === 'completed' && a.result)
    const avgScore = completed.length
      ? Math.round(completed.reduce((sum, a) => sum + a.result.score, 0) / completed.length)
      : null
    const passRate = completed.length
      ? Math.round((completed.filter((a) => a.result.score >= 60).length / completed.length) * 100)
      : null
    const recentScores = completed
      .slice(-8)
      .map((a) => Math.round(a.result.score))
    const latestFinding = [...completed].reverse().find((a) => a.result.findings?.length)

    return {
      categories: data.categories.length,
      recordings: data.recordings.length,
      completed: completed.length,
      failed: data.audits.filter((a) => a.status === 'failed').length,
      avgScore,
      passRate,
      recentScores,
      topFinding: latestFinding?.result.findings[0] || null,
    }
  }, [data])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--app-bg)' }}>
      <nav className="icon-rail">
        <div className="icon-rail-logo"><Icon name="logo" size={20} /></div>
        <div className="icon-rail-links">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              className={({ isActive }) => `icon-rail-link${isActive ? ' active' : ''}`}
            >
              <Icon name={item.icon} size={20} />
            </NavLink>
          ))}
          {user?.role === 'admin' &&
            ADMIN_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                className={({ isActive }) => `icon-rail-link${isActive ? ' active' : ''}`}
              >
                <Icon name={item.icon} size={20} />
              </NavLink>
            ))}
        </div>
      </nav>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header className="top-header">
          <div className="top-header-brand">
            <Icon name="logo" size={22} style={{ color: 'var(--cyan)' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', lineHeight: 1.1 }}>Audit AI</div>
              <div style={{ fontSize: 11, color: '#7fa2c2', lineHeight: 1.1 }}>Call Audit Platform</div>
            </div>
          </div>

          {headerExtra?.toolbar}

          <div style={{ flex: 1 }} />

          {headerExtra?.action}
          <button className="icon-button" title="Search"><Icon name="search" size={17} /></button>
          <button className="icon-button" title="Notifications"><Icon name="bell" size={17} /></button>
          <div style={{ position: 'relative' }}>
            <button className="avatar-button" onClick={() => setMenuOpen((v) => !v)}>
              <span className="avatar-circle">{(user?.email || '?')[0].toUpperCase()}</span>
              <Icon name="chevronDown" size={14} />
            </button>
            {menuOpen && (
              <div className="avatar-menu">
                <div style={{ padding: '8px 12px', color: '#7fa2c2', fontSize: 12 }}>{user?.email}</div>
                <button className="avatar-menu-item" onClick={logout}>
                  <Icon name="logout" size={14} /> Logout
                </button>
              </div>
            )}
          </div>
        </header>

        <main className={`main-content${isCanvasPage ? ' main-content--canvas' : ''}`}>
          <Outlet context={{ selection, setSelection, setHeaderExtra, summary, data }} />
        </main>
      </div>

      <Sidebar selection={selection} summary={summary} />
    </div>
  )
}
