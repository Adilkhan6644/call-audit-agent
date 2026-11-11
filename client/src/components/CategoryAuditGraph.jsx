import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from './icons'

const SPHERE = { x: 12, y: 50 }
const TILE_X = 29
const FAN_ORIGIN = { x: 50, y: 50 }
const CURVE_END_X = 51
const ROW_TEXT_X = 53
const ROWS_Y = [6, 94]
const TILE_ICONS = ['folder', 'chart', 'shield', 'mic', 'play']

function scoreColor(score) {
  if (score == null) return '#94a3b8'
  if (score >= 80) return '#7be08a'
  if (score >= 60) return '#f2c14e'
  return '#ff6b6b'
}

function curvePath(x0, y0, x1, y1) {
  const midX = x0 + (x1 - x0) * 0.55
  return `M ${x0} ${y0} C ${midX} ${y0}, ${midX} ${y1}, ${x1} ${y1}`
}

/**
 * Draws the path in (stroke-dashoffset: length → 0, ease-out-expo — the
 * standard "self-drawing SVG line" technique) then hands off to the
 * continuous marching-ants flow animation once it's fully revealed.
 */
function AnimatedLink({ d, color, delay = 0 }) {
  const ref = useRef(null)
  const [flowing, setFlowing] = useState(false)

  useEffect(() => {
    const path = ref.current
    if (!path || typeof path.getTotalLength !== 'function') {
      setFlowing(true)
      return undefined
    }
    const length = path.getTotalLength()
    path.style.transition = 'none'
    path.style.strokeDasharray = `${length}`
    path.style.strokeDashoffset = `${length}`
    const raf = requestAnimationFrame(() => {
      path.style.transition = `stroke-dashoffset 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`
      path.style.strokeDashoffset = '0'
    })
    const timeout = setTimeout(() => {
      path.style.transition = ''
      path.style.strokeDasharray = ''
      path.style.strokeDashoffset = ''
      setFlowing(true)
    }, delay + 750)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timeout)
    }
  }, [d, delay])

  return (
    <path
      ref={ref}
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={1}
      opacity={0.6}
      vectorEffect="non-scaling-stroke"
      className={flowing ? 'graph-link-flow' : ''}
    />
  )
}

/**
 * Left: category tiles fed by curved lines from a glowing central sphere.
 * The selected tile's line continues into a wide fan of its audits on the
 * right, each row ending in a small marker dot on the curve — matching the
 * reference screenshot's radial hub layout.
 */
