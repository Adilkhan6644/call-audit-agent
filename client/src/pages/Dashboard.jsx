import heroImage from '../assets/ai-dashboard-cover.jpg'

export default function Dashboard() {
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
        <p style={{ color: '#cfe3f5', margin: 0 }}>Modules load as categories, recordings, and audits come online.</p>
      </div>
    </div>
  )
}
