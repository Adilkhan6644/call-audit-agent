import { useEffect, useState } from 'react'

/** Thresholds are a frontend convention — no pass/fail cutoff exists server-side. */
function band(score) {
  if (score >= 80) return 'good'
  if (score >= 60) return 'ok'
  return 'bad'
}

const RADIUS = 42
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** variant="gauge" draws the score as a filling ring instead of the plain inline number — used for a result that deserves a moment (AuditDetail, a just-finished run), not for compact list rows. */
export default function ScoreBadge({ score, variant = 'inline' }) {
  const b = band(score)
  const pct = Math.min(100, Math.max(0, score))
  const [dashoffset, setDashoffset] = useState(CIRCUMFERENCE)

  useEffect(() => {
    if (variant !== 'gauge') return undefined
    const target = CIRCUMFERENCE * (1 - pct / 100)
    const raf = requestAnimationFrame(() => setDashoffset(target))
    return () => cancelAnimationFrame(raf)
  }, [variant, pct])

  if (variant !== 'gauge') {
    return (
      <span className={`score-badge ${b}`}>
        {Math.round(score)}
        <span className="unit">/100</span>
      </span>
    )
  }

  return (
    <div className={`score-gauge ${b}`}>
      <svg viewBox="0 0 100 100" width="104" height="104">
        <circle className="score-gauge-track" cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="8" />
        <circle
          className="score-gauge-fill"
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashoffset}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="score-gauge-label">
        <span className="score-gauge-number">{Math.round(score)}</span>
        <span className="unit">/100</span>
      </div>
    </div>
  )
}