export default function CategoryAuditGraph({ categories, audits, onSelect }) {
  const [selectedId, setSelectedId] = useState(null)

  const categoryStats = useMemo(() => {
    const stats = {}
    for (const cat of categories) {
      const forCat = audits.filter((a) => a.categoryId === cat._id)
      const completed = forCat.filter((a) => a.status === 'completed' && a.result)
      stats[cat._id] = {
        total: forCat.length,
        avgScore: completed.length
          ? Math.round(completed.reduce((sum, a) => sum + a.result.score, 0) / completed.length)
          : null,
      }
    }
    return stats
  }, [categories, audits])

  if (!categories.length) {
    return <div className="empty-state">No categories yet — add one to populate the graph.</div>
  }

  const selected = categories.find((c) => c._id === selectedId) || categories[0]

  // Pin the selected tile to the middle slot so the sphere → tile → fan
  // line reads as one straight hub-and-spoke, whatever was clicked.
  const shown = categories.length <= 5
    ? categories.slice()
    : [selected, ...categories.filter((c) => c._id !== selected._id).slice(0, 4)]
  const tiles = shown.filter((c) => c._id !== selected._id)
  const middleIndex = Math.floor(shown.length / 2)
  tiles.splice(middleIndex, 0, selected)
  const tileGap = 9
  const tileY = (i) => 50 + (i - middleIndex) * tileGap

  const rows = audits.filter((a) => a.categoryId === selected._id)
  const rowGap = rows.length > 1 ? (ROWS_Y[1] - ROWS_Y[0]) / (rows.length - 1) : 0
  const rowY = (i) => (rows.length > 1 ? ROWS_Y[0] + i * rowGap : 50)

  function pick(kind, node) {
    if (kind === 'category') setSelectedId(node._id)
    onSelect?.(kind, node)
  }

  return (
    <div className="graph-stage graph-stage--fullbleed">
      <div className="graph-sphere-halo" style={{ left: `${SPHERE.x}%`, top: `${SPHERE.y}%` }} />
      <div className="graph-sphere-label" style={{ left: `${SPHERE.x}%`, top: `${SPHERE.y}%` }}>
        {selected.name}
      </div>
      <div
        className="graph-node"
        title={selected.name}
        onClick={() => pick('category', selected)}
        style={{ left: `${SPHERE.x}%`, top: `${SPHERE.y}%`, width: 92, height: 92, marginLeft: -46, marginTop: -46 }}
      >
        <div className="graph-node-ring" />
        <div
          className="graph-node-sphere"
          style={{
            width: 78,
            height: 78,
            background: 'radial-gradient(circle at 35% 30%, #fff, #8a7af2 55%, #4e3fb8 100%)',
            boxShadow: '0 0 30px #8a7af2aa',
          }}
        />
      </div>
      <div className="gap-pill" style={{ left: `${SPHERE.x}%`, top: `${SPHERE.y}%` }}>
        GAPS {categoryStats[selected._id]?.total ?? 0}
      </div>

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="graph-svg">
        {tiles.map((cat, i) => (
          <AnimatedLink
            key={cat._id}
            d={curvePath(SPHERE.x, SPHERE.y, TILE_X, tileY(i))}
            color={cat._id === selected._id ? '#f2c14e' : '#3fa9c9'}
            delay={i * 60}
          />
        ))}
        {rows.map((a, i) => (
          <AnimatedLink
            key={a._id}
            d={curvePath(FAN_ORIGIN.x, FAN_ORIGIN.y, CURVE_END_X, rowY(i))}
            color={scoreColor(a.result?.score)}
            delay={150 + i * 40}
          />
        ))}
      </svg>

      {tiles.map((cat, i) => {
        const stats = categoryStats[cat._id]
        const isSelected = cat._id === selected._id
        return (
          <button
            key={cat._id}
            title={cat.name}
            className={`graph-category-tile${isSelected ? ' is-selected' : ''}`}
            onClick={() => pick('category', cat)}
            style={{ left: `${TILE_X}%`, top: `${tileY(i)}%`, animationDelay: `${i * 60 + 200}ms` }}
          >
            <Icon name={TILE_ICONS[i % TILE_ICONS.length]} size={16} />
            <span>
              <span className="graph-category-count">{stats.total}</span>
              <span className="graph-category-name">{cat.name}</span>
            </span>
          </button>
        )
      })}

      {rows.length === 0 && (
        <div className="empty-state" style={{ position: 'absolute', left: `${ROW_TEXT_X}%`, top: '50%', transform: 'translateY(-50%)' }}>
          No audits in this category yet.
        </div>
      )}
      {rows.map((a, i) => {
        const score = a.result?.score
        const color = scoreColor(score)
        const title = a.status === 'completed' && a.result ? `Audit · score ${Math.round(score)}` : `Audit · ${a.status}`
        const date = a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''
        return (
          <button
            key={a._id}
            title={title}
            className="graph-row"
            onClick={() => pick('audit', a)}
            style={{ left: `${ROW_TEXT_X}%`, top: `${rowY(i)}%`, animationDelay: `${150 + i * 40 + 300}ms` }}
          >
            <span className="graph-row-dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
            <span>
              <span className="graph-row-title">{title}</span>
              <span className="graph-row-meta">{date}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
