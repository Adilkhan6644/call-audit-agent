import heroImage from '../assets/ai-dashboard-cover.jpg'

export default function AuthLayout({ children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div
        style={{
          flex: 1,
          backgroundImage: `linear-gradient(180deg, rgba(24,55,79,0.55), rgba(24,55,79,0.85)), url(${heroImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: 40,
        }}
        className="auth-hero"
      >
        <div className="label" style={{ color: '#cfe3f5', marginBottom: 8 }}>AUDIT AGENT</div>
        <h2 style={{ margin: 0, fontSize: 28 }}>Every call, audited automatically.</h2>
        <p style={{ color: '#cfe3f5', maxWidth: 360 }}>
          AI transcribes and scores every recorded call against your team's own criteria —
          instantly, consistently, at full coverage.
        </p>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div className="panel" style={{ width: 340 }}>{children}</div>
      </div>
    </div>
  )
}
