import Icon from './icons'

function scoreColor(score) {
  if (score == null) return 'var(--text-dim)'
  if (score >= 80) return 'var(--green)'
  if (score >= 60) return 'var(--warn)'
  return 'var(--danger)'
}

/**
 * The screenshot's right-hand detail card, reused app-wide: shows whatever
 * `selection` the current page hands up (via useOutletContext), falling back
 * to a plain workspace summary when a page sets none.
 */
export default function Sidebar({ selection, summary }) {
  const title = selection?.title || 'Workspace overview'
  const subtitle = selection?.subtitle || 'Select a category or audit to inspect it here.'
  const icon = selection?.icon || 'grid'
  const badge = selection?.badge
  const meta = selection?.meta
  const onAction = selection?.onAction
  const actionLabel = selection?.actionLabel || 'View details'

  const hasScores = summary.recentScores.length > 0
  const sparkline = hasScores ? summary.recentScores : [1, 1, 1, 1, 1, 1, 1, 1]
  const maxScore = Math.max(...sparkline, 1)

  return (
    <aside className="side-panel">
      <div key={title} className="side-card side-card--hero side-card-enter">
        <div className="side-card-icon">
          <Icon name={icon} size={20} />
        </div>
        <div className="label" style={{ color: '#9fd8c7' }}>{selection?.kicker || 'Overview'}</div>
        <h3 style={{ margin: '4px 0 8px' }}>{title}</h3>
        {badge && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span className={`status-chip ${badge.tone}`}>{badge.label}</span>
            <span style={{ color: '#9fb6c9', fontSize: 12 }}>{subtitle}</span>
          </div>
        )}
        {!badge && <p style={{ color: '#9fb6c9', fontSize: 13, margin: '0 0 10px' }}>{subtitle}</p>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {meta && <span style={{ color: '#7fa2c2', fontSize: 11 }}>{meta}</span>}
          {onAction && (
            <button className="ghost-button" onClick={onAction}>
              {actionLabel} <Icon name="arrowRight" size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="side-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="label">Avg Score</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 30, fontWeight: 700, color: scoreColor(summary.avgScore) }}>
                {summary.avgScore != null ? `${summary.avgScore}%` : '—'}
              </span>
            </div>
          </div>
          <span className="status-chip" style={{ background: 'rgba(255,255,255,0.08)', color: '#cfe3f5' }}>
            {summary.passRate != null ? `${summary.passRate}% pass` : 'No data'}
          </span>
        </div>
        <div className="sparkline">
          {sparkline.map((s, i) => (
            <span
              key={i}
              className="sparkline-bar"
              style={{
                height: `${8 + (s / maxScore) * 24}px`,
                background: hasScores ? scoreColor(s) : 'rgba(255,255,255,0.15)',
              }}
            />
          ))}
        </div>
      </div>

      <div className="side-stat-grid">
        <SideStat icon="folder" value={summary.categories} label="Categories" />
        <SideStat icon="mic" value={summary.recordings} label="Recordings" />
        <SideStat icon="check" value={summary.completed} label="Completed" />
        <SideStat icon="alertCircle" value={summary.failed} label="Failed" />
      </div>

      <div className="side-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Icon name="sparkle" size={16} style={{ color: 'var(--cyan)' }} />
          <div className="label" style={{ color: '#cfe3f5' }}>AI Analysis</div>
        </div>
        {summary.topFinding ? (
          <>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Top finding</div>
            <p style={{ color: '#9fb6c9', fontSize: 13, margin: 0 }}>{summary.topFinding}</p>
          </>
        ) : (
          <p style={{ color: '#9fb6c9', fontSize: 13, margin: 0 }}>
            No completed audits yet — run one to surface findings here.
          </p>
        )}
      </div>
    </aside>
  )
}

function SideStat({ icon, value, label }) {
  return (
    <div className="side-stat">
      <Icon name={icon} size={16} style={{ color: '#9fd8c7' }} />
      <div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
        <div style={{ fontSize: 11, color: '#7fa2c2' }}>{label}</div>
      </div>
    </div>
  )
}
