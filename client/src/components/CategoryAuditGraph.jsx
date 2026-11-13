import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Icon from './icons'

const HUB_Y = 46
const SPHERE = { x: 12, y: HUB_Y }
const TILE_X = 29
const CURVE_END_X = 53
const ROW_TEXT_X = 53
const ROWS_Y = [6, 94]
const TILE_ICONS = ['folder', 'chart', 'shield', 'mic', 'play']
const GOLD = '#e0b869'

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

function AnimatedLink({ d, color = GOLD, delay = 0 }) {
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
    <>
      <path
        ref={ref}
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1}
        opacity={0.75}
        vectorEffect="non-scaling-stroke"
      />
      {flowing && (
        <path
          d={d}
          className="graph-shine"
          fill="none"
          stroke="url(#goldShine)"
          strokeWidth={2.2}
          vectorEffect="non-scaling-stroke"
          style={{ mixBlendMode: 'screen' }}
        />
      )}
    </>
  )
}

function sameRects(a, b) {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => b[key] && b[key].left === a[key].left && b[key].right === a[key].right && b[key].y === a[key].y)
}

export default function CategoryAuditGraph({ categories, audits, onSelect }) {
  const [selectedId, setSelectedId] = useState(null)
  const stageRef = useRef(null)
  const boxEls = useRef(new Map())
  const [boxRects, setBoxRects] = useState({})

  useLayoutEffect(() => {
    const stageEl = stageRef.current
    if (!stageEl) return undefined

    function measure() {
      const stageWidth = stageEl.offsetWidth
      const stageHeight = stageEl.offsetHeight
      if (stageWidth === 0 || stageHeight === 0) return
      const next = {}
      boxEls.current.forEach((el, id) => {
        next[id] = {
          left: Math.round((el.offsetLeft / stageWidth) * 10000) / 100,
          right: Math.round(((el.offsetLeft + el.offsetWidth) / stageWidth) * 10000) / 100,
          y: Math.round(((el.offsetTop + el.offsetHeight / 2) / stageHeight) * 10000) / 100,
        }
      })
      setBoxRects((prev) => (sameRects(prev, next) ? prev : next))
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(stageEl)
    return () => observer.disconnect()
  })

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
  const tileY = (i) => HUB_Y + (i - middleIndex) * tileGap

  const rows = audits.filter((a) => a.categoryId === selected._id)
  const rowGap = rows.length > 1 ? (ROWS_Y[1] - ROWS_Y[0]) / (rows.length - 1) : 0
  const rowY = (i) => (rows.length > 1 ? ROWS_Y[0] + i * rowGap : 50)
  const selectedRect = boxRects[selected._id]
  const fanOrigin = { x: selectedRect ? selectedRect.right : TILE_X, y: selectedRect ? selectedRect.y : HUB_Y }

  function pick(kind, node) {
    if (kind === 'category') setSelectedId(node._id)
    onSelect?.(kind, node)
  }

  return (
    <div className="graph-stage graph-stage--fullbleed" ref={stageRef}>
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
        <defs>
          <linearGradient id="goldShine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff6de" stopOpacity="0" />
            <stop offset="45%" stopColor="#fff6de" stopOpacity="0" />
            <stop offset="50%" stopColor="#fff6de" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#fff6de" stopOpacity="0" />
            <stop offset="100%" stopColor="#fff6de" stopOpacity="0" />
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              from="-1.5 0"
              to="1.5 0"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </linearGradient>
        </defs>
        {tiles.map((cat, i) => {
          const rect = boxRects[cat._id]
          const endX = rect ? rect.left : TILE_X
          const endY = rect ? rect.y : tileY(i)
          return <AnimatedLink key={cat._id} d={curvePath(SPHERE.x, SPHERE.y, endX, endY)} delay={i * 60} />
        })}
        {rows.map((a, i) => {
          const rect = boxRects[a._id]
          const endX = rect ? rect.left : CURVE_END_X
          const endY = rect ? rect.y : rowY(i)
          return (
            <AnimatedLink
              key={a._id}
              d={curvePath(fanOrigin.x, fanOrigin.y, endX, endY)}
              delay={150 + i * 40}
            />
          )
        })}
      </svg>

      {tiles.map((cat, i) => {
        const stats = categoryStats[cat._id]
        const isSelected = cat._id === selected._id
        return (
          <button
            key={cat._id}
            ref={(el) => {
              if (el) boxEls.current.set(cat._id, el)
              else boxEls.current.delete(cat._id)
            }}
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
            ref={(el) => {
              if (el) boxEls.current.set(a._id, el)
              else boxEls.current.delete(a._id)
            }}
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
