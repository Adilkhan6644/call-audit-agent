import { useEffect, useRef, useState } from 'react'
import { getUsage } from '../api/usage'
import Icon from '../components/icons'

function isoDaysAgo(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

// Eases from whatever's currently on screen to `target` — used instead of
// snapping straight to the new total so changing the date range feels like
// the number is recalculating, not just replacing itself.
function useCountUp(target) {
  const [display, setDisplay] = useState(target ?? 0)
  const fromRef = useRef(0)

  useEffect(() => {
    if (target == null) return undefined
    const from = fromRef.current
    const delta = target - from
    if (delta === 0) return undefined
    const durationMs = 700
    const start = performance.now()
    let raf
    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - (1 - t) * (1 - t)
      setDisplay(Math.round(from + delta * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])

  return display
}

export default function Usage() {
  const [from, setFrom] = useState(isoDaysAgo(30))
  const [to, setTo] = useState(isoDaysAgo(0))
  const [usage, setUsage] = useState(null)
  const [error, setError] = useState(null)
  const displayTotal = useCountUp(usage?.total)

  useEffect(() => {
    getUsage(from, to).then(setUsage).catch((err) => setError(err.message))
  }, [from, to])

  return (
    <div>
      <div className="label" style={{ marginBottom: 12 }}>USAGE</div>
      {error && <div className="error-state" style={{ marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <div className="panel usage-kpi">
        <div className="usage-kpi-icon"><Icon name="chart" size={20} /></div>
        <div>
          <div className="label">Total audits run ({from} to {to})</div>
          <div className="usage-kpi-number">{usage ? displayTotal : '—'}</div>
        </div>
      </div>
    </div>
  )
}
